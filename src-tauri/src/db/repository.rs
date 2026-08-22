use std::{
    collections::{HashMap, HashSet},
    str::FromStr,
};

use chrono::{DateTime, Datelike, NaiveDate, NaiveDateTime, Utc};
use rust_decimal::{Decimal, RoundingStrategy};
use sqlx::{Row, SqlitePool};
use thiserror::Error;
use uuid::Uuid;

use crate::models::{
    AccountSettings, AutomaticReserveMode, AutomaticReserveRule, BackupData, CardBackground,
    CardNetwork, CardPattern, Category, DebitCard, DigitalWalletItem, DigitalWalletItemKind,
    LegacyAppData, MonthlyReserveRule, RecurrenceType, RecurringRule, Transaction, TransactionType,
    UpdateDebitCardStyle, Vault, VaultMovement, VaultMovementSource, VaultMovementType, VaultType,
};

#[derive(Debug, Error)]
pub enum DbError {
    #[error(transparent)]
    Sqlx(#[from] sqlx::Error),
    #[error("dado inválido no banco: {0}")]
    InvalidData(String),
    #[error("{0}")]
    InvalidOperation(String),
    #[error("{0} não encontrado")]
    NotFound(&'static str),
}

#[derive(Clone, Debug)]
pub struct AppLockRecord {
    pub pin_hash: String,
    pub biometric_enabled: bool,
    pub failed_attempts: u32,
    pub locked_until: Option<DateTime<Utc>>,
}

pub struct FinanceRepository<'a> {
    pool: &'a SqlitePool,
}

impl<'a> FinanceRepository<'a> {
    pub fn new(pool: &'a SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn get_app_lock(&self) -> Result<Option<AppLockRecord>, DbError> {
        let row = sqlx::query(
            "SELECT pin_hash, biometric_enabled, failed_attempts, locked_until FROM app_lock_settings WHERE id = 1",
        )
        .fetch_optional(self.pool)
        .await?;
        row.map(|row| {
            let locked_until = row
                .try_get::<Option<String>, _>("locked_until")?
                .map(|value| {
                    DateTime::parse_from_rfc3339(&value)
                        .map(|date| date.with_timezone(&Utc))
                        .map_err(invalid)
                })
                .transpose()?;
            Ok(AppLockRecord {
                pin_hash: row.try_get("pin_hash")?,
                biometric_enabled: row.try_get("biometric_enabled")?,
                failed_attempts: row.try_get::<i64, _>("failed_attempts")? as u32,
                locked_until,
            })
        })
        .transpose()
    }

    pub async fn save_app_lock(
        &self,
        pin_hash: &str,
        biometric_enabled: bool,
    ) -> Result<(), DbError> {
        sqlx::query(
            r#"INSERT INTO app_lock_settings
               (id, pin_hash, biometric_enabled, failed_attempts, locked_until, updated_at)
               VALUES (1, ?, ?, 0, NULL, ?)
               ON CONFLICT(id) DO UPDATE SET
                 pin_hash = excluded.pin_hash,
                 biometric_enabled = excluded.biometric_enabled,
                 failed_attempts = 0,
                 locked_until = NULL,
                 updated_at = excluded.updated_at"#,
        )
        .bind(pin_hash)
        .bind(biometric_enabled)
        .bind(Utc::now().to_rfc3339())
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn set_app_lock_biometric(&self, enabled: bool) -> Result<(), DbError> {
        let changed = sqlx::query(
            "UPDATE app_lock_settings SET biometric_enabled = ?, updated_at = ? WHERE id = 1",
        )
        .bind(enabled)
        .bind(Utc::now().to_rfc3339())
        .execute(self.pool)
        .await?
        .rows_affected();
        if changed == 0 {
            return Err(DbError::NotFound("bloqueio do aplicativo"));
        }
        Ok(())
    }

    pub async fn clear_app_lock_attempts(&self) -> Result<(), DbError> {
        sqlx::query(
            "UPDATE app_lock_settings SET failed_attempts = 0, locked_until = NULL WHERE id = 1",
        )
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn register_app_lock_failure(&self) -> Result<Option<DateTime<Utc>>, DbError> {
        let current = self
            .get_app_lock()
            .await?
            .ok_or(DbError::NotFound("bloqueio do aplicativo"))?;
        let attempts = current.failed_attempts.saturating_add(1);
        let locked_until = (attempts >= 5).then(|| Utc::now() + chrono::TimeDelta::seconds(30));
        sqlx::query(
            "UPDATE app_lock_settings SET failed_attempts = ?, locked_until = ?, updated_at = ? WHERE id = 1",
        )
        .bind(if locked_until.is_some() { 0 } else { attempts })
        .bind(locked_until.map(|date| date.to_rfc3339()))
        .bind(Utc::now().to_rfc3339())
        .execute(self.pool)
        .await?;
        Ok(locked_until)
    }

    pub async fn delete_app_lock(&self) -> Result<(), DbError> {
        sqlx::query("DELETE FROM app_lock_settings WHERE id = 1")
            .execute(self.pool)
            .await?;
        Ok(())
    }

    pub async fn insert_transaction(&self, transaction: &Transaction) -> Result<(), DbError> {
        let mut database_transaction = self.pool.begin().await?;
        insert_transaction_record(&mut database_transaction, transaction).await?;
        if transaction.kind == TransactionType::Income {
            apply_automatic_reserves(&mut database_transaction, transaction.amount).await?;
        }
        database_transaction.commit().await?;
        Ok(())
    }

    pub async fn import_transactions(
        &self,
        records: &[Transaction],
        closing_balance: Option<Decimal>,
    ) -> Result<(), DbError> {
        let mut database_transaction = self.pool.begin().await?;
        for record in records {
            insert_transaction_record(&mut database_transaction, record).await?;
        }
        let projected_balance = available_balance_in_transaction(&mut database_transaction).await?;
        if let Some(closing_balance) = closing_balance {
            if closing_balance < Decimal::ZERO {
                return Err(DbError::InvalidOperation(
                    "o Pingo ainda não reconcilia extratos com saldo negativo".into(),
                ));
            }
            let row = sqlx::query(
                "SELECT opening_balance_adjustment, balance_hidden, migrated_at FROM account_settings WHERE id = 1",
            )
            .fetch_optional(&mut *database_transaction)
            .await?;
            let (adjustment, balance_hidden, migrated_at) = if let Some(row) = row {
                let value =
                    Decimal::from_str(&row.try_get::<String, _>("opening_balance_adjustment")?)
                        .map_err(invalid)?;
                (
                    value,
                    row.try_get::<bool, _>("balance_hidden")?,
                    row.try_get::<String, _>("migrated_at")?,
                )
            } else {
                (Decimal::ZERO, false, Utc::now().to_rfc3339())
            };
            let corrected_adjustment = adjustment + closing_balance - projected_balance;
            sqlx::query(
                r#"INSERT INTO account_settings
                   (id, opening_balance_adjustment, balance_hidden, migrated_at, updated_at)
                   VALUES (1, ?, ?, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET
                     opening_balance_adjustment = excluded.opening_balance_adjustment,
                     balance_hidden = excluded.balance_hidden,
                     migrated_at = excluded.migrated_at,
                     updated_at = excluded.updated_at"#,
            )
            .bind(corrected_adjustment.to_string())
            .bind(balance_hidden)
            .bind(migrated_at)
            .bind(Utc::now().to_rfc3339())
            .execute(&mut *database_transaction)
            .await?;
        } else if projected_balance < Decimal::ZERO {
            return Err(DbError::InvalidOperation(
                "o extrato deixaria o saldo negativo; ative a conciliação com o saldo do arquivo"
                    .into(),
            ));
        }
        database_transaction.commit().await?;
        Ok(())
    }

    pub async fn list_transactions(&self) -> Result<Vec<Transaction>, DbError> {
        let rows = sqlx::query(
            r#"SELECT id, kind, amount, date, occurred_at, category_id, debit_card_id, description, recurrence, created_at
               FROM transactions
               ORDER BY date DESC, occurred_at DESC, created_at DESC"#,
        )
        .fetch_all(self.pool)
        .await?;

        rows.into_iter().map(row_to_transaction).collect()
    }

    pub async fn get_transaction(&self, id: Uuid) -> Result<Option<Transaction>, DbError> {
        let row = sqlx::query(
            r#"SELECT id, kind, amount, date, occurred_at, category_id, debit_card_id, description, recurrence, created_at
               FROM transactions WHERE id = ?"#,
        )
        .bind(id.to_string())
        .fetch_optional(self.pool)
        .await?;
        row.map(row_to_transaction).transpose()
    }

    pub async fn update_transaction(&self, transaction: &Transaction) -> Result<(), DbError> {
        let result = sqlx::query(
            r#"UPDATE transactions SET kind = ?, amount = ?, date = ?, occurred_at = ?, category_id = ?, debit_card_id = ?,
               description = ?, recurrence = ? WHERE id = ?"#,
        )
        .bind(transaction.kind.as_str())
        .bind(transaction.amount.to_string())
        .bind(transaction.date.format("%Y-%m-%d").to_string())
        .bind(transaction.occurred_at.map(|value| value.format("%Y-%m-%dT%H:%M:%S").to_string()))
        .bind(transaction.category_id.map(|id| id.to_string()))
        .bind(transaction.debit_card_id.map(|id| id.to_string()))
        .bind(&transaction.description)
        .bind(transaction.recurrence.as_str())
        .bind(transaction.id.to_string())
        .execute(self.pool)
        .await?;
        if result.rows_affected() == 0 {
            return Err(DbError::NotFound("transação"));
        }
        Ok(())
    }

    pub async fn delete_transaction(&self, id: Uuid) -> Result<(), DbError> {
        sqlx::query("DELETE FROM transactions WHERE id = ?")
            .bind(id.to_string())
            .execute(self.pool)
            .await?;
        Ok(())
    }

    pub async fn insert_category(&self, category: &Category) -> Result<(), DbError> {
        sqlx::query(
            "INSERT INTO categories (id, kind, name, icon, color, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(category.id.to_string())
        .bind(category.kind.as_str())
        .bind(&category.name)
        .bind(&category.icon)
        .bind(&category.color)
        .bind(category.created_at.to_rfc3339())
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn category_name_exists(
        &self,
        kind: TransactionType,
        name: &str,
    ) -> Result<bool, DbError> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM categories WHERE kind = ? AND name = ? COLLATE NOCASE",
        )
        .bind(kind.as_str())
        .bind(name.trim())
        .fetch_one(self.pool)
        .await?;
        Ok(count > 0)
    }

    pub async fn list_categories(&self) -> Result<Vec<Category>, DbError> {
        let rows = sqlx::query(
            "SELECT id, kind, name, icon, color, created_at FROM categories ORDER BY kind, name COLLATE NOCASE",
        )
        .fetch_all(self.pool)
        .await?;

        rows.into_iter().map(row_to_category).collect()
    }

    pub async fn category_kind(&self, id: Uuid) -> Result<Option<TransactionType>, DbError> {
        let row = sqlx::query("SELECT kind FROM categories WHERE id = ?")
            .bind(id.to_string())
            .fetch_optional(self.pool)
            .await?;

        row.map(|row| {
            let kind: String = row.try_get("kind")?;
            TransactionType::parse(&kind).ok_or_else(|| DbError::InvalidData(kind))
        })
        .transpose()
    }

    pub async fn insert_debit_card(&self, card: &DebitCard) -> Result<(), DbError> {
        let mut transaction = self.pool.begin().await?;

        if card.is_default {
            sqlx::query("UPDATE debit_cards SET is_default = 0")
                .execute(&mut *transaction)
                .await?;
        }

        sqlx::query(
            r#"INSERT INTO debit_cards
               (id, name, issuer, holder_name, last_four, network, color_from, color_to, pattern, background_image, emoji,
                is_default, is_frozen, monthly_spending_limit, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(card.id.to_string())
        .bind(&card.name)
        .bind(&card.issuer)
        .bind(&card.holder_name)
        .bind(&card.last_four)
        .bind(card.network.as_str())
        .bind(&card.color_from)
        .bind(&card.color_to)
        .bind(card.pattern.as_str())
        .bind(card.background_image.as_str())
        .bind(&card.emoji)
        .bind(card.is_default)
        .bind(card.is_frozen)
        .bind(card.monthly_spending_limit.map(|value| value.to_string()))
        .bind(card.created_at.to_rfc3339())
        .execute(&mut *transaction)
        .await?;

        transaction.commit().await?;
        Ok(())
    }

    pub async fn list_debit_cards(&self) -> Result<Vec<DebitCard>, DbError> {
        let rows = sqlx::query(
            r#"SELECT id, name, issuer, holder_name, last_four, network, color_from, color_to, pattern, background_image, emoji,
                      is_default, is_frozen, monthly_spending_limit, created_at
               FROM debit_cards
               ORDER BY is_default DESC, created_at ASC"#,
        )
        .fetch_all(self.pool)
        .await?;

        rows.into_iter().map(row_to_debit_card).collect()
    }

    pub async fn update_debit_card_style(
        &self,
        input: &UpdateDebitCardStyle,
    ) -> Result<(), DbError> {
        let result = sqlx::query(
            "UPDATE debit_cards SET color_from = ?, color_to = ?, pattern = ?, background_image = ?, emoji = ? WHERE id = ?",
        )
        .bind(input.color_from.to_ascii_uppercase())
        .bind(input.color_to.to_ascii_uppercase())
        .bind(input.pattern.as_str())
        .bind(input.background_image.as_str())
        .bind(&input.emoji)
        .bind(input.id.to_string())
        .execute(self.pool)
        .await?;
        if result.rows_affected() == 0 {
            return Err(DbError::NotFound("cartão"));
        }
        Ok(())
    }

    pub async fn set_debit_card_frozen(&self, id: Uuid, frozen: bool) -> Result<(), DbError> {
        let result = sqlx::query("UPDATE debit_cards SET is_frozen = ? WHERE id = ?")
            .bind(frozen)
            .bind(id.to_string())
            .execute(self.pool)
            .await?;
        if result.rows_affected() == 0 {
            return Err(DbError::NotFound("cartão"));
        }
        Ok(())
    }

    pub async fn set_default_debit_card(&self, id: Uuid) -> Result<(), DbError> {
        let mut transaction = self.pool.begin().await?;
        let exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM debit_cards WHERE id = ?")
            .bind(id.to_string())
            .fetch_one(&mut *transaction)
            .await?;
        if exists == 0 {
            return Err(DbError::NotFound("cartão"));
        }
        sqlx::query("UPDATE debit_cards SET is_default = 0")
            .execute(&mut *transaction)
            .await?;
        sqlx::query("UPDATE debit_cards SET is_default = 1 WHERE id = ?")
            .bind(id.to_string())
            .execute(&mut *transaction)
            .await?;
        transaction.commit().await?;
        Ok(())
    }

    pub async fn delete_debit_card(&self, id: Uuid) -> Result<(), DbError> {
        let result = sqlx::query("DELETE FROM debit_cards WHERE id = ?")
            .bind(id.to_string())
            .execute(self.pool)
            .await?;
        if result.rows_affected() == 0 {
            return Err(DbError::NotFound("cartão"));
        }
        Ok(())
    }

    pub async fn debit_card_is_frozen(&self, id: Uuid) -> Result<bool, DbError> {
        let row = sqlx::query("SELECT is_frozen FROM debit_cards WHERE id = ?")
            .bind(id.to_string())
            .fetch_optional(self.pool)
            .await?;

        Ok(row
            .map(|row| row.try_get::<bool, _>("is_frozen"))
            .transpose()?
            .unwrap_or(false))
    }

    pub async fn get_debit_card(&self, id: Uuid) -> Result<Option<DebitCard>, DbError> {
        let row = sqlx::query(
            r#"SELECT id, name, issuer, holder_name, last_four, network, color_from, color_to, pattern,
                      background_image, emoji, is_default, is_frozen, monthly_spending_limit, created_at
               FROM debit_cards WHERE id = ?"#,
        )
        .bind(id.to_string())
        .fetch_optional(self.pool)
        .await?;
        row.map(row_to_debit_card).transpose()
    }

    pub async fn card_expense_for_month(
        &self,
        card_id: Uuid,
        date: NaiveDate,
        excluding: Option<Uuid>,
    ) -> Result<Decimal, DbError> {
        let month_prefix = date.format("%Y-%m").to_string();
        let rows = sqlx::query(
            r#"SELECT id, amount FROM transactions
               WHERE kind = 'expense' AND debit_card_id = ? AND substr(date, 1, 7) = ?"#,
        )
        .bind(card_id.to_string())
        .bind(month_prefix)
        .fetch_all(self.pool)
        .await?;

        rows.into_iter().try_fold(Decimal::ZERO, |total, row| {
            let id: String = row.try_get("id")?;
            if excluding.is_some_and(|excluded| excluded.to_string() == id) {
                return Ok(total);
            }
            let amount: String = row.try_get("amount")?;
            Decimal::from_str(&amount)
                .map(|value| total + value)
                .map_err(invalid)
        })
    }

    pub async fn insert_vault(&self, vault: &Vault) -> Result<(), DbError> {
        let mut transaction = self.pool.begin().await?;
        sqlx::query(
            r#"INSERT INTO vaults
               (id, name, institution, type, balance, target_amount, annual_yield_rate, color, emoji, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(vault.id.to_string())
        .bind(&vault.name)
        .bind(&vault.institution)
        .bind(vault.r#type.as_str())
        .bind(vault.balance.to_string())
        .bind(vault.target_amount.map(|value| value.to_string()))
        .bind(vault.annual_yield_rate.map(|value| value.to_string()))
        .bind(&vault.color)
        .bind(&vault.emoji)
        .bind(vault.created_at.to_rfc3339())
        .bind(vault.updated_at.to_rfc3339())
        .execute(&mut *transaction)
        .await?;

        if vault.balance > Decimal::ZERO {
            let movement = VaultMovement::new(
                vault.id,
                VaultMovementType::Deposit,
                vault.balance,
                VaultMovementSource::Manual,
            );
            insert_vault_movement(&mut transaction, &movement).await?;
        }

        transaction.commit().await?;
        Ok(())
    }

    pub async fn list_vaults(&self) -> Result<Vec<Vault>, DbError> {
        let rows = sqlx::query(
            r#"SELECT id, name, institution, type, balance, target_amount, annual_yield_rate,
                      color, emoji, created_at, updated_at
               FROM vaults ORDER BY updated_at DESC"#,
        )
        .fetch_all(self.pool)
        .await?;
        rows.into_iter().map(row_to_vault).collect()
    }

    pub async fn get_vault(&self, id: Uuid) -> Result<Option<Vault>, DbError> {
        let row = sqlx::query(
            r#"SELECT id, name, institution, type, balance, target_amount, annual_yield_rate,
                      color, emoji, created_at, updated_at
               FROM vaults WHERE id = ?"#,
        )
        .bind(id.to_string())
        .fetch_optional(self.pool)
        .await?;
        row.map(row_to_vault).transpose()
    }

    pub async fn update_vault_balance(
        &self,
        vault: &Vault,
        movement: &VaultMovement,
    ) -> Result<(), DbError> {
        let mut transaction = self.pool.begin().await?;
        let result = sqlx::query("UPDATE vaults SET balance = ?, updated_at = ? WHERE id = ?")
            .bind(vault.balance.to_string())
            .bind(vault.updated_at.to_rfc3339())
            .bind(vault.id.to_string())
            .execute(&mut *transaction)
            .await?;
        if result.rows_affected() == 0 {
            return Err(DbError::NotFound("cofre"));
        }
        insert_vault_movement(&mut transaction, movement).await?;
        transaction.commit().await?;
        Ok(())
    }

    pub async fn update_vault(&self, vault: &Vault) -> Result<(), DbError> {
        let result = sqlx::query(
            r#"UPDATE vaults SET name = ?, institution = ?, target_amount = ?, annual_yield_rate = ?,
               color = ?, emoji = ?, updated_at = ? WHERE id = ?"#,
        )
        .bind(&vault.name)
        .bind(&vault.institution)
        .bind(vault.target_amount.map(|value| value.to_string()))
        .bind(vault.annual_yield_rate.map(|value| value.to_string()))
        .bind(&vault.color)
        .bind(&vault.emoji)
        .bind(vault.updated_at.to_rfc3339())
        .bind(vault.id.to_string())
        .execute(self.pool)
        .await?;
        if result.rows_affected() == 0 {
            return Err(DbError::NotFound("cofre"));
        }
        Ok(())
    }

    pub async fn delete_vault(&self, id: Uuid) -> Result<(), DbError> {
        let result = sqlx::query("DELETE FROM vaults WHERE id = ?")
            .bind(id.to_string())
            .execute(self.pool)
            .await?;
        if result.rows_affected() == 0 {
            return Err(DbError::NotFound("cofre"));
        }
        Ok(())
    }

    pub async fn available_balance(&self) -> Result<Decimal, DbError> {
        let adjustment = self
            .get_account_settings()
            .await?
            .unwrap_or_default()
            .opening_balance_adjustment;
        let transaction_total = self.list_transactions().await?.into_iter().fold(
            Decimal::ZERO,
            |total, item| match item.kind {
                TransactionType::Income => total + item.amount,
                TransactionType::Expense => total - item.amount,
            },
        );
        let vault_total = self
            .list_vaults()
            .await?
            .into_iter()
            .fold(Decimal::ZERO, |total, vault| total + vault.balance);
        Ok(adjustment + transaction_total - vault_total)
    }

    pub async fn get_account_settings(&self) -> Result<Option<AccountSettings>, DbError> {
        let row = sqlx::query(
            "SELECT opening_balance_adjustment, balance_hidden, migrated_at FROM account_settings WHERE id = 1",
        )
        .fetch_optional(self.pool)
        .await?;
        row.map(row_to_account_settings).transpose()
    }

    pub async fn save_account_settings(&self, settings: &AccountSettings) -> Result<(), DbError> {
        sqlx::query(
            r#"INSERT INTO account_settings
               (id, opening_balance_adjustment, balance_hidden, migrated_at, updated_at)
               VALUES (1, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 opening_balance_adjustment = excluded.opening_balance_adjustment,
                 balance_hidden = excluded.balance_hidden,
                 migrated_at = excluded.migrated_at,
                 updated_at = excluded.updated_at"#,
        )
        .bind(settings.opening_balance_adjustment.to_string())
        .bind(settings.balance_hidden)
        .bind(settings.migrated_at.to_rfc3339())
        .bind(Utc::now().to_rfc3339())
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn list_vault_movements(&self) -> Result<Vec<VaultMovement>, DbError> {
        let rows = sqlx::query(
            r#"SELECT id, vault_id, kind, amount, source, occurred_at
               FROM vault_movements ORDER BY occurred_at DESC LIMIT 500"#,
        )
        .fetch_all(self.pool)
        .await?;
        rows.into_iter().map(row_to_vault_movement).collect()
    }

    pub async fn list_automatic_reserve_rules(&self) -> Result<Vec<AutomaticReserveRule>, DbError> {
        let rows = sqlx::query(
            "SELECT vault_id, enabled, mode, value FROM automatic_reserve_rules ORDER BY updated_at",
        )
        .fetch_all(self.pool)
        .await?;
        rows.into_iter()
            .map(row_to_automatic_reserve_rule)
            .collect()
    }

    pub async fn save_automatic_reserve_rule(
        &self,
        rule: &AutomaticReserveRule,
    ) -> Result<(), DbError> {
        sqlx::query(
            r#"INSERT INTO automatic_reserve_rules (vault_id, enabled, mode, value, updated_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(vault_id) DO UPDATE SET
                 enabled = excluded.enabled,
                 mode = excluded.mode,
                 value = excluded.value,
                 updated_at = excluded.updated_at"#,
        )
        .bind(rule.vault_id.to_string())
        .bind(rule.enabled)
        .bind(rule.mode.as_str())
        .bind(rule.value.to_string())
        .bind(Utc::now().to_rfc3339())
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn remove_automatic_reserve_rule(&self, vault_id: Uuid) -> Result<(), DbError> {
        sqlx::query("DELETE FROM automatic_reserve_rules WHERE vault_id = ?")
            .bind(vault_id.to_string())
            .execute(self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_dashboard_layout(&self) -> Result<Option<String>, DbError> {
        sqlx::query_scalar("SELECT layout_json FROM dashboard_preferences WHERE id = 1")
            .fetch_optional(self.pool)
            .await
            .map_err(Into::into)
    }

    pub async fn save_dashboard_layout(&self, layout_json: &str) -> Result<(), DbError> {
        sqlx::query(
            r#"INSERT INTO dashboard_preferences (id, layout_json, updated_at) VALUES (1, ?, ?)
               ON CONFLICT(id) DO UPDATE SET layout_json = excluded.layout_json, updated_at = excluded.updated_at"#,
        )
        .bind(layout_json)
        .bind(Utc::now().to_rfc3339())
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn reset_dashboard_layout(&self) -> Result<(), DbError> {
        sqlx::query("DELETE FROM dashboard_preferences WHERE id = 1")
            .execute(self.pool)
            .await?;
        Ok(())
    }

    pub async fn list_digital_wallet_items(&self) -> Result<Vec<DigitalWalletItem>, DbError> {
        let rows = sqlx::query(
            r#"SELECT id, kind, title, issuer, notes, qr_value, file_name, mime_type, file_data_url,
                      expires_at, created_at, updated_at FROM digital_wallet_items ORDER BY updated_at DESC"#,
        )
        .fetch_all(self.pool)
        .await?;
        rows.into_iter().map(row_to_digital_wallet_item).collect()
    }

    pub async fn insert_digital_wallet_item(
        &self,
        item: &DigitalWalletItem,
    ) -> Result<(), DbError> {
        sqlx::query(
            r#"INSERT INTO digital_wallet_items
               (id, kind, title, issuer, notes, qr_value, file_name, mime_type, file_data_url,
                expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(item.id.to_string())
        .bind(item.kind.as_str())
        .bind(&item.title)
        .bind(&item.issuer)
        .bind(&item.notes)
        .bind(&item.qr_value)
        .bind(&item.file_name)
        .bind(&item.mime_type)
        .bind(&item.file_data_url)
        .bind(
            item.expires_at
                .map(|date| date.format("%Y-%m-%d").to_string()),
        )
        .bind(item.created_at.to_rfc3339())
        .bind(item.updated_at.to_rfc3339())
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn delete_digital_wallet_item(&self, id: Uuid) -> Result<(), DbError> {
        let result = sqlx::query("DELETE FROM digital_wallet_items WHERE id = ?")
            .bind(id.to_string())
            .execute(self.pool)
            .await?;
        if result.rows_affected() == 0 {
            return Err(DbError::NotFound("item da carteira"));
        }
        Ok(())
    }

    pub async fn list_monthly_reserve_rules(&self) -> Result<Vec<MonthlyReserveRule>, DbError> {
        let rows = sqlx::query(
            r#"SELECT vault_id, enabled, mode, value, day_of_month, last_processed_period
               FROM monthly_reserve_rules ORDER BY updated_at"#,
        )
        .fetch_all(self.pool)
        .await?;
        rows.into_iter().map(row_to_monthly_reserve_rule).collect()
    }

    pub async fn save_monthly_reserve_rule(
        &self,
        rule: &MonthlyReserveRule,
    ) -> Result<(), DbError> {
        sqlx::query(
            r#"INSERT INTO monthly_reserve_rules
               (vault_id, enabled, mode, value, day_of_month, last_processed_period, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(vault_id) DO UPDATE SET enabled = excluded.enabled, mode = excluded.mode,
                 value = excluded.value, day_of_month = excluded.day_of_month,
                 last_processed_period = excluded.last_processed_period, updated_at = excluded.updated_at"#,
        )
        .bind(rule.vault_id.to_string())
        .bind(rule.enabled)
        .bind(rule.mode.as_str())
        .bind(rule.value.to_string())
        .bind(rule.day_of_month)
        .bind(&rule.last_processed_period)
        .bind(Utc::now().to_rfc3339())
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn remove_monthly_reserve_rule(&self, vault_id: Uuid) -> Result<(), DbError> {
        sqlx::query("DELETE FROM monthly_reserve_rules WHERE vault_id = ?")
            .bind(vault_id.to_string())
            .execute(self.pool)
            .await?;
        Ok(())
    }

    pub async fn process_monthly_reserves(&self, today: NaiveDate) -> Result<u64, DbError> {
        let mut transaction = self.pool.begin().await?;
        let period = format!("{:04}-{:02}", today.year(), today.month());
        let rows = sqlx::query(
            r#"SELECT vault_id, mode, value FROM monthly_reserve_rules
               WHERE enabled = 1 AND day_of_month <= ?
                 AND (last_processed_period IS NULL OR last_processed_period <> ?)
               ORDER BY day_of_month, updated_at"#,
        )
        .bind(today.day() as i64)
        .bind(&period)
        .fetch_all(&mut *transaction)
        .await?;
        let mut processed = 0;
        for row in rows {
            let vault_id =
                Uuid::parse_str(&row.try_get::<String, _>("vault_id")?).map_err(invalid)?;
            let mode_value: String = row.try_get("mode")?;
            let mode = AutomaticReserveMode::parse(&mode_value)
                .ok_or_else(|| DbError::InvalidData(mode_value))?;
            let value = Decimal::from_str(&row.try_get::<String, _>("value")?).map_err(invalid)?;
            let available = available_balance_in_transaction(&mut transaction).await?;
            let desired = match mode {
                AutomaticReserveMode::Fixed => value,
                AutomaticReserveMode::Percentage => available * value / Decimal::from(100u32),
            }
            .round_dp_with_strategy(2, RoundingStrategy::ToZero);
            if desired <= Decimal::ZERO || desired > available {
                continue;
            }
            let current: Option<String> =
                sqlx::query_scalar("SELECT balance FROM vaults WHERE id = ?")
                    .bind(vault_id.to_string())
                    .fetch_optional(&mut *transaction)
                    .await?;
            let Some(current) = current else {
                continue;
            };
            let next = Decimal::from_str(&current).map_err(invalid)? + desired;
            sqlx::query("UPDATE vaults SET balance = ?, updated_at = ? WHERE id = ?")
                .bind(next.to_string())
                .bind(Utc::now().to_rfc3339())
                .bind(vault_id.to_string())
                .execute(&mut *transaction)
                .await?;
            let movement = VaultMovement::new(
                vault_id,
                VaultMovementType::Deposit,
                desired,
                VaultMovementSource::Automatic,
            );
            insert_vault_movement(&mut transaction, &movement).await?;
            sqlx::query("UPDATE monthly_reserve_rules SET last_processed_period = ?, updated_at = ? WHERE vault_id = ?")
                .bind(&period).bind(Utc::now().to_rfc3339()).bind(vault_id.to_string())
                .execute(&mut *transaction).await?;
            processed += 1;
        }
        transaction.commit().await?;
        Ok(processed)
    }

    pub async fn factory_reset(&self) -> Result<(), DbError> {
        let mut transaction = self.pool.begin().await?;
        for table in [
            "app_lock_settings",
            "transactions",
            "recurring_rules",
            "vault_movements",
            "automatic_reserve_rules",
            "monthly_reserve_rules",
            "vaults",
            "debit_cards",
            "digital_wallet_items",
            "dashboard_preferences",
            "account_settings",
            "categories",
        ] {
            sqlx::query(&format!("DELETE FROM {table}"))
                .execute(&mut *transaction)
                .await?;
        }
        sqlx::query(
            r#"INSERT INTO categories (id, kind, name, icon, color, created_at) VALUES
            ('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42801', 'expense', 'Casa', 'house', '#0F766E', CURRENT_TIMESTAMP),
            ('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42802', 'expense', 'Alimentação', 'utensils', '#EA580C', CURRENT_TIMESTAMP),
            ('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42803', 'expense', 'Transporte', 'bus', '#2563EB', CURRENT_TIMESTAMP),
            ('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42804', 'expense', 'Lazer', 'gamepad-2', '#7C3AED', CURRENT_TIMESTAMP),
            ('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42805', 'expense', 'Saúde', 'heart-pulse', '#E11D48', CURRENT_TIMESTAMP),
            ('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42806', 'expense', 'Educação', 'graduation-cap', '#0891B2', CURRENT_TIMESTAMP),
            ('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42807', 'expense', 'Contas', 'receipt-text', '#CA8A04', CURRENT_TIMESTAMP),
            ('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42808', 'expense', 'Compras', 'shopping-bag', '#DB2777', CURRENT_TIMESTAMP),
            ('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42811', 'income', 'Salário', 'badge-dollar-sign', '#059669', CURRENT_TIMESTAMP),
            ('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42812', 'income', 'Freelance', 'laptop', '#0D9488', CURRENT_TIMESTAMP),
            ('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42813', 'income', 'Trabalho extra', 'briefcase-business', '#2563EB', CURRENT_TIMESTAMP),
            ('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42814', 'income', 'Vendas', 'store', '#7C3AED', CURRENT_TIMESTAMP),
            ('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42815', 'income', 'Benefícios', 'gift', '#EA580C', CURRENT_TIMESTAMP),
            ('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42816', 'income', 'Rendimentos', 'trending-up', '#16A34A', CURRENT_TIMESTAMP),
            ('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42817', 'income', 'Outras entradas', 'circle-dollar-sign', '#475569', CURRENT_TIMESTAMP)"#,
        )
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;
        Ok(())
    }

    pub async fn restore_backup(&self, data: &BackupData) -> Result<(), DbError> {
        validate_backup(data)?;
        let mut database_transaction = self.pool.begin().await?;
        for table in [
            "transactions",
            "recurring_rules",
            "vault_movements",
            "automatic_reserve_rules",
            "monthly_reserve_rules",
            "vaults",
            "debit_cards",
            "digital_wallet_items",
            "dashboard_preferences",
            "account_settings",
            "categories",
        ] {
            sqlx::query(&format!("DELETE FROM {table}"))
                .execute(&mut *database_transaction)
                .await?;
        }

        for category in &data.categories {
            sqlx::query("INSERT INTO categories (id, kind, name, icon, color, created_at) VALUES (?, ?, ?, ?, ?, ?)")
                .bind(category.id.to_string()).bind(category.kind.as_str()).bind(&category.name)
                .bind(&category.icon).bind(&category.color).bind(category.created_at.to_rfc3339())
                .execute(&mut *database_transaction).await?;
        }
        for card in &data.debit_cards {
            sqlx::query(
                r#"INSERT INTO debit_cards
                   (id, name, issuer, holder_name, last_four, network, color_from, color_to, pattern,
                    background_image, emoji, is_default, is_frozen, monthly_spending_limit, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
            )
            .bind(card.id.to_string()).bind(&card.name).bind(&card.issuer).bind(&card.holder_name)
            .bind(&card.last_four).bind(card.network.as_str()).bind(&card.color_from).bind(&card.color_to)
            .bind(card.pattern.as_str()).bind(card.background_image.as_str()).bind(&card.emoji)
            .bind(card.is_default).bind(card.is_frozen)
            .bind(card.monthly_spending_limit.map(|value| value.to_string()))
            .bind(card.created_at.to_rfc3339()).execute(&mut *database_transaction).await?;
        }
        for vault in &data.vaults {
            sqlx::query(
                r#"INSERT INTO vaults
                   (id, name, institution, type, balance, target_amount, annual_yield_rate, color, emoji, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
            )
            .bind(vault.id.to_string()).bind(&vault.name).bind(&vault.institution).bind(vault.r#type.as_str())
            .bind(vault.balance.to_string()).bind(vault.target_amount.map(|value| value.to_string()))
            .bind(vault.annual_yield_rate.map(|value| value.to_string())).bind(&vault.color).bind(&vault.emoji)
            .bind(vault.created_at.to_rfc3339()).bind(vault.updated_at.to_rfc3339())
            .execute(&mut *database_transaction).await?;
        }
        for transaction in &data.transactions {
            insert_transaction_record(&mut database_transaction, transaction).await?;
        }
        for movement in &data.vault_movements {
            insert_vault_movement(&mut database_transaction, movement).await?;
        }
        for rule in &data.automatic_reserve_rules {
            sqlx::query("INSERT INTO automatic_reserve_rules (vault_id, enabled, mode, value, updated_at) VALUES (?, ?, ?, ?, ?)")
                .bind(rule.vault_id.to_string()).bind(rule.enabled).bind(rule.mode.as_str())
                .bind(rule.value.to_string()).bind(Utc::now().to_rfc3339())
                .execute(&mut *database_transaction).await?;
        }
        for rule in &data.monthly_reserve_rules {
            sqlx::query(
                r#"INSERT INTO monthly_reserve_rules
                   (vault_id, enabled, mode, value, day_of_month, last_processed_period, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)"#,
            )
            .bind(rule.vault_id.to_string())
            .bind(rule.enabled)
            .bind(rule.mode.as_str())
            .bind(rule.value.to_string())
            .bind(rule.day_of_month)
            .bind(&rule.last_processed_period)
            .bind(Utc::now().to_rfc3339())
            .execute(&mut *database_transaction)
            .await?;
        }
        for item in &data.digital_wallet_items {
            sqlx::query(
                r#"INSERT INTO digital_wallet_items
                   (id, kind, title, issuer, notes, qr_value, file_name, mime_type, file_data_url,
                    expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
            )
            .bind(item.id.to_string()).bind(item.kind.as_str()).bind(&item.title).bind(&item.issuer)
            .bind(&item.notes).bind(&item.qr_value).bind(&item.file_name).bind(&item.mime_type)
            .bind(&item.file_data_url).bind(item.expires_at.map(|date| date.format("%Y-%m-%d").to_string()))
            .bind(item.created_at.to_rfc3339()).bind(item.updated_at.to_rfc3339())
            .execute(&mut *database_transaction).await?;
        }
        for rule in &data.recurring_rules {
            insert_recurring_rule(&mut *database_transaction, rule, false).await?;
        }
        sqlx::query(
            r#"INSERT INTO account_settings
               (id, opening_balance_adjustment, balance_hidden, migrated_at, updated_at)
               VALUES (1, ?, ?, ?, ?)"#,
        )
        .bind(data.account_settings.opening_balance_adjustment.to_string())
        .bind(data.account_settings.balance_hidden)
        .bind(data.account_settings.migrated_at.to_rfc3339())
        .bind(Utc::now().to_rfc3339())
        .execute(&mut *database_transaction)
        .await?;
        sqlx::query(
            "INSERT INTO dashboard_preferences (id, layout_json, updated_at) VALUES (1, ?, ?)",
        )
        .bind(serde_json::to_string(&data.dashboard_layout).map_err(invalid)?)
        .bind(Utc::now().to_rfc3339())
        .execute(&mut *database_transaction)
        .await?;

        database_transaction.commit().await?;
        Ok(())
    }

    pub async fn list_recurring_rules(&self) -> Result<Vec<RecurringRule>, DbError> {
        let rows = sqlx::query(
            r#"SELECT id, kind, amount, day_of_month, category_id, debit_card_id, description,
                      reminder_enabled, auto_process_after_days, active, last_processed_period,
                      next_due_date, created_at, updated_at
               FROM recurring_rules ORDER BY day_of_month, description COLLATE NOCASE"#,
        )
        .fetch_all(self.pool)
        .await?;
        rows.into_iter().map(row_to_recurring_rule).collect()
    }

    pub async fn get_recurring_rule(&self, id: Uuid) -> Result<Option<RecurringRule>, DbError> {
        let row = sqlx::query(
            r#"SELECT id, kind, amount, day_of_month, category_id, debit_card_id, description,
                      reminder_enabled, auto_process_after_days, active, last_processed_period,
                      next_due_date, created_at, updated_at
               FROM recurring_rules WHERE id = ?"#,
        )
        .bind(id.to_string())
        .fetch_optional(self.pool)
        .await?;
        row.map(row_to_recurring_rule).transpose()
    }

    pub async fn insert_recurring_rule(&self, rule: &RecurringRule) -> Result<(), DbError> {
        insert_recurring_rule(self.pool, rule, false).await
    }

    pub async fn update_recurring_rule(&self, rule: &RecurringRule) -> Result<(), DbError> {
        let result = sqlx::query(
            r#"UPDATE recurring_rules SET kind = ?, amount = ?, day_of_month = ?, category_id = ?,
               debit_card_id = ?, description = ?, reminder_enabled = ?, auto_process_after_days = ?,
               active = ?, last_processed_period = ?, next_due_date = ?, updated_at = ? WHERE id = ?"#,
        )
        .bind(rule.kind.as_str())
        .bind(rule.amount.to_string())
        .bind(rule.day_of_month)
        .bind(rule.category_id.to_string())
        .bind(rule.debit_card_id.map(|id| id.to_string()))
        .bind(&rule.description)
        .bind(rule.reminder_enabled)
        .bind(rule.auto_process_after_days)
        .bind(rule.active)
        .bind(&rule.last_processed_period)
        .bind(rule.next_due_date.format("%Y-%m-%d").to_string())
        .bind(Utc::now().to_rfc3339())
        .bind(rule.id.to_string())
        .execute(self.pool)
        .await?;
        if result.rows_affected() == 0 {
            return Err(DbError::NotFound("recorrência"));
        }
        Ok(())
    }

    pub async fn settle_recurring_rule(
        &self,
        transaction_record: &Transaction,
        rule: &RecurringRule,
    ) -> Result<(), DbError> {
        let mut database_transaction = self.pool.begin().await?;
        insert_transaction_record(&mut database_transaction, transaction_record).await?;
        if transaction_record.kind == TransactionType::Income {
            apply_automatic_reserves(&mut database_transaction, transaction_record.amount).await?;
        }

        let result = sqlx::query(
            r#"UPDATE recurring_rules SET last_processed_period = ?, next_due_date = ?, updated_at = ?
               WHERE id = ?"#,
        )
        .bind(&rule.last_processed_period)
        .bind(rule.next_due_date.format("%Y-%m-%d").to_string())
        .bind(rule.updated_at.to_rfc3339())
        .bind(rule.id.to_string())
        .execute(&mut *database_transaction)
        .await?;
        if result.rows_affected() == 0 {
            return Err(DbError::NotFound("recorrência"));
        }

        database_transaction.commit().await?;
        Ok(())
    }

    pub async fn delete_recurring_rule(&self, id: Uuid) -> Result<(), DbError> {
        sqlx::query("DELETE FROM recurring_rules WHERE id = ?")
            .bind(id.to_string())
            .execute(self.pool)
            .await?;
        Ok(())
    }

    pub async fn import_legacy_app_data(&self, data: &LegacyAppData) -> Result<(), DbError> {
        let mut transaction = self.pool.begin().await?;

        if let Some(settings) = &data.account_settings {
            sqlx::query(
                r#"INSERT OR IGNORE INTO account_settings
                   (id, opening_balance_adjustment, balance_hidden, migrated_at, updated_at)
                   VALUES (1, ?, ?, ?, ?)"#,
            )
            .bind(settings.opening_balance_adjustment.to_string())
            .bind(settings.balance_hidden)
            .bind(settings.migrated_at.to_rfc3339())
            .bind(Utc::now().to_rfc3339())
            .execute(&mut *transaction)
            .await?;
        }

        for movement in &data.vault_movements {
            sqlx::query(
                r#"INSERT OR IGNORE INTO vault_movements
                   (id, vault_id, kind, amount, source, occurred_at) VALUES (?, ?, ?, ?, ?, ?)"#,
            )
            .bind(movement.id.to_string())
            .bind(movement.vault_id.to_string())
            .bind(movement.kind.as_str())
            .bind(movement.amount.to_string())
            .bind(movement.source.as_str())
            .bind(movement.occurred_at.to_rfc3339())
            .execute(&mut *transaction)
            .await?;
        }

        for rule in &data.automatic_reserve_rules {
            sqlx::query(
                r#"INSERT OR IGNORE INTO automatic_reserve_rules
                   (vault_id, enabled, mode, value, updated_at) VALUES (?, ?, ?, ?, ?)"#,
            )
            .bind(rule.vault_id.to_string())
            .bind(rule.enabled)
            .bind(rule.mode.as_str())
            .bind(rule.value.to_string())
            .bind(Utc::now().to_rfc3339())
            .execute(&mut *transaction)
            .await?;
        }

        for rule in &data.recurring_rules {
            insert_recurring_rule(&mut *transaction, rule, true).await?;
        }

        transaction.commit().await?;
        Ok(())
    }
}

fn validate_backup(data: &BackupData) -> Result<(), DbError> {
    if data.transactions.len() > 50_000
        || data.categories.len() > 1_000
        || data.debit_cards.len() > 500
        || data.vaults.len() > 1_000
        || data.digital_wallet_items.len() > 1_000
        || data.recurring_rules.len() > 5_000
    {
        return Err(DbError::InvalidOperation(
            "o backup ultrapassa os limites seguros".into(),
        ));
    }
    let categories: HashMap<Uuid, TransactionType> = data
        .categories
        .iter()
        .map(|item| (item.id, item.kind))
        .collect();
    if categories.len() != data.categories.len()
        || data.categories.iter().any(|item| {
            item.name.trim().is_empty() || item.color.len() != 7 || !item.color.starts_with('#')
        })
    {
        return Err(DbError::InvalidOperation(
            "o backup contém categorias inválidas".into(),
        ));
    }
    let cards: HashSet<Uuid> = data.debit_cards.iter().map(|item| item.id).collect();
    if cards.len() != data.debit_cards.len()
        || data
            .debit_cards
            .iter()
            .filter(|item| item.is_default)
            .count()
            > 1
        || data.debit_cards.iter().any(|item| {
            item.last_four.len() != 4
                || item
                    .monthly_spending_limit
                    .is_some_and(|value| value <= Decimal::ZERO)
        })
    {
        return Err(DbError::InvalidOperation(
            "o backup contém cartões inválidos".into(),
        ));
    }
    let vaults: HashSet<Uuid> = data.vaults.iter().map(|item| item.id).collect();
    if vaults.len() != data.vaults.len()
        || data.vaults.iter().any(|item| {
            item.balance < Decimal::ZERO
                || item.name.trim().is_empty()
                || item
                    .target_amount
                    .is_some_and(|value| value <= Decimal::ZERO)
        })
    {
        return Err(DbError::InvalidOperation(
            "o backup contém Porquinhos inválidos".into(),
        ));
    }
    let mut transaction_ids = HashSet::new();
    let mut net = data.account_settings.opening_balance_adjustment;
    for item in &data.transactions {
        if !transaction_ids.insert(item.id)
            || item.amount <= Decimal::ZERO
            || item.description.trim().is_empty()
            || item
                .occurred_at
                .is_some_and(|value| value.date() != item.date)
            || item.category_id.and_then(|id| categories.get(&id).copied()) != Some(item.kind)
            || item.debit_card_id.is_some_and(|id| !cards.contains(&id))
            || (item.kind == TransactionType::Income && item.debit_card_id.is_some())
        {
            return Err(DbError::InvalidOperation(
                "o backup contém transações inválidas".into(),
            ));
        }
        net += if item.kind == TransactionType::Income {
            item.amount
        } else {
            -item.amount
        };
    }
    net -= data.vaults.iter().map(|item| item.balance).sum::<Decimal>();
    if net < Decimal::ZERO {
        return Err(DbError::InvalidOperation(
            "o backup deixaria o saldo disponível negativo".into(),
        ));
    }
    if data
        .vault_movements
        .iter()
        .any(|item| !vaults.contains(&item.vault_id) || item.amount <= Decimal::ZERO)
        || data
            .automatic_reserve_rules
            .iter()
            .any(|item| !vaults.contains(&item.vault_id) || item.validate().is_err())
        || data
            .monthly_reserve_rules
            .iter()
            .any(|item| !vaults.contains(&item.vault_id) || item.validate().is_err())
        || data.recurring_rules.iter().any(|item| {
            item.validate().is_err()
                || categories.get(&item.category_id).copied() != Some(item.kind)
                || item.debit_card_id.is_some_and(|id| !cards.contains(&id))
        })
        || data.digital_wallet_items.iter().any(|item| {
            item.title.trim().is_empty()
                || item
                    .file_data_url
                    .as_ref()
                    .is_some_and(|value| value.len() > 4_200_000)
        })
    {
        return Err(DbError::InvalidOperation(
            "o backup contém vínculos ou automações inválidas".into(),
        ));
    }
    Ok(())
}

async fn insert_vault_movement(
    transaction: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    movement: &VaultMovement,
) -> Result<(), DbError> {
    sqlx::query(
        r#"INSERT INTO vault_movements (id, vault_id, kind, amount, source, occurred_at)
           VALUES (?, ?, ?, ?, ?, ?)"#,
    )
    .bind(movement.id.to_string())
    .bind(movement.vault_id.to_string())
    .bind(movement.kind.as_str())
    .bind(movement.amount.to_string())
    .bind(movement.source.as_str())
    .bind(movement.occurred_at.to_rfc3339())
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

async fn insert_transaction_record(
    transaction: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    record: &Transaction,
) -> Result<(), DbError> {
    sqlx::query(
        r#"INSERT INTO transactions
           (id, kind, amount, date, occurred_at, category_id, debit_card_id, description, recurrence, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(record.id.to_string())
    .bind(record.kind.as_str())
    .bind(record.amount.to_string())
    .bind(record.date.format("%Y-%m-%d").to_string())
    .bind(record.occurred_at.map(|value| value.format("%Y-%m-%dT%H:%M:%S").to_string()))
    .bind(record.category_id.map(|id| id.to_string()))
    .bind(record.debit_card_id.map(|id| id.to_string()))
    .bind(&record.description)
    .bind(record.recurrence.as_str())
    .bind(record.created_at.to_rfc3339())
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

async fn apply_automatic_reserves(
    transaction: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    income: Decimal,
) -> Result<(), DbError> {
    let adjustment: Option<String> =
        sqlx::query_scalar("SELECT opening_balance_adjustment FROM account_settings WHERE id = 1")
            .fetch_optional(&mut **transaction)
            .await?;
    let adjustment = adjustment
        .map(|value| Decimal::from_str(&value).map_err(invalid))
        .transpose()?
        .unwrap_or(Decimal::ZERO);

    let transaction_rows = sqlx::query("SELECT kind, amount FROM transactions")
        .fetch_all(&mut **transaction)
        .await?;
    let transaction_total =
        transaction_rows
            .into_iter()
            .try_fold(Decimal::ZERO, |total, row| {
                let kind: String = row.try_get("kind")?;
                let amount: String = row.try_get("amount")?;
                let amount = Decimal::from_str(&amount).map_err(invalid)?;
                match TransactionType::parse(&kind) {
                    Some(TransactionType::Income) => Ok(total + amount),
                    Some(TransactionType::Expense) => Ok(total - amount),
                    None => Err(DbError::InvalidData(kind)),
                }
            })?;

    let vault_rows = sqlx::query("SELECT id, balance FROM vaults")
        .fetch_all(&mut **transaction)
        .await?;
    let mut vault_balances = std::collections::HashMap::new();
    let mut vault_total = Decimal::ZERO;
    for row in vault_rows {
        let id: String = row.try_get("id")?;
        let balance: String = row.try_get("balance")?;
        let id = Uuid::parse_str(&id).map_err(invalid)?;
        let balance = Decimal::from_str(&balance).map_err(invalid)?;
        vault_total += balance;
        vault_balances.insert(id, balance);
    }

    let mut available = adjustment + transaction_total - vault_total;
    if available <= Decimal::ZERO {
        return Ok(());
    }
    let mut remaining_income = income;

    let rule_rows = sqlx::query(
        r#"SELECT vault_id, mode, value FROM automatic_reserve_rules
           WHERE enabled = 1 ORDER BY updated_at, vault_id"#,
    )
    .fetch_all(&mut **transaction)
    .await?;

    for row in rule_rows {
        let vault_id: String = row.try_get("vault_id")?;
        let mode: String = row.try_get("mode")?;
        let value: String = row.try_get("value")?;
        let vault_id = Uuid::parse_str(&vault_id).map_err(invalid)?;
        let Some(current_balance) = vault_balances.get(&vault_id).copied() else {
            continue;
        };
        let mode =
            AutomaticReserveMode::parse(&mode).ok_or_else(|| DbError::InvalidData(mode.clone()))?;
        let value = Decimal::from_str(&value).map_err(invalid)?;
        let desired = match mode {
            AutomaticReserveMode::Fixed => value,
            AutomaticReserveMode::Percentage => income * value / Decimal::from(100u32),
        }
        .round_dp_with_strategy(2, RoundingStrategy::ToZero);
        let amount = desired.min(available).min(remaining_income);
        if amount <= Decimal::ZERO {
            continue;
        }

        let updated_at = Utc::now();
        let next_balance = current_balance + amount;
        sqlx::query("UPDATE vaults SET balance = ?, updated_at = ? WHERE id = ?")
            .bind(next_balance.to_string())
            .bind(updated_at.to_rfc3339())
            .bind(vault_id.to_string())
            .execute(&mut **transaction)
            .await?;
        let movement = VaultMovement::new(
            vault_id,
            VaultMovementType::Deposit,
            amount,
            VaultMovementSource::Automatic,
        );
        insert_vault_movement(transaction, &movement).await?;
        vault_balances.insert(vault_id, next_balance);
        available -= amount;
        remaining_income -= amount;
        if available <= Decimal::ZERO || remaining_income <= Decimal::ZERO {
            break;
        }
    }
    Ok(())
}

async fn available_balance_in_transaction(
    transaction: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
) -> Result<Decimal, DbError> {
    let adjustment: Option<String> =
        sqlx::query_scalar("SELECT opening_balance_adjustment FROM account_settings WHERE id = 1")
            .fetch_optional(&mut **transaction)
            .await?;
    let adjustment = adjustment
        .map(|value| Decimal::from_str(&value).map_err(invalid))
        .transpose()?
        .unwrap_or(Decimal::ZERO);
    let rows = sqlx::query("SELECT kind, amount FROM transactions")
        .fetch_all(&mut **transaction)
        .await?;
    let transaction_total = rows.into_iter().try_fold(Decimal::ZERO, |total, row| {
        let kind: String = row.try_get("kind")?;
        let amount = Decimal::from_str(&row.try_get::<String, _>("amount")?).map_err(invalid)?;
        match TransactionType::parse(&kind) {
            Some(TransactionType::Income) => Ok(total + amount),
            Some(TransactionType::Expense) => Ok(total - amount),
            None => Err(DbError::InvalidData(kind)),
        }
    })?;
    let vault_rows = sqlx::query("SELECT balance FROM vaults")
        .fetch_all(&mut **transaction)
        .await?;
    let vault_total = vault_rows
        .into_iter()
        .try_fold(Decimal::ZERO, |total, row| {
            let balance =
                Decimal::from_str(&row.try_get::<String, _>("balance")?).map_err(invalid)?;
            Ok::<Decimal, DbError>(total + balance)
        })?;
    Ok(adjustment + transaction_total - vault_total)
}

async fn insert_recurring_rule<'e, E>(
    executor: E,
    rule: &RecurringRule,
    ignore_existing: bool,
) -> Result<(), DbError>
where
    E: sqlx::Executor<'e, Database = sqlx::Sqlite>,
{
    let verb = if ignore_existing {
        "INSERT OR IGNORE"
    } else {
        "INSERT"
    };
    let query = format!(
        r#"{verb} INTO recurring_rules
           (id, kind, amount, day_of_month, category_id, debit_card_id, description,
            reminder_enabled, auto_process_after_days, active, last_processed_period,
            next_due_date, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
    );
    sqlx::query(&query)
        .bind(rule.id.to_string())
        .bind(rule.kind.as_str())
        .bind(rule.amount.to_string())
        .bind(rule.day_of_month)
        .bind(rule.category_id.to_string())
        .bind(rule.debit_card_id.map(|id| id.to_string()))
        .bind(&rule.description)
        .bind(rule.reminder_enabled)
        .bind(rule.auto_process_after_days)
        .bind(rule.active)
        .bind(&rule.last_processed_period)
        .bind(rule.next_due_date.format("%Y-%m-%d").to_string())
        .bind(rule.created_at.to_rfc3339())
        .bind(rule.updated_at.to_rfc3339())
        .execute(executor)
        .await?;
    Ok(())
}

fn row_to_transaction(row: sqlx::sqlite::SqliteRow) -> Result<Transaction, DbError> {
    let id: String = row.try_get("id")?;
    let kind: String = row.try_get("kind")?;
    let amount: String = row.try_get("amount")?;
    let date: String = row.try_get("date")?;
    let occurred_at: Option<String> = row.try_get("occurred_at")?;
    let category_id: Option<String> = row.try_get("category_id")?;
    let debit_card_id: Option<String> = row.try_get("debit_card_id")?;
    let created_at: String = row.try_get("created_at")?;
    let recurrence: String = row.try_get("recurrence")?;

    Ok(Transaction {
        id: Uuid::parse_str(&id).map_err(invalid)?,
        kind: TransactionType::parse(&kind).ok_or_else(|| DbError::InvalidData(kind.clone()))?,
        amount: Decimal::from_str(&amount).map_err(invalid)?,
        date: NaiveDate::parse_from_str(&date, "%Y-%m-%d").map_err(invalid)?,
        occurred_at: occurred_at
            .map(|value| {
                NaiveDateTime::parse_from_str(&value, "%Y-%m-%dT%H:%M:%S").map_err(invalid)
            })
            .transpose()?,
        category_id: category_id
            .map(|value| Uuid::parse_str(&value).map_err(invalid))
            .transpose()?,
        debit_card_id: debit_card_id
            .map(|value| Uuid::parse_str(&value).map_err(invalid))
            .transpose()?,
        description: row.try_get("description")?,
        recurrence: RecurrenceType::parse(&recurrence)
            .ok_or_else(|| DbError::InvalidData(recurrence.clone()))?,
        created_at: DateTime::parse_from_rfc3339(&created_at)
            .map_err(invalid)?
            .with_timezone(&Utc),
    })
}

fn row_to_category(row: sqlx::sqlite::SqliteRow) -> Result<Category, DbError> {
    let id: String = row.try_get("id")?;
    let kind: String = row.try_get("kind")?;
    let created_at: String = row.try_get("created_at")?;

    let created_at = DateTime::parse_from_rfc3339(&created_at)
        .map(|value| value.with_timezone(&Utc))
        .or_else(|_| {
            chrono::NaiveDateTime::parse_from_str(&created_at, "%Y-%m-%d %H:%M:%S")
                .map(|value| DateTime::<Utc>::from_naive_utc_and_offset(value, Utc))
        })
        .map_err(invalid)?;

    Ok(Category {
        id: Uuid::parse_str(&id).map_err(invalid)?,
        kind: TransactionType::parse(&kind).ok_or_else(|| DbError::InvalidData(kind.clone()))?,
        name: row.try_get("name")?,
        icon: row.try_get("icon")?,
        color: row.try_get("color")?,
        created_at,
    })
}

fn row_to_debit_card(row: sqlx::sqlite::SqliteRow) -> Result<DebitCard, DbError> {
    let id: String = row.try_get("id")?;
    let network: String = row.try_get("network")?;
    let pattern: String = row.try_get("pattern")?;
    let background_image: String = row.try_get("background_image")?;
    let limit: Option<String> = row.try_get("monthly_spending_limit")?;
    let created_at: String = row.try_get("created_at")?;

    Ok(DebitCard {
        id: Uuid::parse_str(&id).map_err(invalid)?,
        name: row.try_get("name")?,
        issuer: row.try_get("issuer")?,
        holder_name: row.try_get("holder_name")?,
        last_four: row.try_get("last_four")?,
        network: CardNetwork::parse(&network)
            .ok_or_else(|| DbError::InvalidData(network.clone()))?,
        color_from: row.try_get("color_from")?,
        color_to: row.try_get("color_to")?,
        pattern: CardPattern::parse(&pattern)
            .ok_or_else(|| DbError::InvalidData(pattern.clone()))?,
        background_image: CardBackground::parse(&background_image)
            .ok_or_else(|| DbError::InvalidData(background_image.clone()))?,
        emoji: row.try_get("emoji")?,
        is_default: row.try_get("is_default")?,
        is_frozen: row.try_get("is_frozen")?,
        monthly_spending_limit: limit
            .map(|value| Decimal::from_str(&value).map_err(invalid))
            .transpose()?,
        created_at: DateTime::parse_from_rfc3339(&created_at)
            .map_err(invalid)?
            .with_timezone(&Utc),
    })
}

fn row_to_vault(row: sqlx::sqlite::SqliteRow) -> Result<Vault, DbError> {
    let id: String = row.try_get("id")?;
    let vault_type: String = row.try_get("type")?;
    let balance: String = row.try_get("balance")?;
    let target_amount: Option<String> = row.try_get("target_amount")?;
    let annual_yield_rate: Option<String> = row.try_get("annual_yield_rate")?;
    let created_at: String = row.try_get("created_at")?;
    let updated_at: String = row.try_get("updated_at")?;

    Ok(Vault {
        id: Uuid::parse_str(&id).map_err(invalid)?,
        name: row.try_get("name")?,
        institution: row.try_get("institution")?,
        r#type: VaultType::parse(&vault_type)
            .ok_or_else(|| DbError::InvalidData(vault_type.clone()))?,
        balance: Decimal::from_str(&balance).map_err(invalid)?,
        target_amount: target_amount
            .map(|value| Decimal::from_str(&value).map_err(invalid))
            .transpose()?,
        annual_yield_rate: annual_yield_rate
            .map(|value| Decimal::from_str(&value).map_err(invalid))
            .transpose()?,
        color: row.try_get("color")?,
        emoji: row.try_get("emoji")?,
        created_at: DateTime::parse_from_rfc3339(&created_at)
            .map_err(invalid)?
            .with_timezone(&Utc),
        updated_at: DateTime::parse_from_rfc3339(&updated_at)
            .map_err(invalid)?
            .with_timezone(&Utc),
    })
}

fn row_to_account_settings(row: sqlx::sqlite::SqliteRow) -> Result<AccountSettings, DbError> {
    let adjustment: String = row.try_get("opening_balance_adjustment")?;
    let migrated_at: String = row.try_get("migrated_at")?;
    Ok(AccountSettings {
        opening_balance_adjustment: Decimal::from_str(&adjustment).map_err(invalid)?,
        balance_hidden: row.try_get("balance_hidden")?,
        migrated_at: parse_datetime(&migrated_at)?,
    })
}

fn row_to_vault_movement(row: sqlx::sqlite::SqliteRow) -> Result<VaultMovement, DbError> {
    let id: String = row.try_get("id")?;
    let vault_id: String = row.try_get("vault_id")?;
    let kind: String = row.try_get("kind")?;
    let amount: String = row.try_get("amount")?;
    let source: String = row.try_get("source")?;
    let occurred_at: String = row.try_get("occurred_at")?;
    Ok(VaultMovement {
        id: Uuid::parse_str(&id).map_err(invalid)?,
        vault_id: Uuid::parse_str(&vault_id).map_err(invalid)?,
        kind: VaultMovementType::parse(&kind).ok_or_else(|| DbError::InvalidData(kind.clone()))?,
        amount: Decimal::from_str(&amount).map_err(invalid)?,
        source: VaultMovementSource::parse(&source)
            .ok_or_else(|| DbError::InvalidData(source.clone()))?,
        occurred_at: parse_datetime(&occurred_at)?,
    })
}

fn row_to_automatic_reserve_rule(
    row: sqlx::sqlite::SqliteRow,
) -> Result<AutomaticReserveRule, DbError> {
    let vault_id: String = row.try_get("vault_id")?;
    let mode: String = row.try_get("mode")?;
    let value: String = row.try_get("value")?;
    Ok(AutomaticReserveRule {
        vault_id: Uuid::parse_str(&vault_id).map_err(invalid)?,
        enabled: row.try_get("enabled")?,
        mode: AutomaticReserveMode::parse(&mode)
            .ok_or_else(|| DbError::InvalidData(mode.clone()))?,
        value: Decimal::from_str(&value).map_err(invalid)?,
    })
}

fn row_to_monthly_reserve_rule(
    row: sqlx::sqlite::SqliteRow,
) -> Result<MonthlyReserveRule, DbError> {
    let vault_id: String = row.try_get("vault_id")?;
    let mode: String = row.try_get("mode")?;
    let value: String = row.try_get("value")?;
    Ok(MonthlyReserveRule {
        vault_id: Uuid::parse_str(&vault_id).map_err(invalid)?,
        enabled: row.try_get("enabled")?,
        mode: AutomaticReserveMode::parse(&mode).ok_or_else(|| DbError::InvalidData(mode))?,
        value: Decimal::from_str(&value).map_err(invalid)?,
        day_of_month: row.try_get("day_of_month")?,
        last_processed_period: row.try_get("last_processed_period")?,
    })
}

fn row_to_digital_wallet_item(row: sqlx::sqlite::SqliteRow) -> Result<DigitalWalletItem, DbError> {
    let id: String = row.try_get("id")?;
    let kind: String = row.try_get("kind")?;
    let expires_at: Option<String> = row.try_get("expires_at")?;
    let created_at: String = row.try_get("created_at")?;
    let updated_at: String = row.try_get("updated_at")?;
    Ok(DigitalWalletItem {
        id: Uuid::parse_str(&id).map_err(invalid)?,
        kind: DigitalWalletItemKind::parse(&kind).ok_or_else(|| DbError::InvalidData(kind))?,
        title: row.try_get("title")?,
        issuer: row.try_get("issuer")?,
        notes: row.try_get("notes")?,
        qr_value: row.try_get("qr_value")?,
        file_name: row.try_get("file_name")?,
        mime_type: row.try_get("mime_type")?,
        file_data_url: row.try_get("file_data_url")?,
        expires_at: expires_at
            .map(|value| NaiveDate::parse_from_str(&value, "%Y-%m-%d").map_err(invalid))
            .transpose()?,
        created_at: parse_datetime(&created_at)?,
        updated_at: parse_datetime(&updated_at)?,
    })
}

fn row_to_recurring_rule(row: sqlx::sqlite::SqliteRow) -> Result<RecurringRule, DbError> {
    let id: String = row.try_get("id")?;
    let kind: String = row.try_get("kind")?;
    let amount: String = row.try_get("amount")?;
    let category_id: String = row.try_get("category_id")?;
    let debit_card_id: Option<String> = row.try_get("debit_card_id")?;
    let next_due_date: String = row.try_get("next_due_date")?;
    let created_at: String = row.try_get("created_at")?;
    let updated_at: String = row.try_get("updated_at")?;
    Ok(RecurringRule {
        id: Uuid::parse_str(&id).map_err(invalid)?,
        kind: TransactionType::parse(&kind).ok_or_else(|| DbError::InvalidData(kind.clone()))?,
        amount: Decimal::from_str(&amount).map_err(invalid)?,
        day_of_month: row.try_get("day_of_month")?,
        category_id: Uuid::parse_str(&category_id).map_err(invalid)?,
        debit_card_id: debit_card_id
            .map(|value| Uuid::parse_str(&value).map_err(invalid))
            .transpose()?,
        description: row.try_get("description")?,
        reminder_enabled: row.try_get("reminder_enabled")?,
        auto_process_after_days: row.try_get("auto_process_after_days")?,
        active: row.try_get("active")?,
        last_processed_period: row.try_get("last_processed_period")?,
        next_due_date: NaiveDate::parse_from_str(&next_due_date, "%Y-%m-%d").map_err(invalid)?,
        created_at: parse_datetime(&created_at)?,
        updated_at: parse_datetime(&updated_at)?,
    })
}

fn parse_datetime(value: &str) -> Result<DateTime<Utc>, DbError> {
    DateTime::parse_from_rfc3339(value)
        .map(|date| date.with_timezone(&Utc))
        .or_else(|_| {
            chrono::NaiveDateTime::parse_from_str(value, "%Y-%m-%d %H:%M:%S")
                .map(|date| DateTime::<Utc>::from_naive_utc_and_offset(date, Utc))
        })
        .map_err(invalid)
}

fn invalid(error: impl std::fmt::Display) -> DbError {
    DbError::InvalidData(error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{
        AutomaticReserveMode, NewCategory, NewTransaction, NewVault, RecurrenceType,
        TransactionType, VaultType,
    };
    use rust_decimal_macros::dec;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn test_pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        pool
    }

    fn category(kind: TransactionType, name: &str) -> Category {
        Category::new(NewCategory {
            kind,
            name: name.into(),
            icon: "tag".into(),
            color: "#10B981".into(),
        })
        .unwrap()
    }

    #[tokio::test]
    async fn categories_are_unique_within_each_transaction_kind() {
        let pool = test_pool().await;
        let repository = FinanceRepository::new(&pool);
        repository
            .insert_category(&category(TransactionType::Expense, "Outros"))
            .await
            .unwrap();
        repository
            .insert_category(&category(TransactionType::Income, "Outros"))
            .await
            .unwrap();

        assert!(repository
            .category_name_exists(TransactionType::Expense, "outros")
            .await
            .unwrap());
        assert_eq!(repository.list_categories().await.unwrap().len(), 17);
    }

    #[tokio::test]
    async fn account_and_vault_state_produce_a_precise_available_balance() {
        let pool = test_pool().await;
        let repository = FinanceRepository::new(&pool);
        let income_category = repository
            .list_categories()
            .await
            .unwrap()
            .into_iter()
            .find(|item| item.kind == TransactionType::Income)
            .unwrap();
        repository
            .save_account_settings(&AccountSettings {
                opening_balance_adjustment: dec!(50),
                balance_hidden: true,
                migrated_at: Utc::now(),
            })
            .await
            .unwrap();
        let income = Transaction::new(NewTransaction {
            kind: TransactionType::Income,
            amount: dec!(150),
            date: NaiveDate::from_ymd_opt(2026, 8, 13).unwrap(),
            occurred_at: None,
            category_id: Some(income_category.id),
            debit_card_id: None,
            description: "Salário".into(),
            recurrence: RecurrenceType::Variable,
        })
        .unwrap();
        repository.insert_transaction(&income).await.unwrap();
        let vault = Vault::new(NewVault {
            name: "Reserva".into(),
            institution: "Inter".into(),
            r#type: VaultType::PiggyBank,
            initial_balance: dec!(80),
            target_amount: Some(dec!(500)),
            annual_yield_rate: None,
            color: "#F97316".into(),
            emoji: Some("🐷".into()),
        })
        .unwrap();
        repository.insert_vault(&vault).await.unwrap();

        assert_eq!(repository.available_balance().await.unwrap(), dec!(120));
        assert_eq!(repository.list_vault_movements().await.unwrap().len(), 1);
        assert!(
            repository
                .get_account_settings()
                .await
                .unwrap()
                .unwrap()
                .balance_hidden
        );
    }

    #[tokio::test]
    async fn automatic_reserve_rules_survive_a_repository_reload() {
        let pool = test_pool().await;
        let repository = FinanceRepository::new(&pool);
        let vault = Vault::new(NewVault {
            name: "Viagem".into(),
            institution: "Nubank".into(),
            r#type: VaultType::Box,
            initial_balance: Decimal::ZERO,
            target_amount: None,
            annual_yield_rate: None,
            color: "#8B5CF6".into(),
            emoji: None,
        })
        .unwrap();
        repository.insert_vault(&vault).await.unwrap();
        repository
            .save_automatic_reserve_rule(&AutomaticReserveRule {
                vault_id: vault.id,
                enabled: true,
                mode: AutomaticReserveMode::Percentage,
                value: dec!(20),
            })
            .await
            .unwrap();

        let rules = FinanceRepository::new(&pool)
            .list_automatic_reserve_rules()
            .await
            .unwrap();
        assert_eq!(rules.len(), 1);
        assert_eq!(rules[0].value, dec!(20));
    }

    #[tokio::test]
    async fn income_reserves_are_atomic_and_capped_to_the_received_amount() {
        let pool = test_pool().await;
        let repository = FinanceRepository::new(&pool);
        repository
            .save_account_settings(&AccountSettings {
                opening_balance_adjustment: Decimal::ZERO,
                balance_hidden: false,
                migrated_at: Utc::now(),
            })
            .await
            .unwrap();
        let vault = Vault::new(NewVault {
            name: "Reserva".into(),
            institution: "Inter".into(),
            r#type: VaultType::PiggyBank,
            initial_balance: Decimal::ZERO,
            target_amount: None,
            annual_yield_rate: None,
            color: "#10B981".into(),
            emoji: Some("🐷".into()),
        })
        .unwrap();
        repository.insert_vault(&vault).await.unwrap();
        repository
            .save_automatic_reserve_rule(&AutomaticReserveRule {
                vault_id: vault.id,
                enabled: true,
                mode: AutomaticReserveMode::Percentage,
                value: dec!(20),
            })
            .await
            .unwrap();
        let category = repository
            .list_categories()
            .await
            .unwrap()
            .into_iter()
            .find(|item| item.kind == TransactionType::Income)
            .unwrap();
        let income = Transaction::new(NewTransaction {
            kind: TransactionType::Income,
            amount: dec!(100),
            date: NaiveDate::from_ymd_opt(2026, 8, 13).unwrap(),
            occurred_at: None,
            category_id: Some(category.id),
            debit_card_id: None,
            description: "Salário".into(),
            recurrence: RecurrenceType::Variable,
        })
        .unwrap();

        repository.insert_transaction(&income).await.unwrap();

        assert_eq!(
            repository
                .get_vault(vault.id)
                .await
                .unwrap()
                .unwrap()
                .balance,
            dec!(20)
        );
        assert_eq!(repository.available_balance().await.unwrap(), dec!(80));
        let movements = repository.list_vault_movements().await.unwrap();
        assert_eq!(movements.len(), 1);
        assert_eq!(movements[0].source, VaultMovementSource::Automatic);

        repository
            .save_automatic_reserve_rule(&AutomaticReserveRule {
                vault_id: vault.id,
                enabled: true,
                mode: AutomaticReserveMode::Percentage,
                value: dec!(80),
            })
            .await
            .unwrap();
        let second_vault = Vault::new(NewVault {
            name: "Viagem".into(),
            institution: "Nubank".into(),
            r#type: VaultType::Box,
            initial_balance: Decimal::ZERO,
            target_amount: None,
            annual_yield_rate: None,
            color: "#8B5CF6".into(),
            emoji: None,
        })
        .unwrap();
        repository.insert_vault(&second_vault).await.unwrap();
        repository
            .save_automatic_reserve_rule(&AutomaticReserveRule {
                vault_id: second_vault.id,
                enabled: true,
                mode: AutomaticReserveMode::Percentage,
                value: dec!(80),
            })
            .await
            .unwrap();
        let second_income = Transaction::new(NewTransaction {
            kind: TransactionType::Income,
            amount: dec!(100),
            date: NaiveDate::from_ymd_opt(2026, 8, 14).unwrap(),
            occurred_at: None,
            category_id: Some(category.id),
            debit_card_id: None,
            description: "Freelance".into(),
            recurrence: RecurrenceType::Variable,
        })
        .unwrap();

        repository.insert_transaction(&second_income).await.unwrap();

        let reserved_total = repository
            .list_vaults()
            .await
            .unwrap()
            .into_iter()
            .fold(Decimal::ZERO, |total, item| total + item.balance);
        assert_eq!(reserved_total, dec!(120));
        assert_eq!(repository.available_balance().await.unwrap(), dec!(80));
    }

    #[tokio::test]
    async fn monthly_reserve_runs_once_per_period_after_the_selected_day() {
        let pool = test_pool().await;
        let repository = FinanceRepository::new(&pool);
        repository
            .save_account_settings(&AccountSettings {
                opening_balance_adjustment: dec!(100),
                balance_hidden: false,
                migrated_at: Utc::now(),
            })
            .await
            .unwrap();
        let vault = Vault::new(NewVault {
            name: "Emergência".into(),
            institution: "Local".into(),
            r#type: VaultType::PiggyBank,
            initial_balance: Decimal::ZERO,
            target_amount: None,
            annual_yield_rate: None,
            color: "#10B981".into(),
            emoji: None,
        })
        .unwrap();
        repository.insert_vault(&vault).await.unwrap();
        repository
            .save_monthly_reserve_rule(&MonthlyReserveRule {
                vault_id: vault.id,
                enabled: true,
                mode: AutomaticReserveMode::Fixed,
                value: dec!(25),
                day_of_month: 10,
                last_processed_period: None,
            })
            .await
            .unwrap();

        assert_eq!(
            repository
                .process_monthly_reserves(NaiveDate::from_ymd_opt(2026, 8, 9).unwrap())
                .await
                .unwrap(),
            0
        );
        assert_eq!(
            repository
                .process_monthly_reserves(NaiveDate::from_ymd_opt(2026, 8, 10).unwrap())
                .await
                .unwrap(),
            1
        );
        assert_eq!(
            repository
                .process_monthly_reserves(NaiveDate::from_ymd_opt(2026, 8, 20).unwrap())
                .await
                .unwrap(),
            0
        );
        assert_eq!(
            repository
                .get_vault(vault.id)
                .await
                .unwrap()
                .unwrap()
                .balance,
            dec!(25)
        );
        assert_eq!(repository.available_balance().await.unwrap(), dec!(75));
        assert_eq!(
            repository.list_monthly_reserve_rules().await.unwrap()[0]
                .last_processed_period
                .as_deref(),
            Some("2026-08")
        );
    }

    #[tokio::test]
    async fn factory_reset_deletes_user_data_and_restores_default_categories() {
        let pool = test_pool().await;
        let repository = FinanceRepository::new(&pool);
        let custom = category(TransactionType::Expense, "Personalizada");
        repository.insert_category(&custom).await.unwrap();
        repository
            .save_dashboard_layout(r#"{"widgets":[]}"#)
            .await
            .unwrap();
        sqlx::query("INSERT INTO account_settings (id, opening_balance_adjustment, balance_hidden, migrated_at, updated_at) VALUES (1, '100', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)")
            .execute(&pool).await.unwrap();

        repository.factory_reset().await.unwrap();

        assert_eq!(repository.list_categories().await.unwrap().len(), 15);
        assert!(!repository
            .category_name_exists(TransactionType::Expense, "Personalizada")
            .await
            .unwrap());
        assert!(repository.get_dashboard_layout().await.unwrap().is_none());
        assert!(repository.get_account_settings().await.unwrap().is_none());
    }

    #[tokio::test]
    async fn statement_import_reconciles_balance_without_triggering_reserves() {
        let pool = test_pool().await;
        let repository = FinanceRepository::new(&pool);
        let categories = repository.list_categories().await.unwrap();
        let income_category = categories
            .iter()
            .find(|item| item.kind == TransactionType::Income)
            .unwrap();
        let expense_category = categories
            .iter()
            .find(|item| item.kind == TransactionType::Expense)
            .unwrap();
        let vault = Vault::new(NewVault {
            name: "Reserva".into(),
            institution: "Inter".into(),
            r#type: VaultType::PiggyBank,
            initial_balance: Decimal::ZERO,
            target_amount: None,
            annual_yield_rate: None,
            color: "#10B981".into(),
            emoji: None,
        })
        .unwrap();
        repository.insert_vault(&vault).await.unwrap();
        repository
            .save_automatic_reserve_rule(&AutomaticReserveRule {
                vault_id: vault.id,
                enabled: true,
                mode: AutomaticReserveMode::Percentage,
                value: dec!(50),
            })
            .await
            .unwrap();
        let records = vec![
            Transaction::new(NewTransaction {
                kind: TransactionType::Income,
                amount: dec!(100),
                date: NaiveDate::from_ymd_opt(2026, 8, 7).unwrap(),
                occurred_at: NaiveDate::from_ymd_opt(2026, 8, 7)
                    .unwrap()
                    .and_hms_opt(12, 34, 56),
                category_id: Some(income_category.id),
                debit_card_id: None,
                description: "Pix recebido".into(),
                recurrence: RecurrenceType::Variable,
            })
            .unwrap(),
            Transaction::new(NewTransaction {
                kind: TransactionType::Expense,
                amount: dec!(20),
                date: NaiveDate::from_ymd_opt(2026, 8, 7).unwrap(),
                occurred_at: None,
                category_id: Some(expense_category.id),
                debit_card_id: None,
                description: "Pix enviado".into(),
                recurrence: RecurrenceType::Variable,
            })
            .unwrap(),
        ];

        repository
            .import_transactions(&records, Some(dec!(80)))
            .await
            .unwrap();

        assert_eq!(repository.available_balance().await.unwrap(), dec!(80));
        let stored = repository.list_transactions().await.unwrap();
        assert_eq!(stored[0].occurred_at, records[0].occurred_at);
        assert_eq!(
            repository
                .get_vault(vault.id)
                .await
                .unwrap()
                .unwrap()
                .balance,
            dec!(0)
        );
        assert!(repository.list_vault_movements().await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn statement_import_rolls_back_when_it_would_leave_a_negative_balance() {
        let pool = test_pool().await;
        let repository = FinanceRepository::new(&pool);
        let category = repository
            .list_categories()
            .await
            .unwrap()
            .into_iter()
            .find(|item| item.kind == TransactionType::Expense)
            .unwrap();
        let record = Transaction::new(NewTransaction {
            kind: TransactionType::Expense,
            amount: dec!(10),
            date: NaiveDate::from_ymd_opt(2026, 8, 7).unwrap(),
            occurred_at: None,
            category_id: Some(category.id),
            debit_card_id: None,
            description: "Compra".into(),
            recurrence: RecurrenceType::Variable,
        })
        .unwrap();

        assert!(repository
            .import_transactions(&[record], None)
            .await
            .is_err());
        assert!(repository.list_transactions().await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn restore_backup_replaces_data_atomically() {
        let pool = test_pool().await;
        let repository = FinanceRepository::new(&pool);
        let categories = repository.list_categories().await.unwrap();
        let income_category = categories
            .iter()
            .find(|item| item.kind == TransactionType::Income)
            .unwrap();
        let income = Transaction::new(NewTransaction {
            kind: TransactionType::Income,
            amount: dec!(250),
            date: NaiveDate::from_ymd_opt(2026, 8, 17).unwrap(),
            occurred_at: None,
            category_id: Some(income_category.id),
            debit_card_id: None,
            description: "Salário restaurado".into(),
            recurrence: RecurrenceType::Variable,
        })
        .unwrap();
        let backup = BackupData {
            transactions: vec![income.clone()],
            categories,
            debit_cards: vec![],
            vaults: vec![],
            vault_movements: vec![],
            automatic_reserve_rules: vec![],
            monthly_reserve_rules: vec![],
            digital_wallet_items: vec![],
            dashboard_layout: serde_json::json!({"widgets": []}),
            recurring_rules: vec![],
            account_settings: AccountSettings {
                opening_balance_adjustment: Decimal::ZERO,
                balance_hidden: true,
                migrated_at: Utc::now(),
            },
        };

        repository.factory_reset().await.unwrap();
        repository.restore_backup(&backup).await.unwrap();

        assert_eq!(repository.list_transactions().await.unwrap(), vec![income]);
        assert_eq!(repository.available_balance().await.unwrap(), dec!(250));
        assert!(
            repository
                .get_account_settings()
                .await
                .unwrap()
                .unwrap()
                .balance_hidden
        );
    }

    #[tokio::test]
    async fn app_lock_settings_persist_and_rate_limit_failures() {
        let pool = test_pool().await;
        let repository = FinanceRepository::new(&pool);

        repository
            .save_app_lock("argon2-verifier", true)
            .await
            .unwrap();
        let stored = repository.get_app_lock().await.unwrap().unwrap();
        assert_eq!(stored.pin_hash, "argon2-verifier");
        assert!(stored.biometric_enabled);

        for _ in 0..4 {
            assert!(repository
                .register_app_lock_failure()
                .await
                .unwrap()
                .is_none());
        }
        assert!(repository
            .register_app_lock_failure()
            .await
            .unwrap()
            .is_some());
        assert!(repository
            .get_app_lock()
            .await
            .unwrap()
            .unwrap()
            .locked_until
            .is_some());

        repository.clear_app_lock_attempts().await.unwrap();
        repository.delete_app_lock().await.unwrap();
        assert!(repository.get_app_lock().await.unwrap().is_none());
    }
}

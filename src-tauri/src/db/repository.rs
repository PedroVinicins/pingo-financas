use std::str::FromStr;

use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use sqlx::{Row, SqlitePool};
use thiserror::Error;
use uuid::Uuid;

use crate::models::{
    CardBackground, CardNetwork, CardPattern, Category, DebitCard, RecurrenceType, Transaction,
    TransactionType, UpdateDebitCardStyle, Vault, VaultType,
};

#[derive(Debug, Error)]
pub enum DbError {
    #[error(transparent)]
    Sqlx(#[from] sqlx::Error),
    #[error("dado inválido no banco: {0}")]
    InvalidData(String),
}

pub struct FinanceRepository<'a> {
    pool: &'a SqlitePool,
}

impl<'a> FinanceRepository<'a> {
    pub fn new(pool: &'a SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn insert_transaction(&self, transaction: &Transaction) -> Result<(), DbError> {
        sqlx::query(
            r#"INSERT INTO transactions
               (id, kind, amount, date, category_id, debit_card_id, description, recurrence, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(transaction.id.to_string())
        .bind(transaction.kind.as_str())
        .bind(transaction.amount.to_string())
        .bind(transaction.date.format("%Y-%m-%d").to_string())
        .bind(transaction.category_id.map(|id| id.to_string()))
        .bind(transaction.debit_card_id.map(|id| id.to_string()))
        .bind(&transaction.description)
        .bind(transaction.recurrence.as_str())
        .bind(transaction.created_at.to_rfc3339())
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn list_transactions(&self) -> Result<Vec<Transaction>, DbError> {
        let rows = sqlx::query(
            r#"SELECT id, kind, amount, date, category_id, debit_card_id, description, recurrence, created_at
               FROM transactions
               ORDER BY date DESC, created_at DESC"#,
        )
        .fetch_all(self.pool)
        .await?;

        rows.into_iter().map(row_to_transaction).collect()
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
            "INSERT INTO categories (id, name, icon, color, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(category.id.to_string())
        .bind(&category.name)
        .bind(&category.icon)
        .bind(&category.color)
        .bind(category.created_at.to_rfc3339())
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn list_categories(&self) -> Result<Vec<Category>, DbError> {
        let rows = sqlx::query(
            "SELECT id, name, icon, color, created_at FROM categories ORDER BY name COLLATE NOCASE",
        )
        .fetch_all(self.pool)
        .await?;

        rows.into_iter().map(row_to_category).collect()
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

    pub async fn update_debit_card_style(&self, input: &UpdateDebitCardStyle) -> Result<(), DbError> {
        sqlx::query(
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
        Ok(())
    }

    pub async fn set_debit_card_frozen(&self, id: Uuid, frozen: bool) -> Result<(), DbError> {
        sqlx::query("UPDATE debit_cards SET is_frozen = ? WHERE id = ?")
            .bind(frozen)
            .bind(id.to_string())
            .execute(self.pool)
            .await?;
        Ok(())
    }

    pub async fn set_default_debit_card(&self, id: Uuid) -> Result<(), DbError> {
        let mut transaction = self.pool.begin().await?;
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
        sqlx::query("DELETE FROM debit_cards WHERE id = ?")
            .bind(id.to_string())
            .execute(self.pool)
            .await?;
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

    pub async fn insert_vault(&self, vault: &Vault) -> Result<(), DbError> {
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
        .execute(self.pool)
        .await?;
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

    pub async fn update_vault_balance(&self, vault: &Vault) -> Result<(), DbError> {
        sqlx::query("UPDATE vaults SET balance = ?, updated_at = ? WHERE id = ?")
            .bind(vault.balance.to_string())
            .bind(vault.updated_at.to_rfc3339())
            .bind(vault.id.to_string())
            .execute(self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete_vault(&self, id: Uuid) -> Result<(), DbError> {
        sqlx::query("DELETE FROM vaults WHERE id = ?")
            .bind(id.to_string())
            .execute(self.pool)
            .await?;
        Ok(())
    }
}

fn row_to_transaction(row: sqlx::sqlite::SqliteRow) -> Result<Transaction, DbError> {
    let id: String = row.try_get("id")?;
    let kind: String = row.try_get("kind")?;
    let amount: String = row.try_get("amount")?;
    let date: String = row.try_get("date")?;
    let category_id: Option<String> = row.try_get("category_id")?;
    let debit_card_id: Option<String> = row.try_get("debit_card_id")?;
    let created_at: String = row.try_get("created_at")?;
    let recurrence: String = row.try_get("recurrence")?;

    Ok(Transaction {
        id: Uuid::parse_str(&id).map_err(invalid)?,
        kind: TransactionType::parse(&kind).ok_or_else(|| DbError::InvalidData(kind.clone()))?,
        amount: Decimal::from_str(&amount).map_err(invalid)?,
        date: NaiveDate::parse_from_str(&date, "%Y-%m-%d").map_err(invalid)?,
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
        network: CardNetwork::parse(&network).ok_or_else(|| DbError::InvalidData(network.clone()))?,
        color_from: row.try_get("color_from")?,
        color_to: row.try_get("color_to")?,
        pattern: CardPattern::parse(&pattern).ok_or_else(|| DbError::InvalidData(pattern.clone()))?,
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
        r#type: VaultType::parse(&vault_type).ok_or_else(|| DbError::InvalidData(vault_type.clone()))?,
        balance: Decimal::from_str(&balance).map_err(invalid)?,
        target_amount: target_amount.map(|value| Decimal::from_str(&value).map_err(invalid)).transpose()?,
        annual_yield_rate: annual_yield_rate.map(|value| Decimal::from_str(&value).map_err(invalid)).transpose()?,
        color: row.try_get("color")?,
        emoji: row.try_get("emoji")?,
        created_at: DateTime::parse_from_rfc3339(&created_at).map_err(invalid)?.with_timezone(&Utc),
        updated_at: DateTime::parse_from_rfc3339(&updated_at).map_err(invalid)?.with_timezone(&Utc),
    })
}

fn invalid(error: impl std::fmt::Display) -> DbError {
    DbError::InvalidData(error.to_string())
}

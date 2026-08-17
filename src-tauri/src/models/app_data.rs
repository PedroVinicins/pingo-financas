use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

use super::{
    Category, DebitCard, DigitalWalletItem, MonthlyReserveRule, RecurringRule, Transaction, Vault,
    VaultMovementType,
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountSettings {
    #[serde(with = "rust_decimal::serde::str")]
    pub opening_balance_adjustment: Decimal,
    pub balance_hidden: bool,
    pub migrated_at: DateTime<Utc>,
}

impl Default for AccountSettings {
    fn default() -> Self {
        Self {
            opening_balance_adjustment: Decimal::ZERO,
            balance_hidden: false,
            migrated_at: Utc::now(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VaultMovementSource {
    Manual,
    Automatic,
}

impl VaultMovementSource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Manual => "manual",
            Self::Automatic => "automatic",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "manual" => Some(Self::Manual),
            "automatic" => Some(Self::Automatic),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultMovement {
    pub id: Uuid,
    pub vault_id: Uuid,
    pub kind: VaultMovementType,
    #[serde(with = "rust_decimal::serde::str")]
    pub amount: Decimal,
    pub source: VaultMovementSource,
    pub occurred_at: DateTime<Utc>,
}

impl VaultMovement {
    pub fn new(
        vault_id: Uuid,
        kind: VaultMovementType,
        amount: Decimal,
        source: VaultMovementSource,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            vault_id,
            kind,
            amount,
            source,
            occurred_at: Utc::now(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AutomaticReserveMode {
    Fixed,
    Percentage,
}

impl AutomaticReserveMode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Fixed => "fixed",
            Self::Percentage => "percentage",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "fixed" => Some(Self::Fixed),
            "percentage" => Some(Self::Percentage),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomaticReserveRule {
    pub vault_id: Uuid,
    pub enabled: bool,
    pub mode: AutomaticReserveMode,
    #[serde(with = "rust_decimal::serde::str")]
    pub value: Decimal,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum AutomaticReserveError {
    #[error("o valor da reserva automática deve ser maior que zero")]
    NonPositiveValue,
    #[error("a porcentagem da reserva automática deve ficar entre 0% e 100%")]
    InvalidPercentage,
}

impl AutomaticReserveRule {
    pub fn validate(&self) -> Result<(), AutomaticReserveError> {
        if self.value <= Decimal::ZERO {
            return Err(AutomaticReserveError::NonPositiveValue);
        }
        if self.mode == AutomaticReserveMode::Percentage && self.value > Decimal::from(100u32) {
            return Err(AutomaticReserveError::InvalidPercentage);
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyAppData {
    pub account_settings: Option<AccountSettings>,
    #[serde(default)]
    pub vault_movements: Vec<VaultMovement>,
    #[serde(default)]
    pub automatic_reserve_rules: Vec<AutomaticReserveRule>,
    #[serde(default)]
    pub recurring_rules: Vec<RecurringRule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupData {
    #[serde(default)]
    pub transactions: Vec<Transaction>,
    #[serde(default)]
    pub categories: Vec<Category>,
    #[serde(default)]
    pub debit_cards: Vec<DebitCard>,
    #[serde(default)]
    pub vaults: Vec<Vault>,
    #[serde(default)]
    pub vault_movements: Vec<VaultMovement>,
    #[serde(default)]
    pub automatic_reserve_rules: Vec<AutomaticReserveRule>,
    #[serde(default)]
    pub monthly_reserve_rules: Vec<MonthlyReserveRule>,
    #[serde(default)]
    pub digital_wallet_items: Vec<DigitalWalletItem>,
    pub dashboard_layout: serde_json::Value,
    #[serde(default)]
    pub recurring_rules: Vec<RecurringRule>,
    pub account_settings: AccountSettings,
}

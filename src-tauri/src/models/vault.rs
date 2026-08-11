use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VaultType {
    PiggyBank,
    Box,
    Savings,
    Investment,
    Cash,
}

impl VaultType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::PiggyBank => "piggy_bank",
            Self::Box => "box",
            Self::Savings => "savings",
            Self::Investment => "investment",
            Self::Cash => "cash",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "piggy_bank" => Some(Self::PiggyBank),
            "box" => Some(Self::Box),
            "savings" => Some(Self::Savings),
            "investment" => Some(Self::Investment),
            "cash" => Some(Self::Cash),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VaultMovementType {
    Deposit,
    Withdraw,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Vault {
    pub id: Uuid,
    pub name: String,
    pub institution: String,
    pub r#type: VaultType,
    #[serde(with = "rust_decimal::serde::str")]
    pub balance: Decimal,
    #[serde(with = "rust_decimal::serde::str_option")]
    pub target_amount: Option<Decimal>,
    #[serde(with = "rust_decimal::serde::str_option")]
    pub annual_yield_rate: Option<Decimal>,
    pub color: String,
    pub emoji: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewVault {
    pub name: String,
    pub institution: String,
    pub r#type: VaultType,
    #[serde(with = "rust_decimal::serde::str")]
    pub initial_balance: Decimal,
    #[serde(with = "rust_decimal::serde::str_option")]
    pub target_amount: Option<Decimal>,
    #[serde(with = "rust_decimal::serde::str_option")]
    pub annual_yield_rate: Option<Decimal>,
    pub color: String,
    pub emoji: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveVaultMoney {
    pub id: Uuid,
    pub kind: VaultMovementType,
    #[serde(with = "rust_decimal::serde::str")]
    pub amount: Decimal,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum VaultError {
    #[error("o nome do cofre não pode ficar vazio")]
    EmptyName,
    #[error("a instituição não pode ficar vazia")]
    EmptyInstitution,
    #[error("o saldo inicial não pode ser negativo")]
    NegativeInitialBalance,
    #[error("a meta precisa ser maior que zero")]
    NonPositiveTarget,
    #[error("a rentabilidade deve ficar entre 0% e 1.000% ao ano")]
    InvalidYieldRate,
    #[error("a cor deve estar no formato hexadecimal #RRGGBB")]
    InvalidColor,
    #[error("o emoji do cofre é muito longo")]
    EmojiTooLong,
    #[error("o valor da movimentação deve ser maior que zero")]
    NonPositiveMovement,
    #[error("o cofre não tem saldo suficiente")]
    InsufficientBalance,
}

impl Vault {
    pub fn new(input: NewVault) -> Result<Self, VaultError> {
        validate_new_vault(&input)?;
        let now = Utc::now();
        Ok(Self {
            id: Uuid::new_v4(),
            name: input.name.trim().to_owned(),
            institution: input.institution.trim().to_owned(),
            r#type: input.r#type,
            balance: input.initial_balance,
            target_amount: input.target_amount,
            annual_yield_rate: input.annual_yield_rate,
            color: input.color.to_ascii_uppercase(),
            emoji: clean_emoji(input.emoji)?,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn apply_movement(&mut self, movement: &MoveVaultMoney) -> Result<(), VaultError> {
        if movement.amount <= Decimal::ZERO {
            return Err(VaultError::NonPositiveMovement);
        }
        let next = match movement.kind {
            VaultMovementType::Deposit => self.balance + movement.amount,
            VaultMovementType::Withdraw => self.balance - movement.amount,
        };
        if next < Decimal::ZERO {
            return Err(VaultError::InsufficientBalance);
        }
        self.balance = next;
        self.updated_at = Utc::now();
        Ok(())
    }
}

pub fn validate_new_vault(input: &NewVault) -> Result<(), VaultError> {
    if input.name.trim().is_empty() { return Err(VaultError::EmptyName); }
    if input.institution.trim().is_empty() { return Err(VaultError::EmptyInstitution); }
    if input.initial_balance < Decimal::ZERO { return Err(VaultError::NegativeInitialBalance); }
    if input.target_amount.is_some_and(|value| value <= Decimal::ZERO) { return Err(VaultError::NonPositiveTarget); }
    if input.annual_yield_rate.is_some_and(|value| value < Decimal::ZERO || value > Decimal::from(1_000u32)) { return Err(VaultError::InvalidYieldRate); }
    if !is_hex_color(&input.color) { return Err(VaultError::InvalidColor); }
    if input.emoji.as_ref().is_some_and(|value| value.trim().chars().count() > 4) { return Err(VaultError::EmojiTooLong); }
    Ok(())
}

fn clean_emoji(emoji: Option<String>) -> Result<Option<String>, VaultError> {
    let value = emoji.map(|value| value.trim().to_owned()).filter(|value| !value.is_empty());
    if value.as_ref().is_some_and(|value| value.chars().count() > 4) { return Err(VaultError::EmojiTooLong); }
    Ok(value)
}

fn is_hex_color(value: &str) -> bool {
    value.len() == 7 && value.starts_with('#') && value[1..].chars().all(|character| character.is_ascii_hexdigit())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    fn input() -> NewVault {
        NewVault { name: "Reserva".into(), institution: "Banco Inter".into(), r#type: VaultType::PiggyBank, initial_balance: dec!(200), target_amount: Some(dec!(1000)), annual_yield_rate: Some(dec!(12)), color: "#F97316".into(), emoji: Some("🐷".into()) }
    }

    #[test]
    fn moves_money_without_allowing_negative_balance() {
        let mut vault = Vault::new(input()).unwrap();
        vault.apply_movement(&MoveVaultMoney { id: vault.id, kind: VaultMovementType::Deposit, amount: dec!(50) }).unwrap();
        assert_eq!(vault.balance, dec!(250));
        let error = vault.apply_movement(&MoveVaultMoney { id: vault.id, kind: VaultMovementType::Withdraw, amount: dec!(300) }).unwrap_err();
        assert_eq!(error, VaultError::InsufficientBalance);
    }
}

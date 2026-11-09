use chrono::{DateTime, NaiveDate, NaiveDateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TransactionType {
    Income,
    Expense,
}

impl TransactionType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Income => "income",
            Self::Expense => "expense",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "income" => Some(Self::Income),
            "expense" => Some(Self::Expense),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TransactionClassification {
    Income,
    Expense,
    Refund,
    Transfer,
}

impl TransactionClassification {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Income => "income",
            Self::Expense => "expense",
            Self::Refund => "refund",
            Self::Transfer => "transfer",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "income" => Some(Self::Income),
            "expense" => Some(Self::Expense),
            "refund" => Some(Self::Refund),
            "transfer" => Some(Self::Transfer),
            _ => None,
        }
    }

    fn for_kind(kind: TransactionType) -> Self {
        match kind {
            TransactionType::Income => Self::Income,
            TransactionType::Expense => Self::Expense,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RecurrenceType {
    Fixed,
    Variable,
}

impl RecurrenceType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Fixed => "fixed",
            Self::Variable => "variable",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "fixed" => Some(Self::Fixed),
            "variable" => Some(Self::Variable),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Transaction {
    pub id: Uuid,
    pub kind: TransactionType,
    #[serde(default)]
    pub classification: Option<TransactionClassification>,
    #[serde(with = "rust_decimal::serde::str")]
    pub amount: Decimal,
    pub date: NaiveDate,
    #[serde(default)]
    pub occurred_at: Option<NaiveDateTime>,
    pub category_id: Option<Uuid>,
    pub debit_card_id: Option<Uuid>,
    #[serde(default)]
    pub related_transaction_id: Option<Uuid>,
    #[serde(default)]
    pub source_bank: Option<String>,
    #[serde(default)]
    pub external_id: Option<String>,
    pub description: String,
    pub recurrence: RecurrenceType,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewTransaction {
    pub kind: TransactionType,
    #[serde(default)]
    pub classification: Option<TransactionClassification>,
    #[serde(with = "rust_decimal::serde::str")]
    pub amount: Decimal,
    pub date: NaiveDate,
    #[serde(default)]
    pub occurred_at: Option<NaiveDateTime>,
    pub category_id: Option<Uuid>,
    pub debit_card_id: Option<Uuid>,
    #[serde(default)]
    pub related_transaction_id: Option<Uuid>,
    #[serde(default)]
    pub source_bank: Option<String>,
    #[serde(default)]
    pub external_id: Option<String>,
    pub description: String,
    pub recurrence: RecurrenceType,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum TransactionError {
    #[error("o valor deve ser maior que zero")]
    NonPositiveAmount,
    #[error("a descrição não pode ficar vazia")]
    EmptyDescription,
    #[error("a descrição deve ter no máximo 160 caracteres")]
    DescriptionTooLong,
    #[error("transações precisam de uma categoria")]
    CategoryRequired,
    #[error("um cartão de débito só pode ser associado a uma despesa")]
    DebitCardOnlyForExpense,
    #[error("a classificação é incompatível com a direção da transação")]
    InvalidClassification,
    #[error("a data e a hora precisam pertencer ao mesmo dia")]
    OccurrenceDateMismatch,
}

impl Transaction {
    pub fn new(input: NewTransaction) -> Result<Self, TransactionError> {
        validate_new_transaction(&input)?;

        Ok(Self {
            id: Uuid::new_v4(),
            kind: input.kind,
            classification: Some(
                input
                    .classification
                    .unwrap_or_else(|| TransactionClassification::for_kind(input.kind)),
            ),
            amount: input.amount,
            date: input.date,
            occurred_at: input.occurred_at,
            category_id: input.category_id,
            debit_card_id: input.debit_card_id,
            related_transaction_id: input.related_transaction_id,
            source_bank: input.source_bank,
            external_id: input.external_id.map(|value| value.trim().to_owned()),
            description: input.description.trim().to_owned(),
            recurrence: input.recurrence,
            created_at: Utc::now(),
        })
    }
}

pub fn validate_new_transaction(input: &NewTransaction) -> Result<(), TransactionError> {
    if input.amount <= Decimal::ZERO {
        return Err(TransactionError::NonPositiveAmount);
    }

    let description = input.description.trim();
    if description.is_empty() {
        return Err(TransactionError::EmptyDescription);
    }
    if description.chars().count() > 160 {
        return Err(TransactionError::DescriptionTooLong);
    }
    if input.category_id.is_none() {
        return Err(TransactionError::CategoryRequired);
    }
    if input.kind == TransactionType::Income && input.debit_card_id.is_some() {
        return Err(TransactionError::DebitCardOnlyForExpense);
    }
    let classification = input
        .classification
        .unwrap_or_else(|| TransactionClassification::for_kind(input.kind));
    let classification_matches_kind = match classification {
        TransactionClassification::Income | TransactionClassification::Refund => {
            input.kind == TransactionType::Income
        }
        TransactionClassification::Expense => input.kind == TransactionType::Expense,
        TransactionClassification::Transfer => true,
    };
    if !classification_matches_kind
        || (input.related_transaction_id.is_some()
            && classification != TransactionClassification::Refund)
        || input
            .source_bank
            .as_deref()
            .is_some_and(|bank| !matches!(bank, "inter" | "nubank"))
        || input
            .external_id
            .as_deref()
            .is_some_and(|id| id.trim().is_empty())
    {
        return Err(TransactionError::InvalidClassification);
    }
    if input
        .occurred_at
        .is_some_and(|value| value.date() != input.date)
    {
        return Err(TransactionError::OccurrenceDateMismatch);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    fn base_input() -> NewTransaction {
        NewTransaction {
            kind: TransactionType::Expense,
            classification: None,
            amount: dec!(10.50),
            date: NaiveDate::from_ymd_opt(2026, 8, 9).unwrap(),
            occurred_at: None,
            category_id: Some(Uuid::new_v4()),
            debit_card_id: None,
            related_transaction_id: None,
            source_bank: None,
            external_id: None,
            description: "Mercado".into(),
            recurrence: RecurrenceType::Variable,
        }
    }

    #[test]
    fn rejects_zero_and_negative_amounts() {
        let mut zero = base_input();
        zero.amount = Decimal::ZERO;
        assert_eq!(
            Transaction::new(zero).unwrap_err(),
            TransactionError::NonPositiveAmount
        );

        let mut negative = base_input();
        negative.amount = dec!(-0.01);
        assert_eq!(
            Transaction::new(negative).unwrap_err(),
            TransactionError::NonPositiveAmount
        );
    }

    #[test]
    fn income_cannot_use_a_debit_card() {
        let mut input = base_input();
        input.kind = TransactionType::Income;
        input.debit_card_id = Some(Uuid::new_v4());
        assert_eq!(
            Transaction::new(input).unwrap_err(),
            TransactionError::DebitCardOnlyForExpense
        );
    }

    #[test]
    fn occurrence_time_must_match_the_transaction_date() {
        let mut input = base_input();
        input.occurred_at = NaiveDate::from_ymd_opt(2026, 8, 10)
            .unwrap()
            .and_hms_opt(8, 30, 0);
        assert_eq!(
            Transaction::new(input).unwrap_err(),
            TransactionError::OccurrenceDateMismatch
        );
    }
}

use chrono::{DateTime, Datelike, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

use super::{Transaction, TransactionType};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringRule {
    pub id: Uuid,
    pub kind: TransactionType,
    #[serde(with = "rust_decimal::serde::str")]
    pub amount: Decimal,
    pub day_of_month: u32,
    pub category_id: Uuid,
    pub debit_card_id: Option<Uuid>,
    pub description: String,
    pub reminder_enabled: bool,
    pub auto_process_after_days: u32,
    pub active: bool,
    pub last_processed_period: Option<String>,
    pub next_due_date: NaiveDate,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewRecurringRule {
    pub kind: TransactionType,
    #[serde(with = "rust_decimal::serde::str")]
    pub amount: Decimal,
    pub day_of_month: u32,
    pub category_id: Uuid,
    pub debit_card_id: Option<Uuid>,
    pub description: String,
    pub reminder_enabled: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringSettlement {
    pub transaction: Transaction,
    pub rule: RecurringRule,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum RecurringRuleError {
    #[error("o valor da recorrência deve ser maior que zero")]
    NonPositiveAmount,
    #[error("escolha um dia entre 1 e 31")]
    InvalidDay,
    #[error("a descrição da recorrência não pode ficar vazia")]
    EmptyDescription,
    #[error("a descrição da recorrência deve ter no máximo 160 caracteres")]
    DescriptionTooLong,
    #[error("um cartão de débito só pode ser associado a uma despesa")]
    DebitCardOnlyForExpense,
    #[error("o prazo automático deve ficar entre 0 e 31 dias")]
    InvalidAutoProcessDelay,
}

impl RecurringRule {
    pub fn new(input: NewRecurringRule, today: NaiveDate) -> Result<Self, RecurringRuleError> {
        validate_input(&input)?;
        let now = Utc::now();
        Ok(Self {
            id: Uuid::new_v4(),
            kind: input.kind,
            amount: input.amount,
            day_of_month: input.day_of_month,
            category_id: input.category_id,
            debit_card_id: input.debit_card_id,
            description: input.description.trim().to_owned(),
            reminder_enabled: input.reminder_enabled,
            auto_process_after_days: 3,
            active: true,
            last_processed_period: None,
            next_due_date: first_due_date(input.day_of_month, today),
            created_at: now,
            updated_at: now,
        })
    }

    pub fn validate(&self) -> Result<(), RecurringRuleError> {
        validate_input(&NewRecurringRule {
            kind: self.kind,
            amount: self.amount,
            day_of_month: self.day_of_month,
            category_id: self.category_id,
            debit_card_id: self.debit_card_id,
            description: self.description.clone(),
            reminder_enabled: self.reminder_enabled,
        })?;
        if self.auto_process_after_days > 31 {
            return Err(RecurringRuleError::InvalidAutoProcessDelay);
        }
        Ok(())
    }

    pub fn advance_after(&mut self, processed_due_date: NaiveDate) {
        self.last_processed_period = Some(processed_due_date.format("%Y-%m").to_string());
        self.next_due_date = following_due_date(self.day_of_month, processed_due_date);
        self.updated_at = Utc::now();
    }
}

fn validate_input(input: &NewRecurringRule) -> Result<(), RecurringRuleError> {
    if input.amount <= Decimal::ZERO {
        return Err(RecurringRuleError::NonPositiveAmount);
    }
    if !(1..=31).contains(&input.day_of_month) {
        return Err(RecurringRuleError::InvalidDay);
    }
    let description = input.description.trim();
    if description.is_empty() {
        return Err(RecurringRuleError::EmptyDescription);
    }
    if description.chars().count() > 160 {
        return Err(RecurringRuleError::DescriptionTooLong);
    }
    if input.kind == TransactionType::Income && input.debit_card_id.is_some() {
        return Err(RecurringRuleError::DebitCardOnlyForExpense);
    }
    Ok(())
}

fn date_for_month(year: i32, month: u32, day: u32) -> NaiveDate {
    let first_next_month = if month == 12 {
        NaiveDate::from_ymd_opt(year + 1, 1, 1)
    } else {
        NaiveDate::from_ymd_opt(year, month + 1, 1)
    }
    .expect("ano e mês válidos");
    let last_day = first_next_month
        .pred_opt()
        .expect("mês possui ao menos um dia")
        .day();
    NaiveDate::from_ymd_opt(year, month, day.min(last_day)).expect("data recorrente válida")
}

pub fn first_due_date(day: u32, today: NaiveDate) -> NaiveDate {
    let current = date_for_month(today.year(), today.month(), day);
    if current >= today {
        current
    } else {
        following_due_date(day, current)
    }
}

pub fn following_due_date(day: u32, current: NaiveDate) -> NaiveDate {
    let (year, month) = if current.month() == 12 {
        (current.year() + 1, 1)
    } else {
        (current.year(), current.month() + 1)
    };
    date_for_month(year, month, day)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    fn input(day: u32) -> NewRecurringRule {
        NewRecurringRule {
            kind: TransactionType::Expense,
            amount: dec!(49.90),
            day_of_month: day,
            category_id: Uuid::new_v4(),
            debit_card_id: None,
            description: "Internet".into(),
            reminder_enabled: true,
        }
    }

    #[test]
    fn starts_in_the_next_month_when_the_due_day_has_passed() {
        let rule =
            RecurringRule::new(input(5), NaiveDate::from_ymd_opt(2026, 8, 12).unwrap()).unwrap();
        assert_eq!(
            rule.next_due_date,
            NaiveDate::from_ymd_opt(2026, 9, 5).unwrap()
        );
    }

    #[test]
    fn clamps_due_dates_to_the_last_day_of_short_months() {
        let rule =
            RecurringRule::new(input(31), NaiveDate::from_ymd_opt(2026, 2, 1).unwrap()).unwrap();
        assert_eq!(
            rule.next_due_date,
            NaiveDate::from_ymd_opt(2026, 2, 28).unwrap()
        );
    }
}

use std::collections::BTreeMap;

use chrono::{Datelike, NaiveDate};
use rust_decimal::{Decimal, RoundingStrategy};
use uuid::Uuid;

use crate::models::{RecurrenceType, Transaction, TransactionType};

#[derive(Debug, Clone, Default)]
pub struct TransactionFilter {
    pub start: Option<NaiveDate>,
    pub end: Option<NaiveDate>,
    pub kind: Option<TransactionType>,
    pub category_id: Option<Uuid>,
    pub debit_card_id: Option<Uuid>,
}

pub fn calculate_balance(transactions: &[Transaction]) -> Decimal {
    transactions
        .iter()
        .fold(Decimal::ZERO, |balance, transaction| {
            match transaction.kind {
                TransactionType::Income => balance + transaction.amount,
                TransactionType::Expense => balance - transaction.amount,
            }
        })
}

pub fn monthly_balance(transactions: &[Transaction], year: i32, month: u32) -> Decimal {
    let filtered = transactions
        .iter()
        .filter(|transaction| transaction.date.year() == year && transaction.date.month() == month);

    filtered.fold(Decimal::ZERO, |balance, transaction| {
        match transaction.kind {
            TransactionType::Income => balance + transaction.amount,
            TransactionType::Expense => balance - transaction.amount,
        }
    })
}

pub fn monthly_income_and_expenses(
    transactions: &[Transaction],
    year: i32,
    month: u32,
) -> (Decimal, Decimal) {
    transactions
        .iter()
        .filter(|transaction| transaction.date.year() == year && transaction.date.month() == month)
        .fold(
            (Decimal::ZERO, Decimal::ZERO),
            |(income, expenses), transaction| match transaction.kind {
                TransactionType::Income => (income + transaction.amount, expenses),
                TransactionType::Expense => (income, expenses + transaction.amount),
            },
        )
}

pub fn savings_rate(transactions: &[Transaction], year: i32, month: u32) -> Decimal {
    let (income, expenses) = monthly_income_and_expenses(transactions, year, month);
    if income <= Decimal::ZERO {
        return Decimal::ZERO;
    }
    (((income - expenses) / income) * Decimal::from(100u32))
        .round_dp_with_strategy(2, RoundingStrategy::MidpointAwayFromZero)
}

pub fn fixed_cost_ratio(transactions: &[Transaction], year: i32, month: u32) -> Decimal {
    let (income, _) = monthly_income_and_expenses(transactions, year, month);
    if income <= Decimal::ZERO {
        return Decimal::ZERO;
    }
    let fixed_expenses: Decimal = transactions
        .iter()
        .filter(|transaction| {
            transaction.kind == TransactionType::Expense
                && transaction.recurrence == RecurrenceType::Fixed
                && transaction.date.year() == year
                && transaction.date.month() == month
        })
        .map(|transaction| transaction.amount)
        .sum();
    ((fixed_expenses / income) * Decimal::from(100u32))
        .round_dp_with_strategy(2, RoundingStrategy::MidpointAwayFromZero)
}

pub fn projected_month_expenses(
    current_expenses: Decimal,
    elapsed_days: u32,
    days_in_month: u32,
) -> Decimal {
    if current_expenses <= Decimal::ZERO || elapsed_days == 0 || days_in_month == 0 {
        return Decimal::ZERO;
    }
    (current_expenses / Decimal::from(elapsed_days) * Decimal::from(days_in_month))
        .round_dp_with_strategy(2, RoundingStrategy::MidpointAwayFromZero)
}

pub fn emergency_fund_months(vault_total: Decimal, average_monthly_expenses: Decimal) -> Decimal {
    if vault_total <= Decimal::ZERO || average_monthly_expenses <= Decimal::ZERO {
        return Decimal::ZERO;
    }
    (vault_total / average_monthly_expenses)
        .round_dp_with_strategy(2, RoundingStrategy::MidpointAwayFromZero)
}

pub fn expenses_by_category(transactions: &[Transaction]) -> BTreeMap<Uuid, Decimal> {
    let mut totals = BTreeMap::new();

    for transaction in transactions
        .iter()
        .filter(|item| item.kind == TransactionType::Expense)
    {
        if let Some(category_id) = transaction.category_id {
            *totals.entry(category_id).or_insert(Decimal::ZERO) += transaction.amount;
        }
    }

    totals
}

pub fn expenses_by_debit_card(transactions: &[Transaction]) -> BTreeMap<Uuid, Decimal> {
    let mut totals = BTreeMap::new();

    for transaction in transactions
        .iter()
        .filter(|item| item.kind == TransactionType::Expense)
    {
        if let Some(debit_card_id) = transaction.debit_card_id {
            *totals.entry(debit_card_id).or_insert(Decimal::ZERO) += transaction.amount;
        }
    }

    totals
}

pub fn expense_percentages(totals: &BTreeMap<Uuid, Decimal>) -> BTreeMap<Uuid, Decimal> {
    let total: Decimal = totals.values().copied().sum();

    if total <= Decimal::ZERO {
        return totals
            .keys()
            .copied()
            .map(|id| (id, Decimal::ZERO))
            .collect();
    }

    totals
        .iter()
        .map(|(category_id, amount)| {
            let percentage = ((*amount / total) * Decimal::from(100u32))
                .round_dp_with_strategy(2, RoundingStrategy::MidpointAwayFromZero);
            (*category_id, percentage)
        })
        .collect()
}

pub fn filter_transactions(
    transactions: &[Transaction],
    filter: &TransactionFilter,
) -> Vec<Transaction> {
    let mut result: Vec<Transaction> = transactions
        .iter()
        .filter(|transaction| {
            filter.start.map_or(true, |start| transaction.date >= start)
                && filter.end.map_or(true, |end| transaction.date <= end)
                && filter.kind.map_or(true, |kind| transaction.kind == kind)
                && filter
                    .category_id
                    .map_or(true, |category| transaction.category_id == Some(category))
                && filter
                    .debit_card_id
                    .map_or(true, |card| transaction.debit_card_id == Some(card))
        })
        .cloned()
        .collect();

    result.sort_by(|a, b| {
        b.date
            .cmp(&a.date)
            .then_with(|| b.created_at.cmp(&a.created_at))
    });
    result
}

#[cfg(test)]
mod tests {
    use chrono::{TimeZone, Utc};
    use rust_decimal_macros::dec;

    use super::*;
    use crate::models::RecurrenceType;

    fn transaction(
        kind: TransactionType,
        amount: Decimal,
        category_id: Option<Uuid>,
        day: u32,
    ) -> Transaction {
        Transaction {
            id: Uuid::new_v4(),
            kind,
            amount,
            date: NaiveDate::from_ymd_opt(2026, 8, day).unwrap(),
            category_id,
            debit_card_id: None,
            description: "Teste".into(),
            recurrence: RecurrenceType::Variable,
            created_at: Utc.with_ymd_and_hms(2026, 8, day, 12, 0, 0).unwrap(),
        }
    }

    #[test]
    fn calculates_precise_balance() {
        let category = Uuid::new_v4();
        let items = vec![
            transaction(TransactionType::Income, dec!(0.10), None, 1),
            transaction(TransactionType::Income, dec!(0.20), None, 2),
            transaction(TransactionType::Expense, dec!(0.30), Some(category), 3),
        ];

        assert_eq!(calculate_balance(&items), dec!(0.00));
    }

    #[test]
    fn calculates_category_percentages() {
        let food = Uuid::new_v4();
        let transport = Uuid::new_v4();
        let totals = BTreeMap::from([(food, dec!(75)), (transport, dec!(25))]);

        let percentages = expense_percentages(&totals);
        assert_eq!(percentages[&food], dec!(75.00));
        assert_eq!(percentages[&transport], dec!(25.00));
    }

    #[test]
    fn groups_card_expenses_without_changing_account_balance() {
        let category = Uuid::new_v4();
        let card_a = Uuid::new_v4();
        let card_b = Uuid::new_v4();

        let mut salary = transaction(TransactionType::Income, dec!(100), None, 1);
        salary.debit_card_id = None;
        let mut purchase_a = transaction(TransactionType::Expense, dec!(20), Some(category), 2);
        purchase_a.debit_card_id = Some(card_a);
        let mut purchase_b = transaction(TransactionType::Expense, dec!(15), Some(category), 3);
        purchase_b.debit_card_id = Some(card_b);
        let items = vec![salary, purchase_a, purchase_b];

        let totals = expenses_by_debit_card(&items);
        assert_eq!(totals[&card_a], dec!(20));
        assert_eq!(totals[&card_b], dec!(15));
        assert_eq!(calculate_balance(&items), dec!(65));
    }

    #[test]
    fn zero_total_never_divides_by_zero() {
        let category = Uuid::new_v4();
        let totals = BTreeMap::from([(category, Decimal::ZERO)]);

        let percentages = expense_percentages(&totals);
        assert_eq!(percentages[&category], Decimal::ZERO);
    }

    #[test]
    fn calculates_savings_and_fixed_cost_rates() {
        let category = Uuid::new_v4();
        let mut rent = transaction(TransactionType::Expense, dec!(300), Some(category), 2);
        rent.recurrence = RecurrenceType::Fixed;
        let items = vec![
            transaction(TransactionType::Income, dec!(1000), None, 1),
            rent,
            transaction(TransactionType::Expense, dec!(200), Some(category), 3),
        ];

        assert_eq!(savings_rate(&items, 2026, 8), dec!(50.00));
        assert_eq!(fixed_cost_ratio(&items, 2026, 8), dec!(30.00));
    }

    #[test]
    fn projects_spending_and_reserve_coverage() {
        assert_eq!(projected_month_expenses(dec!(500), 10, 30), dec!(1500.00));
        assert_eq!(emergency_fund_months(dec!(6000), dec!(1000)), dec!(6.00));
        assert_eq!(projected_month_expenses(dec!(500), 0, 30), Decimal::ZERO);
    }
}

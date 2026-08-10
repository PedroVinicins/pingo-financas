use chrono::{Datelike, NaiveDate, TimeZone, Utc};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use uuid::Uuid;

use cashew_clone_lib::{
    models::{NewTransaction, RecurrenceType, Transaction, TransactionError, TransactionType},
    services::finance::{calculate_balance, filter_transactions, TransactionFilter},
};

fn transaction(kind: TransactionType, amount: Decimal, category: Option<Uuid>, day: u32) -> Transaction {
    Transaction {
        id: Uuid::new_v4(),
        kind,
        amount,
        date: NaiveDate::from_ymd_opt(2026, 8, day).unwrap(),
        category_id: category,
        debit_card_id: None,
        description: "Teste".into(),
        recurrence: RecurrenceType::Variable,
        created_at: Utc.with_ymd_and_hms(2026, 8, day, 12, 0, 0).unwrap(),
    }
}

#[test]
fn balance_keeps_decimal_precision() {
    let category = Uuid::new_v4();
    let transactions = vec![
        transaction(TransactionType::Income, dec!(1000.10), None, 1),
        transaction(TransactionType::Expense, dec!(300.03), Some(category), 2),
        transaction(TransactionType::Expense, dec!(0.07), Some(category), 3),
    ];

    assert_eq!(calculate_balance(&transactions), dec!(700.00));
}

#[test]
fn filters_by_period_and_sorts_newest_first() {
    let category = Uuid::new_v4();
    let transactions = vec![
        transaction(TransactionType::Expense, dec!(10), Some(category), 3),
        transaction(TransactionType::Expense, dec!(20), Some(category), 20),
        Transaction {
            date: NaiveDate::from_ymd_opt(2026, 7, 30).unwrap(),
            ..transaction(TransactionType::Expense, dec!(30), Some(category), 30)
        },
    ];

    let result = filter_transactions(
        &transactions,
        &TransactionFilter {
            start: Some(NaiveDate::from_ymd_opt(2026, 8, 1).unwrap()),
            end: Some(NaiveDate::from_ymd_opt(2026, 8, 31).unwrap()),
            ..Default::default()
        },
    );

    assert_eq!(result.len(), 2);
    assert_eq!(result[0].date.day(), 20);
    assert_eq!(result[1].date.day(), 3);
}

#[test]
fn rejects_non_positive_amounts() {
    let input = NewTransaction {
        kind: TransactionType::Expense,
        amount: dec!(-1.00),
        date: NaiveDate::from_ymd_opt(2026, 8, 9).unwrap(),
        category_id: Some(Uuid::new_v4()),
        debit_card_id: None,
        description: "Inválida".into(),
        recurrence: RecurrenceType::Variable,
    };

    assert_eq!(Transaction::new(input).unwrap_err(), TransactionError::NonPositiveAmount);
}

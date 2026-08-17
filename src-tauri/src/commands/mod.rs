use chrono::NaiveDate;
use rust_decimal::Decimal;
use tauri::State;
use uuid::Uuid;

use crate::{
    db::{AppState, FinanceRepository},
    models::{
        clean_emoji, validate_style, AccountSettings, AutomaticReserveRule, Category, DebitCard,
        DigitalWalletItem, LegacyAppData, MonthlyReserveRule, MoveVaultMoney, NewCategory,
        NewDebitCard, NewDigitalWalletItem, NewRecurringRule, NewTransaction, NewVault,
        RecurrenceType, RecurringRule, RecurringSettlement, Transaction, TransactionType,
        UpdateDebitCardStyle, UpdateVault, Vault, VaultMovement, VaultMovementSource,
        VaultMovementType,
    },
};

fn transaction_effect(transaction: &Transaction) -> Decimal {
    match transaction.kind {
        TransactionType::Income => transaction.amount,
        TransactionType::Expense => -transaction.amount,
    }
}

async fn validate_card_usage(
    repository: &FinanceRepository<'_>,
    card_id: Option<Uuid>,
    amount: Decimal,
    date: NaiveDate,
    excluding: Option<Uuid>,
    allow_frozen: bool,
) -> Result<(), String> {
    let Some(card_id) = card_id else {
        return Ok(());
    };
    let card = repository
        .get_debit_card(card_id)
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "cartão não encontrado".to_string())?;
    if card.is_frozen && !allow_frozen {
        return Err(
            "este cartão está congelado; desbloqueie-o antes de registrar uma compra".into(),
        );
    }
    if amount > Decimal::ZERO {
        let Some(limit) = card.monthly_spending_limit else {
            return Ok(());
        };
        let used = repository
            .card_expense_for_month(card_id, date, excluding)
            .await
            .map_err(|error| error.to_string())?;
        if used + amount > limit {
            return Err(format!(
                "esta compra ultrapassa o limite mensal de {} definido para o cartão",
                limit
            ));
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn list_transactions(state: State<'_, AppState>) -> Result<Vec<Transaction>, String> {
    FinanceRepository::new(&state.pool)
        .list_transactions()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn add_transaction(
    state: State<'_, AppState>,
    input: NewTransaction,
) -> Result<Transaction, String> {
    let repository = FinanceRepository::new(&state.pool);
    let category_id = input
        .category_id
        .ok_or_else(|| "selecione uma categoria".to_string())?;
    let category_kind = repository
        .category_kind(category_id)
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "categoria não encontrada".to_string())?;
    if category_kind != input.kind {
        return Err("a categoria não corresponde ao tipo da transação".into());
    }

    let transaction = Transaction::new(input).map_err(|error| error.to_string())?;
    if transaction.kind == TransactionType::Expense
        && transaction.amount
            > repository
                .available_balance()
                .await
                .map_err(|error| error.to_string())?
    {
        return Err("saldo insuficiente; o Pingo não deixa sua conta ficar negativa".into());
    }
    validate_card_usage(
        &repository,
        transaction.debit_card_id,
        transaction.amount,
        transaction.date,
        None,
        false,
    )
    .await?;
    repository
        .insert_transaction(&transaction)
        .await
        .map_err(|error| error.to_string())?;
    Ok(transaction)
}

#[tauri::command]
pub async fn import_transactions(
    state: State<'_, AppState>,
    inputs: Vec<NewTransaction>,
    closing_balance: Option<String>,
) -> Result<Vec<Transaction>, String> {
    if inputs.is_empty() {
        return Err("selecione pelo menos um lançamento para importar".into());
    }
    if inputs.len() > 2_000 {
        return Err("importe no máximo 2.000 lançamentos por arquivo".into());
    }
    let repository = FinanceRepository::new(&state.pool);
    let closing_balance = closing_balance
        .map(|value| {
            value
                .parse::<Decimal>()
                .map_err(|_| "saldo final inválido".to_string())
        })
        .transpose()?;
    let mut records = Vec::with_capacity(inputs.len());
    for input in inputs {
        let category_id = input
            .category_id
            .ok_or_else(|| "selecione uma categoria para cada lançamento".to_string())?;
        let category_kind = repository
            .category_kind(category_id)
            .await
            .map_err(|error| error.to_string())?
            .ok_or_else(|| "categoria não encontrada".to_string())?;
        if category_kind != input.kind {
            return Err("a categoria não corresponde ao tipo do lançamento".into());
        }
        if let Some(card_id) = input.debit_card_id {
            if repository
                .get_debit_card(card_id)
                .await
                .map_err(|error| error.to_string())?
                .is_none()
            {
                return Err("cartão sugerido não encontrado".into());
            }
        }
        let record = Transaction::new(input).map_err(|error| error.to_string())?;
        records.push(record);
    }
    repository
        .import_transactions(&records, closing_balance)
        .await
        .map_err(|error| error.to_string())?;
    Ok(records)
}

#[tauri::command]
pub async fn delete_transaction(state: State<'_, AppState>, id: Uuid) -> Result<(), String> {
    let repository = FinanceRepository::new(&state.pool);
    let transaction = repository
        .get_transaction(id)
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "transação não encontrada".to_string())?;
    let projected = repository
        .available_balance()
        .await
        .map_err(|error| error.to_string())?
        - transaction_effect(&transaction);
    if projected < Decimal::ZERO {
        return Err("excluir essa entrada deixaria a conta negativa".into());
    }
    repository
        .delete_transaction(id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn update_transaction(
    state: State<'_, AppState>,
    id: Uuid,
    input: NewTransaction,
) -> Result<Transaction, String> {
    let repository = FinanceRepository::new(&state.pool);
    let category_id = input
        .category_id
        .ok_or_else(|| "selecione uma categoria".to_string())?;
    let category_kind = repository
        .category_kind(category_id)
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "categoria não encontrada".to_string())?;
    if category_kind != input.kind {
        return Err("a categoria não corresponde ao tipo da transação".into());
    }
    let current = repository
        .get_transaction(id)
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "transação não encontrada".to_string())?;
    let mut transaction = Transaction::new(input).map_err(|error| error.to_string())?;
    transaction.id = id;
    transaction.created_at = current.created_at;
    let projected = repository
        .available_balance()
        .await
        .map_err(|error| error.to_string())?
        - transaction_effect(&current)
        + transaction_effect(&transaction);
    if projected < Decimal::ZERO {
        return Err("essa alteração deixaria a conta negativa".into());
    }
    validate_card_usage(
        &repository,
        transaction.debit_card_id,
        transaction.amount,
        transaction.date,
        Some(id),
        current.debit_card_id == transaction.debit_card_id,
    )
    .await?;
    repository
        .update_transaction(&transaction)
        .await
        .map_err(|error| error.to_string())?;
    Ok(transaction)
}

#[tauri::command]
pub async fn list_categories(state: State<'_, AppState>) -> Result<Vec<Category>, String> {
    FinanceRepository::new(&state.pool)
        .list_categories()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn add_category(
    state: State<'_, AppState>,
    input: NewCategory,
) -> Result<Category, String> {
    let category = Category::new(input).map_err(|error| error.to_string())?;
    let repository = FinanceRepository::new(&state.pool);
    if repository
        .category_name_exists(category.kind, &category.name)
        .await
        .map_err(|error| error.to_string())?
    {
        return Err("essa categoria já existe para este tipo de movimentação".into());
    }
    repository
        .insert_category(&category)
        .await
        .map_err(|error| error.to_string())?;
    Ok(category)
}

#[tauri::command]
pub async fn list_debit_cards(state: State<'_, AppState>) -> Result<Vec<DebitCard>, String> {
    FinanceRepository::new(&state.pool)
        .list_debit_cards()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn add_debit_card(
    state: State<'_, AppState>,
    input: NewDebitCard,
) -> Result<DebitCard, String> {
    let card = DebitCard::new(input).map_err(|error| error.to_string())?;
    FinanceRepository::new(&state.pool)
        .insert_debit_card(&card)
        .await
        .map_err(|error| error.to_string())?;
    Ok(card)
}

#[tauri::command]
pub async fn update_debit_card_style(
    state: State<'_, AppState>,
    mut input: UpdateDebitCardStyle,
) -> Result<DebitCard, String> {
    validate_style(&input.color_from, &input.color_to, input.emoji.as_deref())
        .map_err(|error| error.to_string())?;
    input.emoji = clean_emoji(input.emoji).map_err(|error| error.to_string())?;

    let repository = FinanceRepository::new(&state.pool);
    repository
        .update_debit_card_style(&input)
        .await
        .map_err(|error| error.to_string())?;

    repository
        .list_debit_cards()
        .await
        .map_err(|error| error.to_string())?
        .into_iter()
        .find(|card| card.id == input.id)
        .ok_or_else(|| "cartão não encontrado".to_string())
}

#[tauri::command]
pub async fn set_debit_card_frozen(
    state: State<'_, AppState>,
    id: Uuid,
    frozen: bool,
) -> Result<(), String> {
    FinanceRepository::new(&state.pool)
        .set_debit_card_frozen(id, frozen)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn set_default_debit_card(state: State<'_, AppState>, id: Uuid) -> Result<(), String> {
    FinanceRepository::new(&state.pool)
        .set_default_debit_card(id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn delete_debit_card(state: State<'_, AppState>, id: Uuid) -> Result<(), String> {
    FinanceRepository::new(&state.pool)
        .delete_debit_card(id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn list_vaults(state: State<'_, AppState>) -> Result<Vec<Vault>, String> {
    FinanceRepository::new(&state.pool)
        .list_vaults()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn add_vault(state: State<'_, AppState>, input: NewVault) -> Result<Vault, String> {
    let vault = Vault::new(input).map_err(|error| error.to_string())?;
    let repository = FinanceRepository::new(&state.pool);
    if vault.balance
        > repository
            .available_balance()
            .await
            .map_err(|error| error.to_string())?
    {
        return Err("não há saldo suficiente na conta para começar esse cofre".into());
    }
    repository
        .insert_vault(&vault)
        .await
        .map_err(|error| error.to_string())?;
    Ok(vault)
}

#[tauri::command]
pub async fn move_vault_money(
    state: State<'_, AppState>,
    input: MoveVaultMoney,
    source: VaultMovementSource,
) -> Result<Vault, String> {
    let repository = FinanceRepository::new(&state.pool);
    if input.kind == VaultMovementType::Deposit
        && input.amount
            > repository
                .available_balance()
                .await
                .map_err(|error| error.to_string())?
    {
        return Err("saldo insuficiente na conta principal para guardar esse valor".into());
    }
    let mut vault = repository
        .get_vault(input.id)
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "cofre não encontrado".to_string())?;
    vault
        .apply_movement(&input)
        .map_err(|error| error.to_string())?;
    let movement = VaultMovement::new(vault.id, input.kind, input.amount, source);
    repository
        .update_vault_balance(&vault, &movement)
        .await
        .map_err(|error| error.to_string())?;
    Ok(vault)
}

#[tauri::command]
pub async fn update_vault(state: State<'_, AppState>, input: UpdateVault) -> Result<Vault, String> {
    let repository = FinanceRepository::new(&state.pool);
    let mut vault = repository
        .get_vault(input.id)
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "cofre não encontrado".to_string())?;
    vault
        .apply_update(input)
        .map_err(|error| error.to_string())?;
    repository
        .update_vault(&vault)
        .await
        .map_err(|error| error.to_string())?;
    Ok(vault)
}

#[tauri::command]
pub async fn delete_vault(state: State<'_, AppState>, id: Uuid) -> Result<(), String> {
    FinanceRepository::new(&state.pool)
        .delete_vault(id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_account_settings(
    state: State<'_, AppState>,
) -> Result<Option<AccountSettings>, String> {
    FinanceRepository::new(&state.pool)
        .get_account_settings()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn save_account_settings(
    state: State<'_, AppState>,
    settings: AccountSettings,
) -> Result<(), String> {
    FinanceRepository::new(&state.pool)
        .save_account_settings(&settings)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn list_vault_movements(
    state: State<'_, AppState>,
) -> Result<Vec<VaultMovement>, String> {
    FinanceRepository::new(&state.pool)
        .list_vault_movements()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn list_automatic_reserve_rules(
    state: State<'_, AppState>,
) -> Result<Vec<AutomaticReserveRule>, String> {
    FinanceRepository::new(&state.pool)
        .list_automatic_reserve_rules()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn save_automatic_reserve_rule(
    state: State<'_, AppState>,
    rule: AutomaticReserveRule,
) -> Result<(), String> {
    rule.validate().map_err(|error| error.to_string())?;
    let repository = FinanceRepository::new(&state.pool);
    if repository
        .get_vault(rule.vault_id)
        .await
        .map_err(|error| error.to_string())?
        .is_none()
    {
        return Err("cofre não encontrado".into());
    }
    repository
        .save_automatic_reserve_rule(&rule)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn remove_automatic_reserve_rule(
    state: State<'_, AppState>,
    vault_id: Uuid,
) -> Result<(), String> {
    FinanceRepository::new(&state.pool)
        .remove_automatic_reserve_rule(vault_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_dashboard_layout(state: State<'_, AppState>) -> Result<Option<String>, String> {
    FinanceRepository::new(&state.pool)
        .get_dashboard_layout()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn save_dashboard_layout(
    state: State<'_, AppState>,
    layout_json: String,
) -> Result<(), String> {
    if layout_json.len() > 20_000
        || serde_json::from_str::<serde_json::Value>(&layout_json).is_err()
    {
        return Err("layout do painel inválido".into());
    }
    FinanceRepository::new(&state.pool)
        .save_dashboard_layout(&layout_json)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn reset_dashboard_layout(state: State<'_, AppState>) -> Result<(), String> {
    FinanceRepository::new(&state.pool)
        .reset_dashboard_layout()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn list_digital_wallet_items(
    state: State<'_, AppState>,
) -> Result<Vec<DigitalWalletItem>, String> {
    FinanceRepository::new(&state.pool)
        .list_digital_wallet_items()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn add_digital_wallet_item(
    state: State<'_, AppState>,
    input: NewDigitalWalletItem,
) -> Result<DigitalWalletItem, String> {
    let item = DigitalWalletItem::new(input).map_err(|error| error.to_string())?;
    FinanceRepository::new(&state.pool)
        .insert_digital_wallet_item(&item)
        .await
        .map_err(|error| error.to_string())?;
    Ok(item)
}

#[tauri::command]
pub async fn delete_digital_wallet_item(
    state: State<'_, AppState>,
    id: Uuid,
) -> Result<(), String> {
    FinanceRepository::new(&state.pool)
        .delete_digital_wallet_item(id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn list_monthly_reserve_rules(
    state: State<'_, AppState>,
) -> Result<Vec<MonthlyReserveRule>, String> {
    FinanceRepository::new(&state.pool)
        .list_monthly_reserve_rules()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn save_monthly_reserve_rule(
    state: State<'_, AppState>,
    rule: MonthlyReserveRule,
) -> Result<(), String> {
    rule.validate().map_err(|error| error.to_string())?;
    let repository = FinanceRepository::new(&state.pool);
    if repository
        .get_vault(rule.vault_id)
        .await
        .map_err(|error| error.to_string())?
        .is_none()
    {
        return Err("cofre não encontrado".into());
    }
    repository
        .save_monthly_reserve_rule(&rule)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn remove_monthly_reserve_rule(
    state: State<'_, AppState>,
    vault_id: Uuid,
) -> Result<(), String> {
    FinanceRepository::new(&state.pool)
        .remove_monthly_reserve_rule(vault_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn process_monthly_reserves(
    state: State<'_, AppState>,
    today: NaiveDate,
) -> Result<u64, String> {
    FinanceRepository::new(&state.pool)
        .process_monthly_reserves(today)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn factory_reset(state: State<'_, AppState>) -> Result<(), String> {
    FinanceRepository::new(&state.pool)
        .factory_reset()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn list_recurring_rules(
    state: State<'_, AppState>,
) -> Result<Vec<RecurringRule>, String> {
    FinanceRepository::new(&state.pool)
        .list_recurring_rules()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn add_recurring_rule(
    state: State<'_, AppState>,
    input: NewRecurringRule,
    today: NaiveDate,
) -> Result<RecurringRule, String> {
    let repository = FinanceRepository::new(&state.pool);
    let category_kind = repository
        .category_kind(input.category_id)
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "categoria não encontrada".to_string())?;
    if category_kind != input.kind {
        return Err("a categoria não corresponde ao tipo da recorrência".into());
    }
    validate_card_usage(
        &repository,
        input.debit_card_id,
        Decimal::ZERO,
        today,
        None,
        false,
    )
    .await?;
    let rule = RecurringRule::new(input, today).map_err(|error| error.to_string())?;
    repository
        .insert_recurring_rule(&rule)
        .await
        .map_err(|error| error.to_string())?;
    Ok(rule)
}

#[tauri::command]
pub async fn update_recurring_rule(
    state: State<'_, AppState>,
    rule: RecurringRule,
) -> Result<RecurringRule, String> {
    rule.validate().map_err(|error| error.to_string())?;
    let repository = FinanceRepository::new(&state.pool);
    let category_kind = repository
        .category_kind(rule.category_id)
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "categoria não encontrada".to_string())?;
    if category_kind != rule.kind {
        return Err("a categoria não corresponde ao tipo da recorrência".into());
    }
    repository
        .update_recurring_rule(&rule)
        .await
        .map_err(|error| error.to_string())?;
    Ok(rule)
}

#[tauri::command]
pub async fn settle_recurring_rule(
    state: State<'_, AppState>,
    id: Uuid,
    today: NaiveDate,
) -> Result<RecurringSettlement, String> {
    let repository = FinanceRepository::new(&state.pool);
    let mut rule = repository
        .get_recurring_rule(id)
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "recorrência não encontrada".to_string())?;
    if !rule.active || today < rule.next_due_date {
        return Err(format!(
            "a confirmação ficará disponível em {}",
            rule.next_due_date.format("%d/%m/%Y")
        ));
    }

    let transaction = Transaction::new(NewTransaction {
        kind: rule.kind,
        amount: rule.amount,
        date: today,
        occurred_at: None,
        category_id: Some(rule.category_id),
        debit_card_id: if rule.kind == TransactionType::Expense {
            rule.debit_card_id
        } else {
            None
        },
        description: rule.description.clone(),
        recurrence: RecurrenceType::Fixed,
    })
    .map_err(|error| error.to_string())?;

    if transaction.kind == TransactionType::Expense
        && transaction.amount
            > repository
                .available_balance()
                .await
                .map_err(|error| error.to_string())?
    {
        return Err("saldo insuficiente para confirmar esta despesa recorrente".into());
    }
    validate_card_usage(
        &repository,
        transaction.debit_card_id,
        transaction.amount,
        transaction.date,
        None,
        false,
    )
    .await?;

    let processed_due_date = rule.next_due_date;
    rule.advance_after(processed_due_date);
    repository
        .settle_recurring_rule(&transaction, &rule)
        .await
        .map_err(|error| error.to_string())?;
    Ok(RecurringSettlement { transaction, rule })
}

#[tauri::command]
pub async fn delete_recurring_rule(state: State<'_, AppState>, id: Uuid) -> Result<(), String> {
    FinanceRepository::new(&state.pool)
        .delete_recurring_rule(id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn import_legacy_app_data(
    state: State<'_, AppState>,
    data: LegacyAppData,
) -> Result<(), String> {
    for rule in &data.automatic_reserve_rules {
        rule.validate().map_err(|error| error.to_string())?;
    }
    for rule in &data.recurring_rules {
        rule.validate().map_err(|error| error.to_string())?;
    }
    FinanceRepository::new(&state.pool)
        .import_legacy_app_data(&data)
        .await
        .map_err(|error| error.to_string())
}

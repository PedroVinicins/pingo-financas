use tauri::State;
use uuid::Uuid;

use crate::{
    db::{AppState, FinanceRepository},
    models::{
        clean_emoji, validate_style, Category, DebitCard, NewCategory, NewDebitCard, NewTransaction,
        Transaction, UpdateDebitCardStyle,
    },
};

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
    if let Some(card_id) = input.debit_card_id {
        let frozen = FinanceRepository::new(&state.pool)
            .debit_card_is_frozen(card_id)
            .await
            .map_err(|error| error.to_string())?;
        if frozen {
            return Err("este cartão está congelado; desbloqueie-o antes de registrar uma compra".into());
        }
    }

    let transaction = Transaction::new(input).map_err(|error| error.to_string())?;
    FinanceRepository::new(&state.pool)
        .insert_transaction(&transaction)
        .await
        .map_err(|error| error.to_string())?;
    Ok(transaction)
}

#[tauri::command]
pub async fn delete_transaction(state: State<'_, AppState>, id: Uuid) -> Result<(), String> {
    FinanceRepository::new(&state.pool)
        .delete_transaction(id)
        .await
        .map_err(|error| error.to_string())
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
    FinanceRepository::new(&state.pool)
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

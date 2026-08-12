use tauri::State;
use uuid::Uuid;

use crate::{
    db::{AppState, FinanceRepository},
    models::{
        clean_emoji, validate_style, Category, DebitCard, MoveVaultMoney, NewCategory, NewDebitCard,
        NewTransaction, NewVault, Transaction, UpdateDebitCardStyle, Vault,
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

    if let Some(card_id) = input.debit_card_id {
        let frozen = repository
            .debit_card_is_frozen(card_id)
            .await
            .map_err(|error| error.to_string())?;
        if frozen {
            return Err("este cartão está congelado; desbloqueie-o antes de registrar uma compra".into());
        }
    }

    let transaction = Transaction::new(input).map_err(|error| error.to_string())?;
    repository
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
    FinanceRepository::new(&state.pool)
        .insert_vault(&vault)
        .await
        .map_err(|error| error.to_string())?;
    Ok(vault)
}

#[tauri::command]
pub async fn move_vault_money(
    state: State<'_, AppState>,
    input: MoveVaultMoney,
) -> Result<Vault, String> {
    let repository = FinanceRepository::new(&state.pool);
    let mut vault = repository
        .get_vault(input.id)
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "cofre não encontrado".to_string())?;
    vault.apply_movement(&input).map_err(|error| error.to_string())?;
    repository
        .update_vault_balance(&vault)
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

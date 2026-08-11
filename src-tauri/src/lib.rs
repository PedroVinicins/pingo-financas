pub mod commands;
pub mod db;
pub mod models;
pub mod services;

use db::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let pool = tauri::async_runtime::block_on(db::init(&handle))?;
            app.manage(AppState { pool });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_transactions,
            commands::add_transaction,
            commands::delete_transaction,
            commands::list_categories,
            commands::add_category,
            commands::list_debit_cards,
            commands::add_debit_card,
            commands::update_debit_card_style,
            commands::set_debit_card_frozen,
            commands::set_default_debit_card,
            commands::delete_debit_card,
            commands::list_vaults,
            commands::add_vault,
            commands::move_vault_money,
            commands::delete_vault,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar a aplicação Tauri");
}

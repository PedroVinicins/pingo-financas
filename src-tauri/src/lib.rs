pub mod commands;
pub mod db;
pub mod mobile_shortcuts;
pub mod models;
pub mod services;

use db::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init());

    #[cfg(mobile)]
    let builder = builder.plugin(tauri_plugin_biometric::init());
    #[cfg(target_os = "android")]
    let builder = builder.plugin(mobile_shortcuts::init());

    builder
        .setup(|app| {
            let handle = app.handle().clone();
            let pool = tauri::async_runtime::block_on(db::init(&handle))?;
            app.manage(AppState { pool });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_transactions,
            commands::add_transaction,
            commands::import_transactions,
            commands::update_transaction,
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
            commands::update_vault,
            commands::delete_vault,
            commands::get_account_settings,
            commands::save_account_settings,
            commands::list_vault_movements,
            commands::list_automatic_reserve_rules,
            commands::save_automatic_reserve_rule,
            commands::remove_automatic_reserve_rule,
            commands::get_dashboard_layout,
            commands::save_dashboard_layout,
            commands::reset_dashboard_layout,
            commands::list_digital_wallet_items,
            commands::add_digital_wallet_item,
            commands::delete_digital_wallet_item,
            commands::list_monthly_reserve_rules,
            commands::save_monthly_reserve_rule,
            commands::remove_monthly_reserve_rule,
            commands::process_monthly_reserves,
            commands::factory_reset,
            commands::restore_backup,
            commands::list_recurring_rules,
            commands::add_recurring_rule,
            commands::update_recurring_rule,
            commands::settle_recurring_rule,
            commands::delete_recurring_rule,
            commands::import_legacy_app_data,
            commands::get_app_lock_config,
            commands::configure_app_lock,
            commands::verify_app_lock_pin,
            commands::change_app_lock_pin,
            commands::set_app_lock_biometric,
            commands::disable_app_lock,
            mobile_shortcuts::pin_card_shortcut,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar a aplicação Tauri");
}

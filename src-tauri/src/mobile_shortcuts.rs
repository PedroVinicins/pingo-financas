use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[cfg(target_os = "android")]
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PinCardShortcutPayload {
    card_id: String,
    label: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PinCardShortcutResult {
    supported: bool,
    requested: bool,
}

#[cfg(target_os = "android")]
mod android {
    use super::*;
    use tauri::{
        plugin::{Builder, PluginHandle, TauriPlugin},
        Manager, Runtime,
    };

    pub(super) struct MobileShortcuts<R: Runtime>(pub(super) PluginHandle<R>);

    pub fn init<R: Runtime>() -> TauriPlugin<R> {
        Builder::new("mobile-shortcuts")
            .setup(|app, api| {
                let handle = api
                    .register_android_plugin("com.pedrosilva.financas", "MobileShortcutsPlugin")?;
                app.manage(MobileShortcuts(handle));
                Ok(())
            })
            .build()
    }

    pub fn pin(
        app: &AppHandle,
        card_id: String,
        label: String,
    ) -> Result<PinCardShortcutResult, String> {
        app.state::<MobileShortcuts<tauri::Wry>>()
            .0
            .run_mobile_plugin("pinCardShortcut", PinCardShortcutPayload { card_id, label })
            .map_err(|error| error.to_string())
    }
}

#[cfg(target_os = "android")]
pub use android::init;

#[tauri::command]
pub fn pin_card_shortcut(
    app: AppHandle,
    card_id: String,
    label: String,
) -> Result<PinCardShortcutResult, String> {
    if card_id.trim().is_empty() || label.trim().is_empty() {
        return Err("informe o cartão que receberá o atalho".into());
    }

    #[cfg(target_os = "android")]
    {
        android::pin(&app, card_id, label)
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Ok(PinCardShortcutResult {
            supported: false,
            requested: false,
        })
    }
}

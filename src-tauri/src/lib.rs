mod quarksup;
mod wifi;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, WindowEvent};

#[tauri::command]
fn current_ssid() -> Result<Option<String>, String> {
    wifi::current_ssid()
}

// Doit rester async : créer une fenêtre depuis une commande synchrone bloque le thread UI sur Windows.
#[tauri::command]
async fn open_quarksup_window(app: AppHandle) -> Result<(), String> {
    quarksup::open_window(&app)
}

#[tauri::command]
async fn quarksup_session(app: AppHandle) -> Result<Option<quarksup::Session>, String> {
    quarksup::session(&app).await
}

#[tauri::command]
async fn quarksup_fetch(app: AppHandle, request: quarksup::ApiRequest) -> Result<quarksup::ApiResponse, String> {
    quarksup::fetch(&app, &request).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let open = MenuItem::with_id(app, "open", "Ouvrir", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;
            let icon = app.default_window_icon().ok_or("icône de l'app introuvable")?.clone();

            TrayIconBuilder::new()
                .icon(icon)
                .tooltip("EZTT")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            current_ssid,
            open_quarksup_window,
            quarksup_session,
            quarksup_fetch
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

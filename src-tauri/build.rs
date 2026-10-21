const APP_COMMANDS: &[&str] = &["current_ssid", "open_quarksup_window", "quarksup_session", "quarksup_fetch"];

fn main() {
    let manifest = tauri_build::AppManifest::new().commands(APP_COMMANDS);
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(manifest))
        .expect("failed to run tauri-build");
}

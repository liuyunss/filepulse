pub mod commands;
pub mod error;

use commands::{file_delete, file_dissolve, file_scan, rule_store};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if let Err(e) = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![
            file_scan::scan_files,
            file_delete::delete_files,
            file_dissolve::dissolve_folder,
            rule_store::load_rules,
            rule_store::save_rules,
        ])
        .run(tauri::generate_context!())
    {
        eprintln!("Error while running Tauri application: {}", e);
    }
}

pub mod commands;
pub mod config;

use commands::{
    file_dedupe, file_dedupe_streaming, file_delete, file_delete_streaming, file_dissolve,
    file_dissolve_streaming, file_reveal, file_rotate, file_scan, file_scan_streaming, rule_store,
};

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
            // Original commands (kept for backward compatibility)
            file_scan::scan_files,
            file_dedupe::find_duplicates,
            file_dedupe::delete_duplicates,
            file_delete::delete_files,
            file_delete::delete_empty_dirs,
            file_dissolve::dissolve_folder,
            file_reveal::show_in_folder,
            file_rotate::rotate_file,
            file_rotate::preview_rotate,
            rule_store::load_rules,
            rule_store::save_rules,
            // Streaming commands (Channel API)
            file_scan_streaming::scan_files_streaming,
            file_delete_streaming::delete_files_streaming,
            file_delete_streaming::delete_empty_dirs_streaming,
            file_dissolve_streaming::dissolve_folder_streaming,
            file_dedupe_streaming::find_duplicates_streaming,
            file_dedupe_streaming::delete_duplicates_streaming,
        ])
        .run(tauri::generate_context!())
    {
        eprintln!("Error while running Tauri application: {}", e);
    }
}

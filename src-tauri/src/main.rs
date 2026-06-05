#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Clone)]
struct FileInfo {
    name: String,
    path: String,
    size: u64,
    extension: String,
    modified: String,
}

#[tauri::command]
fn scan_folder(path: String) -> Result<Vec<FileInfo>, String> {
    let mut files = Vec::new();
    for entry in WalkDir::new(&path).follow_links(false).into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() { continue; }
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        let entry_path = entry.path();
        let relative = entry_path.strip_prefix(&path).unwrap_or(entry_path)
            .to_string_lossy().replace('\\', "/");
        files.push(FileInfo {
            name: entry.file_name().to_string_lossy().to_string(),
            path: relative.clone(),
            size: metadata.len(),
            extension: entry_path.extension()
                .map(|e| e.to_string_lossy().to_string())
                .unwrap_or_default(),
            modified: fmt_time(metadata.modified().unwrap_or(std::time::UNIX_EPOCH)),
        });
    }
    Ok(files)
}

#[tauri::command]
fn delete_files(paths: Vec<String>, base_dir: String) -> Result<u32, String> {
    let mut count = 0;
    for p in &paths {
        let full = Path::new(&base_dir).join(p);
        eprintln!("[FilePulse] 删除文件: {}", full.display());
        if full.exists() {
            fs::remove_file(&full).map_err(|e| format!("{}: {}", p, e))?;
            count += 1;
        }
    }
    Ok(count)
}

/// Rust 直接弹原生文件夹选择框
#[tauri::command]
fn pick_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let path = app.dialog()
        .file()
        .set_title("选择要处理的文件夹")
        .blocking_pick_folder();
    Ok(path.map(|p| p.to_string()))
}

fn fmt_time(t: std::time::SystemTime) -> String {
    let secs = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();
    let days = secs / 86400; let s = secs % 86400;
    let (y, m, d) = to_ymd(days as i64);
    format!("{:04}-{:02}-{:02} {:02}:{:02}:{:02}", y, m, d, s/3600, (s%3600)/60, s%60)
}

fn to_ymd(mut days: i64) -> (i64, u32, u32) {
    days += 719468;
    let era = (if days >= 0 { days } else { days - 146096 }) / 146097;
    let doe = (days - era * 146097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    (if mp < 10 { y + 1 } else { y }, if mp < 10 { mp + 3 } else { mp - 9 }, doy - (153 * mp + 2) / 5 + 1)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![scan_folder, delete_files, pick_folder])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

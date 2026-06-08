use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct DeleteResult {
    pub deleted: Vec<String>,
    pub failed: Vec<String>,
}

#[tauri::command]
pub fn delete_files(paths: Vec<String>) -> Result<DeleteResult, String> {
    let mut deleted = Vec::new();
    let mut failed = Vec::new();

    for path_str in &paths {
        let path = PathBuf::from(path_str);
        if !path.exists() {
            continue;
        }

        // Safety: block system directories
        let path_lower = path_str.to_lowercase();
        if is_system_path(&path_lower) {
            eprintln!("Skipping system path: {}", path_str);
            continue;
        }

        match trash::delete(&path) {
            Ok(_) => deleted.push(path_str.clone()),
            Err(e) => {
                eprintln!("Failed to trash {}: {}", path_str, e);
                failed.push(path_str.clone());
            }
        }
    }

    Ok(DeleteResult { deleted, failed })
}

fn is_system_path(path: &str) -> bool {
    let system_dirs = [
        "c:\\windows",
        "c:\\program files",
        "c:\\program files (x86)",
        "/system",
        "/usr",
        "/bin",
        "/sbin",
        "/etc",
        "/var",
        "/root",
    ];
    system_dirs.iter().any(|d| path.starts_with(d))
}

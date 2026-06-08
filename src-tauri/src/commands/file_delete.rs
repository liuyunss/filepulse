use std::path::PathBuf;

#[tauri::command]
pub fn delete_files(paths: Vec<String>) -> Result<Vec<String>, String> {
    let mut deleted = Vec::new();

    for path_str in &paths {
        let path = PathBuf::from(path_str);
        if !path.exists() {
            continue;
        }

        // Safety: block system directories
        let path_lower = path_str.to_lowercase();
        if is_system_path(&path_lower) {
            return Err(format!("Cannot delete system path: {}", path_str));
        }

        match trash::delete(&path) {
            Ok(_) => deleted.push(path_str.clone()),
            Err(e) => {
                // Fallback to permanent delete
                if path.is_dir() {
                    match std::fs::remove_dir_all(&path) {
                        Ok(_) => deleted.push(path_str.clone()),
                        Err(e2) => eprintln!("Failed to delete {}: {}", path_str, e2),
                    }
                } else {
                    match std::fs::remove_file(&path) {
                        Ok(_) => deleted.push(path_str.clone()),
                        Err(e2) => eprintln!("Failed to delete {}: {}", path_str, e2),
                    }
                }
            }
        }
    }

    Ok(deleted)
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

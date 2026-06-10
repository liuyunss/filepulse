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

#[tauri::command]
pub fn delete_empty_dirs(root: String, dry_run: bool) -> Result<DeleteResult, String> {
    let root_path = PathBuf::from(&root);
    if !root_path.exists() || !root_path.is_dir() {
        return Err(format!("Not a directory: {}", root));
    }

    let mut deleted = Vec::new();
    let mut failed = Vec::new();
    collect_empty_dirs(&root_path, &root_path, &mut deleted, &mut failed, dry_run)?;
    Ok(DeleteResult { deleted, failed })
}

fn collect_empty_dirs(
    root: &PathBuf,
    current: &PathBuf,
    deleted: &mut Vec<String>,
    failed: &mut Vec<String>,
    dry_run: bool,
) -> Result<(), String> {
    let entries: Vec<PathBuf> = std::fs::read_dir(current)
        .map_err(|e| format!("Failed to read {}: {}", current.display(), e))?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .collect();

    // Process children first (bottom-up)
    for path in &entries {
        if path.is_dir() {
            collect_empty_dirs(root, path, deleted, failed, dry_run)?;
        }
    }

    // Skip root itself
    if current == root {
        return Ok(());
    }

    // Check if this directory is now empty
    let is_empty = std::fs::read_dir(current)
        .map(|mut d| d.next().is_none())
        .unwrap_or(false);

    if is_empty {
        let path_str = current.to_string_lossy().to_string();
        if dry_run {
            deleted.push(path_str);
        } else {
            match trash::delete(current) {
                Ok(_) => deleted.push(path_str),
                Err(e) => {
                    eprintln!("Failed to trash empty dir {}: {}", path_str, e);
                    failed.push(path_str);
                }
            }
        }
    }

    Ok(())
}

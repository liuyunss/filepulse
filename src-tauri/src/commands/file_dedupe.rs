use md5::{Md5, Digest};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateGroup {
    pub files: Vec<DuplicateFile>,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateFile {
    pub path: String,
    pub modified: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DedupeAction {
    pub delete_paths: Vec<String>,
}

#[tauri::command]
pub fn find_duplicates(root: String) -> Result<Vec<DuplicateGroup>, String> {
    let root = PathBuf::from(&root);
    if !root.exists() || !root.is_dir() {
        return Err(format!("Not a directory: {}", root.display()));
    }

    // Phase 1: collect files grouped by size
    let mut by_size: HashMap<u64, Vec<PathBuf>> = HashMap::new();
    for entry in WalkDir::new(&root).follow_links(false).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path().to_path_buf();
        if path.is_dir() { continue; }
        if let Ok(meta) = entry.metadata() {
            let size = meta.len();
            if size > 0 {
                by_size.entry(size).or_default().push(path);
            }
        }
    }

    // Phase 2: within same-size groups, compute MD5 to find true duplicates
    let mut by_md5: HashMap<String, Vec<PathBuf>> = HashMap::new();
    for (_size, paths) in by_size {
        if paths.len() < 2 { continue; }
        let mut size_groups: HashMap<String, Vec<PathBuf>> = HashMap::new();
        for path in &paths {
            if let Ok(hash) = file_md5(path) {
                size_groups.entry(hash).or_default().push(path.clone());
            }
        }
        for (hash, group) in size_groups {
            if group.len() > 1 {
                by_md5.insert(hash, group);
            }
        }
    }

    // Phase 3: build result with modification times
    let mut groups: Vec<DuplicateGroup> = Vec::new();
    for (_hash, paths) in by_md5 {
        let first_size = std::fs::metadata(&paths[0]).map(|m| m.len()).unwrap_or(0);
        let files: Vec<DuplicateFile> = paths.iter().map(|p| {
            let modified = std::fs::metadata(p)
                .and_then(|m| m.modified())
                .map(|t| {
                    let dt: chrono::DateTime<chrono::Local> = t.into();
                    dt.format("%Y-%m-%d %H:%M:%S").to_string()
                })
                .unwrap_or_default();
            DuplicateFile {
                path: p.to_string_lossy().to_string(),
                modified,
            }
        }).collect();
        groups.push(DuplicateGroup { files, size: first_size });
    }

    Ok(groups)
}

#[tauri::command]
pub fn delete_duplicates(action: DedupeAction) -> Result<Vec<String>, String> {
    let mut deleted = Vec::new();
    for path_str in &action.delete_paths {
        let path = PathBuf::from(path_str);
        if !path.exists() { continue; }
        match trash::delete(&path) {
            Ok(_) => deleted.push(path_str.clone()),
            Err(e) => eprintln!("Failed to delete {}: {}", path_str, e),
        }
    }
    Ok(deleted)
}

fn file_md5(path: &PathBuf) -> Result<String, String> {
    let data = std::fs::read(path).map_err(|e| format!("Read error: {}", e))?;
    let mut hasher = Md5::new();
    hasher.update(&data);
    Ok(format!("{:x}", hasher.finalize()))
}

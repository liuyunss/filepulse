use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileItem {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub is_dir: bool,
    pub is_empty: bool,
    pub modified: String,
    pub extension: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanOptions {
    pub path: String,
    pub recursive: bool,
}

#[tauri::command]
pub fn scan_files(options: ScanOptions) -> Result<Vec<FileItem>, String> {
    let root = PathBuf::from(&options.path);
    if !root.exists() {
        return Err(format!("Path does not exist: {}", options.path));
    }

    let mut items = Vec::new();

    let walker = if options.recursive {
        WalkDir::new(&root).follow_links(true)
    } else {
        WalkDir::new(&root).max_depth(1).follow_links(true)
    };

    for entry in walker.into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        let meta = match std::fs::metadata(path) {
            Ok(m) => m,
            Err(_) => continue,
        };

        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        let extension = path
            .extension()
            .map(|e| e.to_string_lossy().to_string())
            .unwrap_or_default();

        let modified = meta
            .modified()
            .map(|t| {
                let datetime: chrono::DateTime<chrono::Local> = t.into();
                datetime.format("%Y-%m-%d %H:%M:%S").to_string()
            })
            .unwrap_or_default();

        let is_empty = if meta.is_dir() {
            std::fs::read_dir(path)
                .map(|mut entries| entries.next().is_none())
                .unwrap_or(true)
        } else {
            false
        };

        items.push(FileItem {
            path: path.to_string_lossy().to_string(),
            name,
            size: meta.len(),
            is_dir: meta.is_dir(),
            is_empty,
            modified,
            extension,
        });
    }

    Ok(items)
}

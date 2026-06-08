use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DissolveResult {
    pub original: String,
    pub new_path: String,
}

#[tauri::command]
pub fn dissolve_folder(
    path: String,
    keep_levels: u32,
    dry_run: bool,
) -> Result<Vec<DissolveResult>, String> {
    let root = PathBuf::from(&path);
    if !root.exists() || !root.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }

    let mut results = Vec::new();
    collect_files(&root, &root, keep_levels, 0, &mut results, dry_run)?;

    Ok(results)
}

fn collect_files(
    root: &PathBuf,
    current: &PathBuf,
    keep_levels: u32,
    depth: u32,
    results: &mut Vec<DissolveResult>,
    dry_run: bool,
) -> Result<(), String> {
    for entry in std::fs::read_dir(current).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;

        if meta.is_dir() {
            collect_files(root, &path, keep_levels, depth + 1, results, dry_run)?;
        } else {
            // Calculate relative depth from root
            let relative_depth = path
                .components()
                .count()
                .saturating_sub(root.components().count());

            if relative_depth > keep_levels as usize {
                // Move file up to keep_levels depth
                let target_dir = get_target_dir(root, &path, keep_levels);
                let file_name = path.file_name()
                    .ok_or_else(|| format!("Cannot get filename for: {}", path.display()))?;
                let target_path = target_dir.join(file_name);

                results.push(DissolveResult {
                    original: path.to_string_lossy().to_string(),
                    new_path: target_path.to_string_lossy().to_string(),
                });

                if !dry_run {
                    if !target_dir.exists() {
                        std::fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
                    }
                    std::fs::rename(&path, &target_path).or_else(|e| {
                        // Cross-filesystem rename may fail; fall back to copy+remove
                        std::fs::copy(&path, &target_path).map_err(|e2| {
                            format!("rename failed ({}) and copy also failed ({})", e, e2)
                        })?;
                        std::fs::remove_file(&path).map_err(|e2| {
                            format!("copy succeeded but removing source failed: {}", e2)
                        })
                    }).map_err(|e| e.to_string())?;
                }
            }
        }
    }

    // Clean up empty directories if not dry_run
    if !dry_run {
        clean_empty_dirs(current)?;
    }

    Ok(())
}

fn get_target_dir(root: &PathBuf, file_path: &PathBuf, keep_levels: u32) -> PathBuf {
    let components: Vec<_> = file_path
        .components()
        .collect();
    let root_components: Vec<_> = root.components().collect();

    let mut target = PathBuf::new();
    // Keep root components
    for comp in &root_components {
        target.push(comp);
    }
    // Keep additional levels
    let extra = components.len() - root_components.len();
    let levels_to_keep = keep_levels as usize;
    if extra > levels_to_keep {
        for i in 0..levels_to_keep {
            target.push(&components[root_components.len() + i]);
        }
    }

    target
}

fn clean_empty_dirs(dir: &PathBuf) -> Result<(), String> {
    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            clean_empty_dirs(&path)?;
            // Check if empty after cleaning children
            if std::fs::read_dir(&path)
                .map_err(|e| e.to_string())?
                .next()
                .is_none()
            {
                std::fs::remove_dir(&path).map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

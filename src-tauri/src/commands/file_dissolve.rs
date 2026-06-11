use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DissolveResult {
    pub name: String,        // relative file path from root
    pub target: String,      // target relative path (may differ if renamed)
    pub action: String,      // "move" or "skip"
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

    // Phase 1: collect all files that need to be moved
    let mut candidates: Vec<(PathBuf, PathBuf)> = Vec::new();
    let root_comp_count = root.components().count();
    super::dissolve_helpers::collect_candidates(&root, &root, keep_levels, root_comp_count, &mut candidates)?;

    // Phase 2: build target paths and detect conflicts
    let mut results = Vec::new();
    // target_path -> list of (source_path, index)
    let mut conflict_map: HashMap<PathBuf, Vec<usize>> = HashMap::new();

    for (src, tgt) in &candidates {
        let idx = results.len();
        results.push(DissolveResult {
            name: super::dissolve_helpers::strip_root(&root, src),
            target: super::dissolve_helpers::strip_root(&root, tgt),
            action: "move".into(),
        });
        conflict_map.entry(tgt.clone()).or_default().push(idx);
    }

    // Phase 3: resolve conflicts — check content, skip dupes, rename others
    for (target_path, indices) in &conflict_map {
        if indices.len() <= 1 {
            continue; // no conflict
        }

        // Sort indices by source path for stable ordering
        let mut sorted_indices = indices.clone();
        sorted_indices.sort_by_key(|&i| &results[i].name);

        // Compare content of the first one against others
        let first_idx = sorted_indices[0];
        let first_src = &candidates[first_idx].0;

        for &other_idx in &sorted_indices[1..] {
            let other_src = &candidates[other_idx].0;

            // Same content → skip duplicate
            if super::dissolve_helpers::files_equal(first_src, other_src) {
                results[other_idx].action = "skip".into();
                results[other_idx].target = format!("(重复文件，已跳过)");
                continue;
            }

            // Different content → rename
            let stem = target_path.file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            let ext = target_path.extension()
                .map(|s| format!(".{}", s.to_string_lossy()))
                .unwrap_or_default();
            let parent = target_path.parent().unwrap_or(target_path);

            // Find available name: file.ext → file (1).ext → file (2).ext ...
            let mut counter = 1u32;
            loop {
                let new_name = format!("{} ({}){}", stem, counter, ext);
                let new_path = parent.join(&new_name);
                if !new_path.exists() && !conflict_map.contains_key(&new_path) {
                    results[other_idx].target = super::dissolve_helpers::strip_root(&root, &new_path);
                    break;
                }
                counter += 1;
                if counter > 999 {
                    // fallback: use unique suffix
                    let new_name = format!("{}_{}{}", stem, other_src
                        .file_stem()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_default(), ext);
                    let new_path = parent.join(&new_name);
                    results[other_idx].target = super::dissolve_helpers::strip_root(&root, &new_path);
                    break;
                }
            }
        }
    }

    // Phase 4: execute moves (skip "skip" actions)
    if !dry_run {
        for (i, (src, _tgt)) in candidates.iter().enumerate() {
            if results[i].action == "skip" {
                continue;
            }
            // Reconstruct full target path from root + relative target
            let full_tgt = root.join(&results[i].target.replace('/', "\\"));
            if let Some(p) = full_tgt.parent() {
                if !p.exists() {
                    std::fs::create_dir_all(p).map_err(|e| e.to_string())?;
                }
            }
            std::fs::rename(src, &full_tgt)
                .or_else(|e| {
                    std::fs::copy(src, &full_tgt).map_err(|e2| {
                        format!("rename({}) + copy({}) failed: {} / {}", src.display(), full_tgt.display(), e, e2)
                    })?;
                    std::fs::remove_file(src).map_err(|e2| {
                        format!("copy ok but remove failed: {}", e2)
                    })
                })
                .map_err(|e| e.to_string())?;
        }
        // Clean empty dirs
        super::dissolve_helpers::clean_empty_dirs(&root)?;
    }

    Ok(results)
}

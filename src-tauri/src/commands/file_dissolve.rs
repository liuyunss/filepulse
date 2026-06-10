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
    collect_candidates(&root, &root, keep_levels, root_comp_count, &mut candidates)?;

    // Phase 2: build target paths and detect conflicts
    let mut results = Vec::new();
    // target_path -> list of (source_path, index)
    let mut conflict_map: HashMap<PathBuf, Vec<usize>> = HashMap::new();

    for (src, tgt) in &candidates {
        let idx = results.len();
        results.push(DissolveResult {
            name: strip_root(&root, src),
            target: strip_root(&root, tgt),
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
            if files_equal(first_src, other_src) {
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
                    results[other_idx].target = strip_root(&root, &new_path);
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
                    results[other_idx].target = strip_root(&root, &new_path);
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
        clean_empty_dirs(&root)?;
    }

    Ok(results)
}

/// Collect files that need to move. Returns (source_path, target_path).
fn collect_candidates(
    root: &PathBuf,
    current: &PathBuf,
    keep_levels: u32,
    root_comp_count: usize,
    candidates: &mut Vec<(PathBuf, PathBuf)>,
) -> Result<(), String> {
    for entry in std::fs::read_dir(current).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.is_dir() {
            collect_candidates(root, &path, keep_levels, root_comp_count, candidates)?;
        } else {
            // Relative depth = directory levels between root and file (excluding filename)
            let comp_count = path.components().count();
            // Subtract root components + 1 (the filename itself)
            let dir_depth = comp_count.saturating_sub(root_comp_count).saturating_sub(1);

            if dir_depth > keep_levels as usize {
                let target = get_target_dir(root, &path, keep_levels, root_comp_count);
                let fname = path.file_name().unwrap_or_default();
                candidates.push((path.clone(), target.join(fname)));
            }
        }
    }
    Ok(())
}

/// Compute target directory based on keep_levels.
/// keep_levels=0 → file moves to root.
/// keep_levels=1 → file stays in first subfolder, etc.
fn get_target_dir(
    _root: &PathBuf,
    file_path: &PathBuf,
    keep_levels: u32,
    root_comp_count: usize,
) -> PathBuf {
    let components: Vec<_> = file_path.components().collect();
    let mut target = PathBuf::new();
    for comp in &components[..root_comp_count] {
        target.push(comp);
    }
    // Keep 'keep_levels' directory components (excluding filename)
    let dir_comps = components.len().saturating_sub(root_comp_count).saturating_sub(1);
    let keep = (keep_levels as usize).min(dir_comps);
    for i in 0..keep {
        target.push(&components[root_comp_count + i]);
    }
    target
}

/// Strip the root prefix from a path, returning a relative path with forward slashes.
fn strip_root(root: &PathBuf, path: &PathBuf) -> String {
    path.strip_prefix(root)
        .map(|p| p.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| path.to_string_lossy().replace('\\', "/"))
}

/// Compare two files byte-by-byte. Returns true if identical.
fn files_equal(a: &PathBuf, b: &PathBuf) -> bool {
    if a == b { return true; }
    let meta_a = std::fs::metadata(a);
    let meta_b = std::fs::metadata(b);
    if let (Ok(ma), Ok(mb)) = (meta_a, meta_b) {
        if ma.len() != mb.len() { return false; }
    }
    let data_a = std::fs::read(a);
    let data_b = std::fs::read(b);
    match (data_a, data_b) {
        (Ok(da), Ok(db)) => da == db,
        _ => false,
    }
}

fn clean_empty_dirs(dir: &PathBuf) -> Result<(), String> {
    // Skip root itself
    let entries: Vec<PathBuf> = std::fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .collect();

    for path in &entries {
        if path.is_dir() {
            clean_empty_dirs(path)?;
            if std::fs::read_dir(path)
                .map(|mut d| d.next().is_none())
                .unwrap_or(false)
            {
                std::fs::remove_dir(path).map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

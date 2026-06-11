/// Shared helper functions for dissolve operations.
///
/// Used by both `file_dissolve.rs` (sync) and `file_dissolve_streaming.rs` (streaming).
/// Extracted here to eliminate duplication.

use std::path::{Path, PathBuf};

/// Collect files that need to move. Returns (source_path, target_path).
pub fn collect_candidates(
    root: &Path,
    current: &Path,
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
            let comp_count = path.components().count();
            let dir_depth = comp_count
                .saturating_sub(root_comp_count)
                .saturating_sub(1);
            if dir_depth > keep_levels as usize {
                let target =
                    get_target_dir(root, &path, keep_levels, root_comp_count);
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
pub fn get_target_dir(
    _root: &Path,
    file_path: &Path,
    keep_levels: u32,
    root_comp_count: usize,
) -> PathBuf {
    let components: Vec<_> = file_path.components().collect();
    let mut target = PathBuf::new();
    for comp in &components[..root_comp_count] {
        target.push(comp);
    }
    let dir_comps = components.len().saturating_sub(root_comp_count).saturating_sub(1);
    let keep = (keep_levels as usize).min(dir_comps);
    for i in 0..keep {
        target.push(&components[root_comp_count + i]);
    }
    target
}

/// Strip the root prefix from a path, returning a relative path with forward slashes.
pub fn strip_root(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .map(|p| p.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| path.to_string_lossy().replace('\\', "/"))
}

/// Compare two files byte-by-byte. Returns true if identical.
pub fn files_equal(a: &Path, b: &Path) -> bool {
    if a == b {
        return true;
    }
    let meta_a = std::fs::metadata(a);
    let meta_b = std::fs::metadata(b);
    if let (Ok(ma), Ok(mb)) = (meta_a, meta_b) {
        if ma.len() != mb.len() {
            return false;
        }
    }
    let data_a = std::fs::read(a);
    let data_b = std::fs::read(b);
    match (data_a, data_b) {
        (Ok(da), Ok(db)) => da == db,
        _ => false,
    }
}

/// Recursively remove empty directories bottom-up.
pub fn clean_empty_dirs(dir: &Path) -> Result<(), String> {
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

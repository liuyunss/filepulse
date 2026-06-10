use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::io::Write;
use std::path::PathBuf;
use std::time::Instant;
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

/// Write debug timing to temp file + stderr so we can always find the logs
fn debug_log(msg: &str) {
    let log_path = std::env::temp_dir().join("filepulse_scan_debug.log");
    let ts = chrono::Local::now().format("%H:%M:%S%.3f");
    let line = format!("[{}] {}\n", ts, msg);
    // Write to file (create if not exists, truncate on first write)
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        let _ = f.write_all(line.as_bytes());
        let _ = f.flush();
    }
    // Also write to stderr for terminal visibility
    let _ = std::io::stderr().write_all(line.as_bytes());
    let _ = std::io::stderr().flush();
}

#[tauri::command]
pub async fn scan_files(options: ScanOptions) -> Result<Vec<FileItem>, String> {
    let path = options.path.clone();
    let recursive = options.recursive;

    debug_log(&format!("=== SCAN START: path={}, recursive={} ===", path, recursive));

    // spawn_blocking: runs on tokio's dedicated blocking thread pool
    // — does NOT block async workers, so concurrent requests don't deadlock
    let result = tauri::async_runtime::spawn_blocking(move || {
        scan_files_sync(&path, recursive)
    })
    .await
    .map_err(|e| format!("Scan task panicked: {}", e))??;

    debug_log(&format!("=== SCAN DONE (returning to frontend, {} items) ===", result.len()));
    Ok(result)
}

fn scan_files_sync(path_str: &str, recursive: bool) -> Result<Vec<FileItem>, String> {
    let total_start = Instant::now();
    let root = PathBuf::from(path_str);
    if !root.exists() {
        return Err(format!("Path does not exist: {}", path_str));
    }

    // ===== Phase 1: WalkDir traversal =====
    debug_log("Phase 1: WalkDir traversal starting...");
    let walk_start = Instant::now();
    let walker = if recursive {
        WalkDir::new(&root).follow_links(false)
    } else {
        WalkDir::new(&root).max_depth(1).follow_links(false)
    };

    let mut entries: Vec<walkdir::DirEntry> = Vec::new();
    for entry in walker.into_iter().filter_map(|e| e.ok()) {
        entries.push(entry);
    }
    let walk_dur = walk_start.elapsed();
    debug_log(&format!(
        "Phase 1 DONE: {} entries collected in {:.2?}",
        entries.len(),
        walk_dur
    ));

    // Early exit for empty directories
    if entries.len() <= 1 {
        debug_log("Only root entry found, returning early");
        return Ok(vec![]);
    }

    // ===== Phase 2: Build non_empty dirs HashSet =====
    debug_log("Phase 2: Building non-empty dir set...");
    let set_start = Instant::now();
    let mut non_empty_dirs: HashSet<PathBuf> = HashSet::new();
    for entry in &entries {
        if let Some(parent) = entry.path().parent() {
            if parent.starts_with(&root) {
                non_empty_dirs.insert(parent.to_path_buf());
            }
        }
    }
    let set_dur = set_start.elapsed();
    debug_log(&format!(
        "Phase 2 DONE: {} non-empty dirs in {:.2?}",
        non_empty_dirs.len(),
        set_dur
    ));

    // ===== Phase 3: metadata + build FileItem array =====
    debug_log("Phase 3: metadata() + building FileItem list...");
    let build_start = Instant::now();
    let mut items = Vec::with_capacity(entries.len());
    let mut meta_errors: u64 = 0;
    let report_every = entries.len() / 10; // report progress roughly 10 times

    for (i, entry) in entries.iter().enumerate() {
        let path = entry.path();

        // entry.metadata() does a stat() syscall — the main cost per file
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => {
                meta_errors += 1;
                continue;
            }
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

        let is_dir = meta.is_dir();
        let is_empty = if is_dir {
            if recursive {
                !non_empty_dirs.contains(path)
            } else {
                path.read_dir()
                    .map(|mut e| e.next().is_none())
                    .unwrap_or(true)
            }
        } else {
            false
        };

        items.push(FileItem {
            path: path.to_string_lossy().to_string(),
            name,
            size: meta.len(),
            is_dir,
            is_empty,
            modified,
            extension,
        });

        // Progress report every ~10%
        if report_every > 0 && i > 0 && i % report_every == 0 {
            let pct = (i as f64 / entries.len() as f64 * 100.0) as u32;
            debug_log(&format!(
                "  ... {}% ({}/{}) processed",
                pct,
                i,
                entries.len()
            ));
        }
    }

    let build_dur = build_start.elapsed();
    let total_dur = total_start.elapsed();
    debug_log(&format!(
        "Phase 3 DONE: {} items ({:?} meta errors) in {:.2?}",
        items.len(),
        meta_errors,
        build_dur
    ));
    debug_log(&format!(
        "=== TOTAL: {} items in {:.2?} (path={}) ===",
        items.len(),
        total_dur,
        path_str
    ));

    Ok(items)
}

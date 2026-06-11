use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::PathBuf;
use tauri::ipc::Channel;

use super::file_scan::FileItem;
use crate::config::get_config;

/// Progress event sent via Channel during scan
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ScanEvent {
    /// Total file count known after WalkDir phase
    #[serde(rename = "total")]
    Total { total: usize },
    /// Batch of scanned items (max batch_size per push)
    #[serde(rename = "batch")]
    Batch {
        items: Vec<FileItem>,
        processed: usize,
        total: usize,
    },
    /// Scan completed
    #[serde(rename = "done")]
    Done { total_items: usize, elapsed_ms: u64 },
    /// Scan failed
    #[serde(rename = "error")]
    Error { message: String },
}

#[tauri::command]
pub async fn scan_files_streaming(
    options: super::file_scan::ScanOptions,
    on_progress: Channel<ScanEvent>,
) -> Result<(), String> {
    let path = options.path.clone();
    let recursive = options.recursive;

    let result = tauri::async_runtime::spawn_blocking(move || {
        let config = get_config();
        scan_files_streaming_sync(&path, recursive, &on_progress, config.scan.batch_size)
    })
    .await
    .map_err(|e| format!("Scan task panicked: {}", e))?;

    result
}

fn scan_files_streaming_sync(
    path_str: &str,
    recursive: bool,
    on_progress: &Channel<ScanEvent>,
    batch_size: usize,
) -> Result<(), String> {
    let total_start = std::time::Instant::now();
    let root = PathBuf::from(path_str);
    if !root.exists() {
        let _ = on_progress.send(ScanEvent::Error {
            message: format!("Path does not exist: {}", path_str),
        });
        return Err(format!("Path does not exist: {}", path_str));
    }

    // ===== Phase 1: WalkDir traversal =====
    let walker = if recursive {
        walkdir::WalkDir::new(&root).follow_links(false)
    } else {
        walkdir::WalkDir::new(&root).max_depth(1).follow_links(false)
    };

    let entries: Vec<walkdir::DirEntry> = walker.into_iter().filter_map(|e| e.ok()).collect();
    let total_entries = entries.len();

    if total_entries <= 1 {
        let _ = on_progress.send(ScanEvent::Total { total: 0 });
        let _ = on_progress.send(ScanEvent::Done {
            total_items: 0,
            elapsed_ms: total_start.elapsed().as_millis() as u64,
        });
        return Ok(());
    }

    // Send total count early so frontend can show determinate progress
    let _ = on_progress.send(ScanEvent::Total {
        total: total_entries,
    });

    // ===== Phase 2: Build non_empty dirs HashSet =====
    let mut non_empty_dirs: HashSet<PathBuf> = HashSet::new();
    for entry in &entries {
        if let Some(parent) = entry.path().parent() {
            if parent.starts_with(&root) {
                non_empty_dirs.insert(parent.to_path_buf());
            }
        }
    }

    // ===== Phase 3: Parallel metadata extraction (rayon) =====
    let paths: Vec<PathBuf> = entries.iter().map(|e| e.path().to_path_buf()).collect();

    let meta_results: Vec<Option<FileItem>> = paths
        .par_iter()
        .map(|path| {
            let meta = std::fs::metadata(path).ok()?;

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

            Some(FileItem {
                path: path.to_string_lossy().to_string(),
                name,
                size: meta.len(),
                is_dir,
                is_empty,
                modified,
                extension,
            })
        })
        .collect();

    // ===== Phase 4: Stream results in batches via Channel =====
    let mut batch: Vec<FileItem> = Vec::with_capacity(batch_size);
    let mut processed = 0usize;

    for item in meta_results.into_iter().flatten() {
        batch.push(item);
        processed += 1;

        if batch.len() >= batch_size {
            let _ = on_progress.send(ScanEvent::Batch {
                items: std::mem::take(&mut batch),
                processed,
                total: total_entries,
            });
            batch = Vec::with_capacity(batch_size);
        }
    }

    // Flush remaining items
    if !batch.is_empty() {
        let _ = on_progress.send(ScanEvent::Batch {
            items: batch,
            processed,
            total: total_entries,
        });
    }

    let elapsed = total_start.elapsed().as_millis() as u64;
    let _ = on_progress.send(ScanEvent::Done {
        total_items: processed,
        elapsed_ms: elapsed,
    });

    Ok(())
}

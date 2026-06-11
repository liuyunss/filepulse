use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::ipc::Channel;

use super::file_delete::DeleteResult;
use crate::config::{get_config, is_system_path};

/// Progress event for delete operations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum DeleteEvent {
    #[serde(rename = "total")]
    Total { total: usize },
    #[serde(rename = "progress")]
    Progress { processed: usize, total: usize },
    #[serde(rename = "done")]
    Done { result: DeleteResult, elapsed_ms: u64 },
    #[serde(rename = "error")]
    Error { message: String },
}

/// Delete files with streaming progress via Channel.
/// Uses rayon for parallel trash operations.
#[tauri::command]
pub async fn delete_files_streaming(
    paths: Vec<String>,
    on_progress: Channel<DeleteEvent>,
) -> Result<(), String> {
    let config = get_config();
    let total = paths.len();
    let _ = on_progress.send(DeleteEvent::Total { total });

    let result = tauri::async_runtime::spawn_blocking(move || {
        let batch_size = config.delete.batch_size;
        delete_files_streaming_sync(paths, &on_progress, batch_size)
    })
    .await
    .map_err(|e| format!("Delete task panicked: {}", e))?;

    result
}

fn delete_files_streaming_sync(
    paths: Vec<String>,
    on_progress: &Channel<DeleteEvent>,
    batch_size: usize,
) -> Result<(), String> {
    let start = std::time::Instant::now();
    let total = paths.len();

    // Parallel delete using rayon
    let results: Vec<(String, bool)> = paths
        .par_iter()
        .map(|path_str| {
            let path = PathBuf::from(path_str);
            if !path.exists() {
                return (path_str.clone(), false);
            }
            let path_lower = path_str.to_lowercase();
            if is_system_path(&path_lower) {
                return (path_str.clone(), false);
            }
            let ok = trash::delete(&path).is_ok();
            (path_str.clone(), ok)
        })
        .collect();

    // Stream progress in batches
    let mut deleted = Vec::new();
    let mut failed = Vec::new();
    let mut processed = 0usize;

    for (path_str, ok) in &results {
        if *ok {
            deleted.push(path_str.clone());
        } else {
            failed.push(path_str.clone());
        }
        processed += 1;

        if processed % batch_size == 0 || processed == total {
            let _ = on_progress.send(DeleteEvent::Progress {
                processed,
                total,
            });
        }
    }

    let elapsed = start.elapsed().as_millis() as u64;
    let _ = on_progress.send(DeleteEvent::Done {
        result: DeleteResult { deleted, failed },
        elapsed_ms: elapsed,
    });

    Ok(())
}

/// Delete empty dirs with streaming progress
#[tauri::command]
pub async fn delete_empty_dirs_streaming(
    root: String,
    dry_run: bool,
    on_progress: Channel<DeleteEvent>,
) -> Result<(), String> {
    let root_path = PathBuf::from(&root);
    if !root_path.exists() || !root_path.is_dir() {
        return Err(format!("Not a directory: {}", root));
    }

    let result = tauri::async_runtime::spawn_blocking(move || {
        let start = std::time::Instant::now();
        let config = get_config();
        let mut deleted = Vec::new();
        let mut failed = Vec::new();

        // Collect empty dirs bottom-up
        let empty_dirs = collect_empty_dirs_for_streaming(&root_path, &root_path);
        let total = empty_dirs.len();

        let _ = on_progress.send(DeleteEvent::Total { total });

        // Delete in parallel (pure work, no IPC)
        let results: Vec<(String, bool)> = empty_dirs
            .par_iter()
            .map(|dir| {
                let path_str = dir.to_string_lossy().to_string();
                if dry_run {
                    return (path_str, true);
                }
                let ok = trash::delete(dir).is_ok();
                (path_str, ok)
            })
            .collect();

        // Stream progress in batches (sequential, after parallel section)
        for (i, (path_str, ok)) in results.into_iter().enumerate() {
            if ok {
                deleted.push(path_str);
            } else {
                failed.push(path_str);
            }
            if (i + 1) % config.delete.batch_size == 0 || i + 1 == total {
                let _ = on_progress.send(DeleteEvent::Progress {
                    processed: i + 1,
                    total,
                });
            }
        }

        let elapsed = start.elapsed().as_millis() as u64;
        let _ = on_progress.send(DeleteEvent::Done {
            result: super::file_delete::DeleteResult { deleted, failed },
            elapsed_ms: elapsed,
        });

        Ok::<(), String>(())
    })
    .await
    .map_err(|e| format!("Delete empty dirs task panicked: {}", e))?;

    result
}

/// Collect empty directories bottom-up (dirs that contain only empty subdirs or nothing)
fn collect_empty_dirs_for_streaming(root: &Path, current: &Path) -> Vec<PathBuf> {
    let mut result = Vec::new();
    let entries: Vec<PathBuf> = std::fs::read_dir(current)
        .map(|rd| rd.filter_map(|e| e.ok().map(|e| e.path())).collect())
        .unwrap_or_default();

    for entry in &entries {
        if entry.is_dir() {
            result.extend(collect_empty_dirs_for_streaming(root, entry));
        }
    }

    if current != root {
        let is_empty = std::fs::read_dir(current)
            .map(|mut d| d.next().is_none())
            .unwrap_or(false);
        if is_empty {
            result.push(current.to_path_buf());
        }
    }

    result
}

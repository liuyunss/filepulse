use md5::{Digest, Md5};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::ipc::Channel;
use walkdir::WalkDir;

use super::file_dedupe::{DuplicateFile, DuplicateGroup};
use crate::config::{get_config, is_system_path};

/// Progress event for dedupe operations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum DedupeEvent {
    #[serde(rename = "phase")]
    Phase { phase: String },
    #[serde(rename = "total")]
    Total { total: usize },
    #[serde(rename = "progress")]
    Progress { processed: usize, total: usize },
    #[serde(rename = "done")]
    Done {
        groups: Vec<DuplicateGroup>,
        elapsed_ms: u64,
    },
    #[serde(rename = "delete_done")]
    DeleteDone { deleted: usize, elapsed_ms: u64 },
    #[serde(rename = "error")]
    Error { message: String },
}

#[tauri::command]
pub async fn find_duplicates_streaming(
    root: String,
    on_progress: Channel<DedupeEvent>,
) -> Result<(), String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        let start = std::time::Instant::now();
        let root_path = PathBuf::from(&root);
        if !root_path.exists() || !root_path.is_dir() {
            let _ = on_progress.send(DedupeEvent::Error {
                message: format!("Not a directory: {}", root),
            });
            return Err(format!("Not a directory: {}", root));
        }

        // Phase 1: collect files grouped by size
        let _ = on_progress.send(DedupeEvent::Phase {
            phase: "collecting".into(),
        });
        let mut by_size: HashMap<u64, Vec<PathBuf>> = HashMap::new();
        for entry in WalkDir::new(&root_path)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path().to_path_buf();
            if path.is_dir() {
                continue;
            }
            if let Ok(meta) = entry.metadata() {
                let size = meta.len();
                if size > 0 {
                    by_size.entry(size).or_default().push(path);
                }
            }
        }

        let total_candidates: usize = by_size.values().filter(|v| v.len() > 1).map(|v| v.len()).sum();
        let _ = on_progress.send(DedupeEvent::Total { total: total_candidates });

        // Phase 2: parallel MD5 hashing within same-size groups
        let _ = on_progress.send(DedupeEvent::Phase {
            phase: "hashing".into(),
        });
        let config = get_config();

        let mut by_md5: HashMap<String, Vec<PathBuf>> = HashMap::new();
        let size_groups: Vec<Vec<PathBuf>> = by_size
            .into_values()
            .filter(|paths| paths.len() > 1)
            .collect();

        for group in &size_groups {
            // Parallel MD5 within each size group
            let hashes: Vec<(String, PathBuf)> = group
                .par_iter()
                .filter_map(|path| {
                    let hash = file_md5(path).ok()?;
                    Some((hash, path.clone()))
                })
                .collect();

            let mut group_by_hash: HashMap<String, Vec<PathBuf>> = HashMap::new();
            for (hash, path) in hashes {
                group_by_hash.entry(hash).or_default().push(path);
            }

            for (hash, paths) in group_by_hash {
                if paths.len() > 1 {
                    by_md5.insert(hash, paths);
                }
            }
        }

        // Phase 3: build result
        let _ = on_progress.send(DedupeEvent::Phase {
            phase: "building".into(),
        });
        let mut groups: Vec<DuplicateGroup> = Vec::new();
        let mut processed = 0;
        let total_groups = by_md5.len();

        for (_hash, paths) in by_md5 {
            let first_size = std::fs::metadata(&paths[0])
                .map(|m| m.len())
                .unwrap_or(0);
            let files: Vec<DuplicateFile> = paths
                .iter()
                .map(|p| {
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
                })
                .collect();
            groups.push(DuplicateGroup {
                files,
                size: first_size,
            });
            processed += 1;

            if processed % config.dedupe.batch_size == 0 {
                let _ = on_progress.send(DedupeEvent::Progress {
                    processed,
                    total: total_groups,
                });
            }
        }

        let elapsed = start.elapsed().as_millis() as u64;
        let _ = on_progress.send(DedupeEvent::Done {
            groups,
            elapsed_ms: elapsed,
        });

        Ok::<(), String>(())
    })
    .await
    .map_err(|e| format!("Dedupe task panicked: {}", e))?;

    result
}

#[tauri::command]
pub async fn delete_duplicates_streaming(
    action: super::file_dedupe::DedupeAction,
    on_progress: Channel<DedupeEvent>,
) -> Result<(), String> {
    let config = get_config();
    let total = action.delete_paths.len();
    let _ = on_progress.send(DedupeEvent::Total { total });

    let result = tauri::async_runtime::spawn_blocking(move || {
        let start = std::time::Instant::now();

        let results: Vec<(String, bool)> = action
            .delete_paths
            .par_iter()
            .map(|path_str| {
                let path = PathBuf::from(path_str);
                let path_lower = path.to_string_lossy().to_lowercase();
                if is_system_path(&path_lower) {
                    return (path_str.clone(), false);
                }
                if !path.exists() {
                    return (path_str.clone(), false);
                }
                let ok = trash::delete(&path).is_ok();
                (path_str.clone(), ok)
            })
            .collect();

        let mut deleted_count = 0usize;
        for (i, (_path_str, ok)) in results.iter().enumerate() {
            if *ok {
                deleted_count += 1;
            }
            if (i + 1) % config.dedupe.batch_size == 0 || i + 1 == total {
                let _ = on_progress.send(DedupeEvent::Progress {
                    processed: i + 1,
                    total,
                });
            }
        }

        let elapsed = start.elapsed().as_millis() as u64;
        let _ = on_progress.send(DedupeEvent::DeleteDone {
            deleted: deleted_count,
            elapsed_ms: elapsed,
        });

        Ok::<(), String>(())
    })
    .await
    .map_err(|e| format!("Delete duplicates task panicked: {}", e))?;

    result
}

fn file_md5(path: &Path) -> Result<String, String> {
    let data = std::fs::read(path).map_err(|e| format!("Read error: {}", e))?;
    let mut hasher = Md5::new();
    hasher.update(&data);
    Ok(format!("{:x}", hasher.finalize()))
}

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::ipc::Channel;

use crate::config::get_config;

/// Progress event for dissolve operations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum DissolveEvent {
    #[serde(rename = "total")]
    Total { total: usize },
    #[serde(rename = "progress")]
    Progress { processed: usize, total: usize },
    #[serde(rename = "done")]
    Done {
        results: Vec<super::file_dissolve::DissolveResult>,
        elapsed_ms: u64,
    },
    #[serde(rename = "error")]
    Error { message: String },
}

#[tauri::command]
pub async fn dissolve_folder_streaming(
    path: String,
    keep_levels: u32,
    dry_run: bool,
    on_progress: Channel<DissolveEvent>,
) -> Result<(), String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        let start = std::time::Instant::now();
        let config = get_config();

        let root = PathBuf::from(&path);
        if !root.exists() || !root.is_dir() {
            let _ = on_progress.send(DissolveEvent::Error {
                message: format!("Not a directory: {}", path),
            });
            return Err(format!("Not a directory: {}", path));
        }

        // Phase 1: collect candidates
        let mut candidates: Vec<(PathBuf, PathBuf)> = Vec::new();
        let root_comp_count = root.components().count();
        super::dissolve_helpers::collect_candidates(&root, &root, keep_levels, root_comp_count, &mut candidates)?;

        let total = candidates.len();
        let _ = on_progress.send(DissolveEvent::Total { total });

        // Phase 2: build target paths and detect conflicts
        let mut results: Vec<super::file_dissolve::DissolveResult> = Vec::new();
        let mut conflict_map: HashMap<PathBuf, Vec<usize>> = HashMap::new();

        for (src, tgt) in &candidates {
            let idx = results.len();
            results.push(super::file_dissolve::DissolveResult {
                name: super::dissolve_helpers::strip_root(&root, src),
                target: super::dissolve_helpers::strip_root(&root, tgt),
                action: "move".into(),
            });
            conflict_map.entry(tgt.clone()).or_default().push(idx);
        }

        // Phase 3: resolve conflicts
        for (target_path, indices) in &conflict_map {
            if indices.len() <= 1 {
                continue;
            }
            let mut sorted_indices = indices.clone();
            sorted_indices.sort_by_key(|&i| &results[i].name);
            let first_idx = sorted_indices[0];
            let first_src = &candidates[first_idx].0;

            for &other_idx in &sorted_indices[1..] {
                let other_src = &candidates[other_idx].0;
                if super::dissolve_helpers::files_equal(first_src, other_src) {
                    results[other_idx].action = "skip".into();
                    results[other_idx].target = "(重复文件，已跳过)".into();
                    continue;
                }

                let stem = target_path
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default();
                let ext = target_path
                    .extension()
                    .map(|s| format!(".{}", s.to_string_lossy()))
                    .unwrap_or_default();
                let parent = target_path.parent().unwrap_or(target_path);

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
                        let new_name = format!(
                            "_{}_{}{}",
                            stem,
                            other_src
                                .file_stem()
                                .map(|s| s.to_string_lossy().to_string())
                                .unwrap_or_default(),
                            ext
                        );
                        let new_path = parent.join(&new_name);
                        results[other_idx].target = super::dissolve_helpers::strip_root(&root, &new_path);
                        break;
                    }
                }
            }
        }

        // Phase 4: execute moves with progress
        if !dry_run {
            for (i, (src, _tgt)) in candidates.iter().enumerate() {
                if results[i].action == "skip" {
                    continue;
                }
                let full_tgt = root.join(&results[i].target);
                if let Some(p) = full_tgt.parent() {
                    if !p.exists() {
                        std::fs::create_dir_all(p).map_err(|e| e.to_string())?;
                    }
                }
                std::fs::rename(src, &full_tgt)
                    .or_else(|e| {
                        std::fs::copy(src, &full_tgt).map_err(|e2| {
                            format!(
                                "rename({}) + copy({}) failed: {} / {}",
                                src.display(),
                                full_tgt.display(),
                                e,
                                e2
                            )
                        })?;
                        std::fs::remove_file(src)
                            .map_err(|e2| format!("copy ok but remove failed: {}", e2))
                    })
                    .map_err(|e| e.to_string())?;

                if (i + 1) % config.dissolve.batch_size == 0 {
                    let _ = on_progress.send(DissolveEvent::Progress {
                        processed: i + 1,
                        total: candidates.len(),
                    });
                }
            }
            super::dissolve_helpers::clean_empty_dirs(&root)?;
        }

        let elapsed = start.elapsed().as_millis() as u64;
        let _ = on_progress.send(DissolveEvent::Done {
            results,
            elapsed_ms: elapsed,
        });

        Ok::<(), String>(())
    })
    .await
    .map_err(|e| format!("Dissolve task panicked: {}", e))?;

    result
}

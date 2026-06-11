/// Centralized configuration for FilePulse backend.
///
/// Currently uses compile-time defaults. Future: expose via tauri-plugin-store
/// or a config.rs Tauri command so the frontend can read/write settings.

use serde::{Deserialize, Serialize};

/// Scan operation configuration (unique: has rayon thread count)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanConfig {
    /// Number of rayon threads for parallel metadata reads (0 = auto)
    pub threads: usize,
    /// Batch size for streaming push to frontend
    pub batch_size: usize,
    /// Minimum interval between progress pushes (ms)
    pub progress_interval_ms: u64,
}

impl Default for ScanConfig {
    fn default() -> Self {
        Self {
            threads: 0, // 0 = rayon auto-detect
            batch_size: 300,
            progress_interval_ms: 100,
        }
    }
}

/// Shared config for delete / dissolve / dedupe operations.
///
/// These three operations had identical structs (batch_size + progress_interval_ms).
/// Merged into one type to eliminate duplication.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationConfig {
    pub batch_size: usize,
    pub progress_interval_ms: u64,
}

impl Default for OperationConfig {
    fn default() -> Self {
        Self {
            batch_size: 50,
            progress_interval_ms: 100,
        }
    }
}

/// Global application configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub scan: ScanConfig,
    pub delete: OperationConfig,
    pub dissolve: OperationConfig,
    pub dedupe: OperationConfig,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            scan: ScanConfig::default(),
            delete: OperationConfig::default(),
            dissolve: OperationConfig::default(),
            dedupe: OperationConfig::default(),
        }
    }
}

/// Check if a path is a critical system directory that must never be modified.
///
/// Used by delete, dedupe, and dissolve streaming commands to guard against
/// accidental destruction of OS-critical paths.
pub fn is_system_path(path: &str) -> bool {
    let system_dirs = [
        "c:\\windows",
        "c:\\program files",
        "c:\\program files (x86)",
        "/system",
        "/usr",
        "/bin",
        "/sbin",
        "/etc",
        "/var",
        "/root",
    ];
    system_dirs.iter().any(|d| path.starts_with(d))
}

/// Get the current app configuration.
/// Future: read from tauri-plugin-store; currently returns defaults.
pub fn get_config() -> AppConfig {
    AppConfig::default()
}

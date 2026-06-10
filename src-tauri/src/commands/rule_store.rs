use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterRule {
    pub id: String,
    pub name: String,
    pub filters: Vec<FilterCondition>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterCondition {
    pub filter_type: String, // "name" | "extension" | "size" | "date" | "empty_dir"
    pub enabled: bool,
    pub operator: Option<String>, // "contains" | "prefix" | "suffix" | ">" | "<" | "=" | "recent" | "before"
    pub value: Option<String>,
    pub unit: Option<String>, // "KB" | "MB" | "GB" | "hour" | "day" | "month"
    pub negate: bool,
}

fn get_rules_path() -> PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("filepulse");
    std::fs::create_dir_all(&config_dir).ok();
    config_dir.join("rules.json")
}

#[tauri::command]
pub fn load_rules() -> Result<Vec<FilterRule>, String> {
    let path = get_rules_path();
    if !path.exists() {
        return Ok(Vec::new());
    }

    let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let rules: Vec<FilterRule> = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(rules)
}

#[tauri::command]
pub fn save_rules(rules: Vec<FilterRule>) -> Result<(), String> {
    let path = get_rules_path();
    let data = serde_json::to_string_pretty(&rules).map_err(|e| e.to_string())?;
    std::fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(())
}

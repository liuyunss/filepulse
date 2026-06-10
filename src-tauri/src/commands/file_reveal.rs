use std::path::Path;

#[tauri::command]
pub fn show_in_folder(path: String) -> Result<(), String> {
    let path = Path::new(&path);
    if !path.exists() {
        return Err(format!("File not found: {}", path.display()));
    }

    #[cfg(target_os = "windows")]
    {
        // Windows: explorer /select,"path" selects the file in Explorer
        std::process::Command::new("explorer")
            .arg("/select,")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to open explorer: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        // macOS: open -R reveals the file in Finder
        std::process::Command::new("open")
            .arg("-R")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to open Finder: {}", e))?;
    }

    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        // Linux: open parent directory
        if let Some(parent) = path.parent() {
            std::process::Command::new("xdg-open")
                .arg(parent)
                .spawn()
                .map_err(|e| format!("Failed to open file manager: {}", e))?;
        }
    }

    Ok(())
}

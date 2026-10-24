use std::fs;
use std::path::PathBuf;

use tauri::Manager;

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|error| format!("Could not read {path}: {error}"))
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("Missing file path.".into());
    }
    fs::write(&path, contents).map_err(|error| format!("Could not write {path}: {error}"))
}

#[tauri::command]
fn list_dir(path: String) -> Result<Vec<String>, String> {
    let mut names = Vec::new();
    let entries = fs::read_dir(&path).map_err(|error| format!("Could not list {path}: {error}"))?;
    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        if let Some(name) = entry.file_name().to_str() {
            names.push(name.to_string());
        }
    }
    names.sort();
    Ok(names)
}

#[tauri::command]
fn create_dir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|error| format!("Could not create {path}: {error}"))
}

#[tauri::command]
fn path_exists(path: String) -> Result<bool, String> {
    Ok(PathBuf::from(path).exists())
}

#[tauri::command]
fn remove_file(path: String) -> Result<(), String> {
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Could not remove {path}: {error}")),
    }
}

#[tauri::command]
fn sample_project_dir(app: tauri::AppHandle) -> Result<String, String> {
    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../sample-project");
    if dev.join("project.json").is_file() {
        let absolute = fs::canonicalize(&dev).unwrap_or(dev);
        return Ok(absolute.to_string_lossy().into_owned());
    }
    match app.path().resolve("sample-project", tauri::path::BaseDirectory::Resource) {
        Ok(path) if path.join("project.json").is_file() => Ok(path.to_string_lossy().into_owned()),
        Ok(_) => Err("The sample project is missing project.json.".into()),
        Err(error) => Err(format!("The sample project was not found ({error}).")),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            list_dir,
            create_dir,
            path_exists,
            remove_file,
            sample_project_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running StoryPlanner");
}

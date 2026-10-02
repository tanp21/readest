//! Windows-only client for WordHarvest's authenticated loopback bridge.
use serde_json::Value;
use std::{fs, time::Duration};
use tauri::Manager;

const FIRST_PORT: u16 = 44_040;
const PORT_ATTEMPTS: u16 = 20;
const TOKEN_HEADER: &str = "X-WordHarvest-Readest-Token";

fn token_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let directory = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    Ok(directory.join("wordharvest-readest-token.txt"))
}

fn read_token(app: &tauri::AppHandle) -> Result<String, String> {
    fs::read_to_string(token_path(app)?)
        .map(|value| value.trim().to_owned())
        .map_err(|_| "Pair Readest in WordHarvest settings first.".to_owned())
}

#[tauri::command]
pub fn wordharvest_set_token(app: tauri::AppHandle, token: String) -> Result<(), String> {
    let token = token.trim();
    if token.len() != 48 || !token.bytes().all(|byte| byte.is_ascii_alphanumeric()) {
        return Err("Paste the complete WordHarvest Readest pair token.".into());
    }
    fs::write(token_path(&app)?, token).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn wordharvest_request(
    app: tauri::AppHandle,
    operation: String,
    body: Value,
) -> Result<Value, String> {
    let route = match operation.as_str() {
        "ping" => "/readest/v1/ping",
        "lookup" => "/readest/v1/lookup",
        "translate" => "/readest/v1/translate",
        "learn" => "/readest/v1/lookups/learn",
        "scan_start" => "/readest/v1/scans/start",
        "scan_status" => "/readest/v1/scans/status",
        "scan_cancel" => "/readest/v1/scans/cancel",
        "candidate_feedback" => "/readest/v1/candidates/feedback",
        _ => return Err("Unknown WordHarvest operation.".into()),
    };
    let token = read_token(&app)?;
    let client = reqwest::Client::builder()
        .no_proxy()
        .connect_timeout(Duration::from_millis(500))
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|e| e.to_string())?;
    for offset in 0..PORT_ATTEMPTS {
        let base = format!("http://127.0.0.1:{}", FIRST_PORT + offset);
        let ping = client
            .post(format!("{base}/readest/v1/ping"))
            .header(TOKEN_HEADER, &token)
            .json(&serde_json::json!({}))
            .send()
            .await;
        let Ok(ping) = ping else { continue };
        if !ping.status().is_success() {
            continue;
        }
        let Ok(identity) = ping.json::<Value>().await else {
            continue;
        };
        if identity.get("protocolVersion").and_then(Value::as_u64) != Some(1) {
            continue;
        }
        if operation == "ping" {
            return Ok(identity);
        }
        let response = client
            .post(format!("{base}{route}"))
            .header(TOKEN_HEADER, &token)
            .json(&body)
            .send()
            .await;
        let Ok(response) = response else { continue };
        let status = response.status();
        let value: Value = response
            .json()
            .await
            .map_err(|_| "WordHarvest returned an invalid response.")?;
        if !status.is_success() {
            return Err(value
                .get("error")
                .and_then(Value::as_str)
                .unwrap_or("WordHarvest request failed.")
                .to_owned());
        }
        return Ok(value);
    }
    Err("WordHarvest is not running or its Readest bridge is unavailable.".into())
}

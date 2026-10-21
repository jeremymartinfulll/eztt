use std::sync::Mutex;
use std::time::Duration;

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tokio::sync::oneshot;
use tokio::time::{sleep, timeout};

const WINDOW_LABEL: &str = "quarksup";
const APP_URL: &str = "https://entreprise.quarksup.net";
const BRIDGE_SCRIPT: &str = include_str!("quarksup_bridge.js");
const EVALUATION_TIMEOUT: Duration = Duration::from_secs(5);
const RESPONSE_TIMEOUT: Duration = Duration::from_secs(30);
const POLL_INTERVAL: Duration = Duration::from_millis(250);

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    employee_id: Option<u64>,
    expires_at: Option<i64>,
    claim_names: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct ApiRequest {
    path: String,
    method: String,
    body: Option<String>,
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct ApiResponse {
    status: u16,
    body: String,
}

pub fn open_window(app: &AppHandle) -> Result<(), String> {
    let window = match app.get_webview_window(WINDOW_LABEL) {
        Some(window) => window,
        None => {
            let url = APP_URL.parse().map_err(|error| format!("{error}"))?;
            WebviewWindowBuilder::new(app, WINDOW_LABEL, WebviewUrl::External(url))
                .title("quarksUp")
                .inner_size(1100.0, 800.0)
                .initialization_script(BRIDGE_SCRIPT)
                .build()
                .map_err(|error| error.to_string())?
        }
    };
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

pub async fn session(app: &AppHandle) -> Result<Option<Session>, String> {
    match app.get_webview_window(WINDOW_LABEL) {
        Some(window) => evaluate(&window, "window.__eztt?.session()").await,
        None => Ok(None),
    }
}

pub async fn fetch(app: &AppHandle, request: &ApiRequest) -> Result<ApiResponse, String> {
    let window = app
        .get_webview_window(WINDOW_LABEL)
        .ok_or("Fenêtre quarksUp non ouverte")?;
    let request_json = serde_json::to_string(request).map_err(|error| error.to_string())?;
    let request_id: u64 = evaluate(&window, &format!("window.__eztt?.send({request_json})"))
        .await?
        .ok_or("Aucune session quarksUp : connecte-toi dans la fenêtre quarksUp")?;

    let take_expression = format!("window.__eztt?.take({request_id})");
    let poll = async {
        loop {
            if let Some(response) = evaluate::<ApiResponse>(&window, &take_expression).await? {
                return Ok::<_, String>(response);
            }
            sleep(POLL_INTERVAL).await;
        }
    };
    timeout(RESPONSE_TIMEOUT, poll)
        .await
        .map_err(|_| "quarksUp n'a pas répondu à temps".to_owned())?
}

async fn evaluate<T: DeserializeOwned>(window: &WebviewWindow, expression: &str) -> Result<Option<T>, String> {
    let (sender, receiver) = oneshot::channel();
    let sender = Mutex::new(Some(sender));
    // Le résultat est renvoyé en chaîne JSON : macOS plante sur une valeur non sérialisable
    // et Windows ignore les exceptions, d'où le try/catch.
    let script = format!("(() => {{ try {{ return JSON.stringify(({expression}) ?? null); }} catch {{ return 'null'; }} }})()");
    window
        .eval_with_callback(script, move |raw| {
            if let Some(sender) = sender.lock().ok().and_then(|mut sender| sender.take()) {
                let _ = sender.send(raw);
            }
        })
        .map_err(|error| error.to_string())?;
    let raw = timeout(EVALUATION_TIMEOUT, receiver)
        .await
        .map_err(|_| "La page quarksUp ne répond pas".to_owned())?
        .map_err(|error| error.to_string())?;
    decode(&raw)
}

fn decode<T: DeserializeOwned>(raw: &str) -> Result<Option<T>, String> {
    if raw.is_empty() {
        return Ok(None);
    }
    let json: String = serde_json::from_str(raw).map_err(|error| error.to_string())?;
    serde_json::from_str(&json).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::{decode, ApiResponse};

    #[test]
    fn decodes_a_json_string_returned_by_the_webview() {
        let raw = r#""{\"status\":200,\"body\":\"ok\"}""#;
        let expected = ApiResponse { status: 200, body: "ok".to_owned() };
        assert_eq!(decode::<ApiResponse>(raw), Ok(Some(expected)));
    }

    #[test]
    fn decodes_null_as_absent() {
        assert_eq!(decode::<ApiResponse>(r#""null""#), Ok(None));
    }

    #[test]
    fn decodes_empty_macos_result_as_absent() {
        assert_eq!(decode::<ApiResponse>(""), Ok(None));
    }
}

use std::sync::Mutex;
use std::time::Duration;

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tokio::sync::oneshot;
use tokio::time::{sleep, timeout};

const WINDOW_LABEL: &str = "quarksup";
const QUARKSUP_DOMAIN_SUFFIX: &str = ".quarksup.net";
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

pub fn open_window(app: &AppHandle, tenant_url: &str) -> Result<(), String> {
    let window = match app.get_webview_window(WINDOW_LABEL) {
        Some(window) => window,
        None => {
            let url = parse_tenant_url(tenant_url)?;
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

fn parse_tenant_url(raw: &str) -> Result<Url, String> {
    let invalid = || format!("L'URL quarksUp doit être de la forme https://<entreprise>{QUARKSUP_DOMAIN_SUFFIX}");
    let url: Url = raw.trim().parse().map_err(|_| invalid())?;
    let is_quarksup_host = url.host_str().is_some_and(|host| host.ends_with(QUARKSUP_DOMAIN_SUFFIX));
    if url.scheme() != "https" || !is_quarksup_host {
        return Err(invalid());
    }
    Ok(url)
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
    use super::{decode, parse_tenant_url, ApiResponse};

    #[test]
    fn accepts_a_quarksup_tenant_url() {
        assert!(parse_tenant_url(" https://entreprise.quarksup.net ").is_ok());
    }

    #[test]
    fn rejects_urls_outside_quarksup_or_without_https() {
        for url in ["http://entreprise.quarksup.net", "https://quarksup.net.evil.com", "https://evilquarksup.net", "entreprise"] {
            assert!(parse_tenant_url(url).is_err(), "{url} devrait être refusée");
        }
    }

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

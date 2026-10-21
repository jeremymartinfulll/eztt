import { invoke } from "@tauri-apps/api/core";

type QuarksupSession = {
  readonly employeeId: number | null;
  readonly expiresAt: number | null;
  readonly claimNames: readonly string[];
};

type ApiResponse = {
  readonly status: number;
  readonly body: string;
};

const SESSION_REFRESH_INTERVAL_MS = 2000;
const WORKFLOWS_PATH = "/times/v3/requests/workflows/me?locale=fr-FR";

const ssidElement = document.querySelector<HTMLElement>("#ssid");
const sessionElement = document.querySelector<HTMLElement>("#session");
const probeResultElement = document.querySelector<HTMLElement>("#probe-result");

async function refreshSsid(): Promise<void> {
  if (!ssidElement) return;
  try {
    const ssid = await invoke<string | null>("current_ssid");
    ssidElement.textContent = ssid ?? "Non connecté";
  } catch (error) {
    ssidElement.textContent = String(error);
  }
}

async function refreshSession(): Promise<void> {
  if (!sessionElement) return;
  try {
    const session = await invoke<QuarksupSession | null>("quarksup_session");
    sessionElement.textContent = session ? describeSession(session) : "Non connecté";
  } catch (error) {
    sessionElement.textContent = String(error);
  }
}

function describeSession({ employeeId, expiresAt, claimNames }: QuarksupSession): string {
  const expiry = expiresAt ? new Date(expiresAt * 1000).toLocaleString("fr-FR") : "inconnue";
  return `employeeId ${employeeId ?? "inconnu"} · expire le ${expiry} · claims : ${claimNames.join(", ")}`;
}

async function probeApi(): Promise<void> {
  if (!probeResultElement) return;
  probeResultElement.textContent = "Appel en cours…";
  try {
    const response = await invoke<ApiResponse>("quarksup_fetch", {
      request: { path: WORKFLOWS_PATH, method: "GET", body: null },
    });
    probeResultElement.textContent = `HTTP ${response.status}\n${response.body}`;
  } catch (error) {
    probeResultElement.textContent = String(error);
  }
}

document.querySelector("#refresh")?.addEventListener("click", refreshSsid);
document.querySelector("#login")?.addEventListener("click", () => invoke("open_quarksup_window"));
document.querySelector("#probe")?.addEventListener("click", probeApi);
window.addEventListener("focus", refreshSsid);
setInterval(refreshSession, SESSION_REFRESH_INTERVAL_MS);
refreshSsid();
refreshSession();

import { invoke } from "@tauri-apps/api/core";

const ssidElement = document.querySelector<HTMLElement>("#ssid");
const refreshButton = document.querySelector<HTMLButtonElement>("#refresh");

async function refreshSsid(): Promise<void> {
  if (!ssidElement) return;
  try {
    const ssid = await invoke<string | null>("current_ssid");
    ssidElement.textContent = ssid ?? "Non connecté";
  } catch (error) {
    ssidElement.textContent = String(error);
  }
}

refreshButton?.addEventListener("click", refreshSsid);
window.addEventListener("focus", refreshSsid);
refreshSsid();

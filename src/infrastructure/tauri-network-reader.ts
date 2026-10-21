import { invoke } from "@tauri-apps/api/core";
import type { NetworkReader } from "../application/ports.ts";
import type { NetworkStatus } from "../domain/network-status.ts";

export class TauriNetworkReader implements NetworkReader {
  async current(): Promise<NetworkStatus> {
    try {
      const ssid = await invoke<string | null>("current_ssid");
      return ssid ? { kind: "wifi", ssid } : { kind: "unidentified", reason: "aucun Wi-Fi connecté" };
    } catch (error) {
      return { kind: "unidentified", reason: String(error) };
    }
  }
}

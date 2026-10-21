import { invoke } from "@tauri-apps/api/core";

export type QuarksupApiRequest = {
  readonly path: string;
  readonly method: "GET" | "POST";
  readonly body: string | null;
};

export type QuarksupApiResponse = {
  readonly status: number;
  readonly body: string;
};

export interface QuarksupApi {
  employeeId(): Promise<number>;
  send(request: QuarksupApiRequest): Promise<QuarksupApiResponse>;
}

export class QuarksupError extends Error {}

type QuarksupSession = {
  readonly employeeId: number | null;
};

export class TauriQuarksupApi implements QuarksupApi {
  async employeeId(): Promise<number> {
    const session = await invoke<QuarksupSession | null>("quarksup_session");
    if (!session) throw new QuarksupError("Aucune session quarksUp : connecte-toi depuis EZTT");
    if (session.employeeId === null) throw new QuarksupError("employeeId quarksUp inconnu");
    return session.employeeId;
  }

  async send(request: QuarksupApiRequest): Promise<QuarksupApiResponse> {
    return invoke<QuarksupApiResponse>("quarksup_fetch", { request });
  }
}

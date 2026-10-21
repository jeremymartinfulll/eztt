import type { RemoteWorkRequests } from "../../application/ports.ts";
import type { CalendarDay } from "../../domain/calendar-day.ts";
import { QuarksupError, type QuarksupApi, type QuarksupApiRequest } from "./quarksup-api.ts";

const REMOTE_WORK_NATURE_ID = 75;
const WORKFLOWS_PATH = "/times/v3/requests/workflows/me?locale=fr-FR";
const ERROR_EXCERPT_LENGTH = 300;

type QuarksupRequest = {
  readonly beginDate: string;
  readonly endDate: string;
};

export class QuarksupRemoteWorkRequests implements RemoteWorkRequests {
  constructor(private readonly api: QuarksupApi) {}

  async existsOn(day: CalendarDay): Promise<boolean> {
    const isoDate = day.toIsoDate();
    const employeeId = await this.api.employeeId();
    const body = await this.call({
      path: `/times/v3/odata/requests?$top=50&skip=0&$count=true&locale=fr-FR&beginDate=${isoDate}&endDate=${isoDate}&employeeId=${employeeId}`,
      method: "GET",
      body: null,
    });
    return parseRequests(body).some((request) => covers(request, isoDate));
  }

  async declare(day: CalendarDay): Promise<void> {
    const isoDate = day.toIsoDate();
    const employeeId = await this.api.employeeId();
    const sequenceId = parseTakeLeaveSequenceId(await this.call({ path: WORKFLOWS_PATH, method: "GET", body: null }));
    await this.call({
      path: `/times/v3/requests?workflowSequenceId=${sequenceId}&locale=fr-FR`,
      method: "POST",
      body: JSON.stringify({
        duration: 1,
        beginDate: `${isoDate}T00:00:00Z`,
        endDate: `${isoDate}T23:00:00Z`,
        employeeId,
        segments: [
          {
            entitlementId: null,
            duration: 1,
            natureId: REMOTE_WORK_NATURE_ID,
            id: null,
            beginDate: null,
            endDate: null,
            document: null,
          },
        ],
        comment: null,
      }),
    });
  }

  private async call(request: QuarksupApiRequest): Promise<string> {
    const response = await this.api.send(request);
    if (response.status < 200 || response.status >= 300) {
      const endpoint = request.path.split("?")[0];
      throw new QuarksupError(`${endpoint} → HTTP ${response.status} ${response.body.slice(0, ERROR_EXCERPT_LENGTH)}`.trim());
    }
    return response.body;
  }
}

function covers(request: QuarksupRequest, isoDate: string): boolean {
  return request.beginDate.slice(0, 10) <= isoDate && isoDate <= request.endDate.slice(0, 10);
}

function parseRequests(body: string): readonly QuarksupRequest[] {
  const json: unknown = JSON.parse(body);
  if (!isRecord(json) || !Array.isArray(json.value)) throw new QuarksupError("Liste des demandes quarksUp illisible");
  return json.value.filter(isQuarksupRequest);
}

function parseTakeLeaveSequenceId(body: string): number {
  const json: unknown = JSON.parse(body);
  const sequenceId = isRecord(json) && isRecord(json.TakeLeave) ? json.TakeLeave.sequenceId : undefined;
  if (typeof sequenceId !== "number") throw new QuarksupError("Workflow de demande d'absence quarksUp introuvable");
  return sequenceId;
}

function isQuarksupRequest(value: unknown): value is QuarksupRequest {
  return isRecord(value) && typeof value.beginDate === "string" && typeof value.endDate === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

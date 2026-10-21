import { describe, expect, it } from "vitest";
import { CalendarDay } from "../../src/domain/calendar-day.ts";
import type { QuarksupApi, QuarksupApiRequest, QuarksupApiResponse } from "../../src/infrastructure/quarksup/quarksup-api.ts";
import { QuarksupError } from "../../src/infrastructure/quarksup/quarksup-api.ts";
import { QuarksupRemoteWorkRequests } from "../../src/infrastructure/quarksup/quarksup-remote-work-requests.ts";

class ScriptedQuarksupApi implements QuarksupApi {
  private readonly received: QuarksupApiRequest[] = [];

  constructor(private readonly responses: readonly QuarksupApiResponse[]) {}

  get requests(): readonly QuarksupApiRequest[] {
    return this.received;
  }

  async employeeId(): Promise<number> {
    return 42;
  }

  async send(request: QuarksupApiRequest): Promise<QuarksupApiResponse> {
    const response = this.responses[this.received.length];
    this.received.push(request);
    if (!response) throw new Error(`Réponse inattendue pour ${request.path}`);
    return response;
  }
}

const ok = (body: unknown): QuarksupApiResponse => ({ status: 200, body: JSON.stringify(body) });
const requestsList = (...periods: readonly (readonly [string, string])[]) =>
  ok({
    "@odata.count": periods.length,
    value: periods.map(([beginDate, endDate], index) => ({
      id: index,
      statusId: 2,
      beginDate,
      endDate,
      segments: [{ beginDate, endDate, duration: 1, natureId: 75 }],
    })),
  });

const day = CalendarDay.parse("2026-10-22");

describe("QuarksupRemoteWorkRequests.existsOn", () => {
  it("finds a request starting on the day", async () => {
    const api = new ScriptedQuarksupApi([requestsList(["2026-10-22T00:00:00+02:00", "2026-10-22T23:00:00+02:00"])]);
    expect(await new QuarksupRemoteWorkRequests(api).existsOn(day)).toBe(true);
  });

  it("finds a multi-day request covering the day", async () => {
    const api = new ScriptedQuarksupApi([requestsList(["2026-10-21T00:00:00+02:00", "2026-10-23T23:00:00+02:00"])]);
    expect(await new QuarksupRemoteWorkRequests(api).existsOn(day)).toBe(true);
  });

  it("ignores requests on other days", async () => {
    const api = new ScriptedQuarksupApi([requestsList(["2026-10-26T00:00:00+01:00", "2026-10-26T23:00:00+01:00"])]);
    expect(await new QuarksupRemoteWorkRequests(api).existsOn(day)).toBe(false);
  });

  it("queries the employee requests of the day", async () => {
    const api = new ScriptedQuarksupApi([requestsList()]);
    await new QuarksupRemoteWorkRequests(api).existsOn(day);
    expect(api.requests[0].path).toContain("beginDate=2026-10-22&endDate=2026-10-22&employeeId=42");
  });

  it("fails on an HTTP error", async () => {
    const api = new ScriptedQuarksupApi([{ status: 403, body: "Forbidden" }]);
    await expect(new QuarksupRemoteWorkRequests(api).existsOn(day)).rejects.toThrow(
      new QuarksupError("/times/v3/odata/requests → HTTP 403 Forbidden"),
    );
  });
});

describe("QuarksupRemoteWorkRequests.declare", () => {
  it("posts a full remote work day on the leave workflow", async () => {
    const api = new ScriptedQuarksupApi([ok({ TakeLeave: { sequenceId: 11281 } }), ok({ id: 1 })]);

    await new QuarksupRemoteWorkRequests(api).declare(day);

    const post = api.requests[1];
    expect(post.method).toBe("POST");
    expect(post.path).toBe("/times/v3/requests?workflowSequenceId=11281&locale=fr-FR");
    expect(JSON.parse(post.body ?? "")).toMatchObject({
      duration: 1,
      beginDate: "2026-10-22T00:00:00Z",
      endDate: "2026-10-22T23:00:00Z",
      employeeId: 42,
      segments: [{ duration: 1, natureId: 75 }],
    });
  });

  it("fails when the leave workflow is missing", async () => {
    const api = new ScriptedQuarksupApi([ok({})]);
    await expect(new QuarksupRemoteWorkRequests(api).declare(day)).rejects.toThrow(QuarksupError);
  });
});

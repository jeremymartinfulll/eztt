import { describe, expect, it } from "vitest";
import { RunDailyCheck } from "../../src/application/run-daily-check.ts";
import { CalendarDay } from "../../src/domain/calendar-day.ts";
import { CheckTime } from "../../src/domain/check-time.ts";
import { DailyCheckPolicy } from "../../src/domain/daily-check-policy.ts";
import type { NetworkStatus } from "../../src/domain/network-status.ts";
import { OfficeNetwork } from "../../src/domain/office-network.ts";
import { WorkingDays } from "../../src/domain/working-days.ts";
import {
  FixedClock,
  InMemoryCheckJournal,
  InMemoryRemoteWorkRequests,
  RecordingNotifier,
  StaticDailyCheckSettings,
  StubNetworkReader,
} from "./fakes.ts";

const today = CalendarDay.parse("2026-10-21");
const yesterday = CalendarDay.parse("2026-10-20");
const homeWifi: NetworkStatus = { kind: "wifi", ssid: "Livebox-1234" };

function setup({
  network = homeWifi,
  now = new Date(2026, 9, 21, 10, 0),
  lastCheckedDay = yesterday as CalendarDay | null,
  requests = new InMemoryRemoteWorkRequests(),
} = {}) {
  const policy = DailyCheckPolicy.create({
    officeNetwork: OfficeNetwork.create("BureauWifi"),
    checkTime: CheckTime.parse("10:00"),
    workingDays: WorkingDays.mondayToFriday(),
  });
  const journal = new InMemoryCheckJournal(lastCheckedDay);
  const notifier = new RecordingNotifier();
  const useCase = new RunDailyCheck(
    new StaticDailyCheckSettings(policy),
    new FixedClock(now),
    journal,
    new StubNetworkReader(network),
    requests,
    notifier,
  );
  return { useCase, journal, notifier, requests };
}

describe("RunDailyCheck", () => {
  it("declares remote work and notifies when away from the office", async () => {
    const { useCase, requests, notifier, journal } = setup();

    expect(await useCase.execute()).toEqual({ kind: "remote-work-declared", day: today });
    expect(requests.declaredDays).toEqual([today]);
    expect(notifier.notifications).toEqual([
      { title: "Télétravail déclaré", body: "Demande de télétravail envoyée pour le 21/10/2026." },
    ]);
    expect(await journal.lastCheckedDay()).toEqual(today);
  });

  it("does nothing silently at the office", async () => {
    const { useCase, requests, notifier } = setup({ network: { kind: "wifi", ssid: "BureauWifi" } });

    expect(await useCase.execute()).toEqual({ kind: "at-office", day: today });
    expect(requests.declaredDays).toEqual([]);
    expect(notifier.notifications).toEqual([]);
  });

  it("does not declare but notifies on an unidentified network", async () => {
    const { useCase, requests, notifier } = setup({ network: { kind: "unidentified", reason: "aucun Wi-Fi connecté" } });

    expect(await useCase.execute()).toEqual({ kind: "unidentified-network", day: today, reason: "aucun Wi-Fi connecté" });
    expect(requests.declaredDays).toEqual([]);
    expect(notifier.notifications.map((notification) => notification.title)).toEqual(["Aucune demande de télétravail"]);
  });

  it("does not declare twice the same day", async () => {
    const { useCase, requests, notifier } = setup({ requests: new InMemoryRemoteWorkRequests([today]) });

    expect(await useCase.execute()).toEqual({ kind: "already-declared", day: today });
    expect(requests.declaredDays).toEqual([today]);
    expect(notifier.notifications).toEqual([]);
  });

  it("reports a failure and does not retry it the same day", async () => {
    const { useCase, notifier, journal } = setup({
      requests: new InMemoryRemoteWorkRequests([], new Error("HTTP 403")),
    });

    expect(await useCase.execute()).toEqual({ kind: "failed", day: today, reason: "HTTP 403" });
    expect(notifier.notifications.map((notification) => notification.title)).toEqual(["Échec de la déclaration de télétravail"]);
    expect(await journal.lastCheckedDay()).toEqual(today);
  });

  it("skips when already checked today", async () => {
    const { useCase, requests } = setup({ lastCheckedDay: today });

    expect(await useCase.execute()).toEqual({ kind: "not-due" });
    expect(requests.declaredDays).toEqual([]);
  });
});

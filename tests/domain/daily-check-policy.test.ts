import { describe, expect, it } from "vitest";
import { CalendarDay } from "../../src/domain/calendar-day.ts";
import { CheckTime } from "../../src/domain/check-time.ts";
import { DailyCheckPolicy } from "../../src/domain/daily-check-policy.ts";
import { OfficeNetwork } from "../../src/domain/office-network.ts";
import { WorkingDays } from "../../src/domain/working-days.ts";

const policy = DailyCheckPolicy.create({
  officeNetwork: OfficeNetwork.create("BureauWifi"),
  checkTime: CheckTime.parse("10:00"),
  workingDays: WorkingDays.mondayToFriday(),
});

const wednesdayAt = (hours: number, minutes = 0) => new Date(2026, 9, 21, hours, minutes);
const saturdayAt10 = new Date(2026, 9, 24, 10, 0);

describe("DailyCheckPolicy.isDueAt", () => {
  it("is not due before the check time", () => {
    expect(policy.isDueAt(wednesdayAt(9, 59), null)).toBe(false);
  });

  it("is due once the check time is reached on a working day", () => {
    expect(policy.isDueAt(wednesdayAt(10, 0), null)).toBe(true);
  });

  it("catches up later in the day when the computer was asleep at the check time", () => {
    expect(policy.isDueAt(wednesdayAt(15, 30), CalendarDay.parse("2026-10-20"))).toBe(true);
  });

  it("is not due twice the same day", () => {
    expect(policy.isDueAt(wednesdayAt(11), CalendarDay.parse("2026-10-21"))).toBe(false);
  });

  it("is not due on a non working day", () => {
    expect(policy.isDueAt(saturdayAt10, null)).toBe(false);
  });
});

describe("DailyCheckPolicy.locate", () => {
  it("locates at the office on the office wifi", () => {
    expect(policy.locate({ kind: "wifi", ssid: "BureauWifi" })).toEqual({ kind: "office" });
  });

  it("locates remote on any other wifi", () => {
    expect(policy.locate({ kind: "wifi", ssid: "Livebox-1234" })).toEqual({ kind: "remote" });
  });

  it("treats wifi names as case sensitive", () => {
    expect(policy.locate({ kind: "wifi", ssid: "bureauwifi" })).toEqual({ kind: "remote" });
  });

  it("cannot locate on an unidentified network", () => {
    expect(policy.locate({ kind: "unidentified", reason: "Ethernet" })).toEqual({ kind: "unknown", reason: "Ethernet" });
  });
});

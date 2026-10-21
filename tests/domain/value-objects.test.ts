import { describe, expect, it } from "vitest";
import { CalendarDay } from "../../src/domain/calendar-day.ts";
import { CheckTime } from "../../src/domain/check-time.ts";
import { InvalidCalendarDayError, InvalidCheckTimeError, InvalidOfficeNetworkError, NoWorkingDayError } from "../../src/domain/errors.ts";
import { OfficeNetwork } from "../../src/domain/office-network.ts";
import { WorkingDays } from "../../src/domain/working-days.ts";

describe("CalendarDay", () => {
  it("round-trips an ISO date", () => {
    expect(CalendarDay.parse("2026-10-21").toIsoDate()).toBe("2026-10-21");
  });

  it("knows its weekday", () => {
    expect(CalendarDay.parse("2026-10-21").weekday).toBe(3);
  });

  it.each(["2026-02-30", "21/10/2026", ""])("rejects %j", (value) => {
    expect(() => CalendarDay.parse(value)).toThrow(InvalidCalendarDayError);
  });
});

describe("CheckTime", () => {
  it("parses HH:MM", () => {
    expect(CheckTime.parse("09:30").toString()).toBe("09:30");
  });

  it.each(["24:00", "9:30", "10h00"])("rejects %j", (value) => {
    expect(() => CheckTime.parse(value)).toThrow(InvalidCheckTimeError);
  });
});

describe("WorkingDays", () => {
  it("requires at least one day", () => {
    expect(() => WorkingDays.create([])).toThrow(NoWorkingDayError);
  });
});

describe("OfficeNetwork", () => {
  it("ignores surrounding spaces", () => {
    expect(OfficeNetwork.create("  BureauWifi ").matches("BureauWifi")).toBe(true);
  });

  it("requires a name", () => {
    expect(() => OfficeNetwork.create("   ")).toThrow(InvalidOfficeNetworkError);
  });
});

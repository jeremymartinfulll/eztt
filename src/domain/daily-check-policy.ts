import { CalendarDay } from "./calendar-day.ts";
import type { CheckTime } from "./check-time.ts";
import type { NetworkStatus, WorkLocation } from "./network-status.ts";
import type { OfficeNetwork } from "./office-network.ts";
import type { WorkingDays } from "./working-days.ts";

export class DailyCheckPolicy {
  private constructor(
    readonly officeNetwork: OfficeNetwork,
    readonly checkTime: CheckTime,
    readonly workingDays: WorkingDays,
  ) {}

  static create(props: {
    readonly officeNetwork: OfficeNetwork;
    readonly checkTime: CheckTime;
    readonly workingDays: WorkingDays;
  }): DailyCheckPolicy {
    return new DailyCheckPolicy(props.officeNetwork, props.checkTime, props.workingDays);
  }

  isDueAt(now: Date, lastCheckedDay: CalendarDay | null): boolean {
    const today = CalendarDay.fromLocalDate(now);
    const alreadyCheckedToday = lastCheckedDay?.equals(today) ?? false;
    return this.workingDays.includes(today) && this.checkTime.isReachedAt(now) && !alreadyCheckedToday;
  }

  locate(network: NetworkStatus): WorkLocation {
    if (network.kind === "unidentified") return { kind: "unknown", reason: network.reason };
    return this.officeNetwork.matches(network.ssid) ? { kind: "office" } : { kind: "remote" };
  }
}

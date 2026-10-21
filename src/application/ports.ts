import type { CalendarDay } from "../domain/calendar-day.ts";
import type { DailyCheckPolicy } from "../domain/daily-check-policy.ts";
import type { NetworkStatus } from "../domain/network-status.ts";

export interface Clock {
  now(): Date;
}

export interface DailyCheckSettings {
  load(): Promise<DailyCheckPolicy>;
}

export interface CheckJournal {
  lastCheckedDay(): Promise<CalendarDay | null>;
  markChecked(day: CalendarDay): Promise<void>;
}

export interface NetworkReader {
  current(): Promise<NetworkStatus>;
}

export interface RemoteWorkRequests {
  existsOn(day: CalendarDay): Promise<boolean>;
  declare(day: CalendarDay): Promise<void>;
}

export type Notification = {
  readonly title: string;
  readonly body: string;
};

export interface Notifier {
  notify(notification: Notification): Promise<void>;
}

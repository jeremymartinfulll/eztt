import type {
  CheckJournal,
  Clock,
  DailyCheckSettings,
  NetworkReader,
  Notification,
  Notifier,
  RemoteWorkRequests,
} from "../../src/application/ports.ts";
import type { CalendarDay } from "../../src/domain/calendar-day.ts";
import type { DailyCheckPolicy } from "../../src/domain/daily-check-policy.ts";
import type { NetworkStatus } from "../../src/domain/network-status.ts";

export class FixedClock implements Clock {
  constructor(private readonly date: Date) {}

  now(): Date {
    return this.date;
  }
}

export class StaticDailyCheckSettings implements DailyCheckSettings {
  constructor(private readonly policy: DailyCheckPolicy) {}

  async load(): Promise<DailyCheckPolicy> {
    return this.policy;
  }
}

export class InMemoryCheckJournal implements CheckJournal {
  constructor(private lastDay: CalendarDay | null = null) {}

  async lastCheckedDay(): Promise<CalendarDay | null> {
    return this.lastDay;
  }

  async markChecked(day: CalendarDay): Promise<void> {
    this.lastDay = day;
  }
}

export class StubNetworkReader implements NetworkReader {
  constructor(private readonly status: NetworkStatus) {}

  async current(): Promise<NetworkStatus> {
    return this.status;
  }
}

export class InMemoryRemoteWorkRequests implements RemoteWorkRequests {
  private readonly days: CalendarDay[];

  constructor(
    existingDays: readonly CalendarDay[] = [],
    private readonly failure: Error | null = null,
  ) {
    this.days = [...existingDays];
  }

  get declaredDays(): readonly CalendarDay[] {
    return this.days;
  }

  async existsOn(day: CalendarDay): Promise<boolean> {
    if (this.failure) throw this.failure;
    return this.days.some((declared) => declared.equals(day));
  }

  async declare(day: CalendarDay): Promise<void> {
    if (this.failure) throw this.failure;
    this.days.push(day);
  }
}

export class RecordingNotifier implements Notifier {
  private readonly sent: Notification[] = [];

  get notifications(): readonly Notification[] {
    return this.sent;
  }

  async notify(notification: Notification): Promise<void> {
    this.sent.push(notification);
  }
}

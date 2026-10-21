import { CalendarDay } from "../domain/calendar-day.ts";
import type { WorkLocation } from "../domain/network-status.ts";
import { notificationFor, type DailyCheckOutcome } from "./daily-check-outcome.ts";
import type { CheckJournal, Clock, DailyCheckSettings, NetworkReader, Notifier, RemoteWorkRequests } from "./ports.ts";

export class RunDailyCheck {
  constructor(
    private readonly settings: DailyCheckSettings,
    private readonly clock: Clock,
    private readonly journal: CheckJournal,
    private readonly network: NetworkReader,
    private readonly requests: RemoteWorkRequests,
    private readonly notifier: Notifier,
  ) {}

  async execute(): Promise<DailyCheckOutcome> {
    const now = this.clock.now();
    const policy = await this.settings.load();
    if (!policy.isDueAt(now, await this.journal.lastCheckedDay())) return { kind: "not-due" };

    const today = CalendarDay.fromLocalDate(now);
    const location = policy.locate(await this.network.current());
    const outcome = await this.checkOn(today, location);
    await this.journal.markChecked(today);

    const notification = notificationFor(outcome);
    if (notification) await this.notifier.notify(notification);
    return outcome;
  }

  private async checkOn(day: CalendarDay, location: WorkLocation): Promise<DailyCheckOutcome> {
    switch (location.kind) {
      case "office":
        return { kind: "at-office", day };
      case "unknown":
        return { kind: "unidentified-network", day, reason: location.reason };
      case "remote":
        return this.declareRemoteWork(day);
    }
  }

  private async declareRemoteWork(day: CalendarDay): Promise<DailyCheckOutcome> {
    try {
      if (await this.requests.existsOn(day)) return { kind: "already-declared", day };
      await this.requests.declare(day);
      return { kind: "remote-work-declared", day };
    } catch (error) {
      return { kind: "failed", day, reason: error instanceof Error ? error.message : String(error) };
    }
  }
}

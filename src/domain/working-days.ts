import type { CalendarDay, Weekday } from "./calendar-day.ts";
import { NoWorkingDayError } from "./errors.ts";

export class WorkingDays {
  private constructor(private readonly weekdays: ReadonlySet<Weekday>) {}

  static create(weekdays: readonly Weekday[]): WorkingDays {
    if (weekdays.length === 0) throw new NoWorkingDayError();
    return new WorkingDays(new Set(weekdays));
  }

  static mondayToFriday(): WorkingDays {
    return WorkingDays.create([1, 2, 3, 4, 5]);
  }

  includes(day: CalendarDay): boolean {
    return this.weekdays.has(day.weekday);
  }
}

import { InvalidCalendarDayError } from "./errors.ts";

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export class CalendarDay {
  private constructor(
    readonly year: number,
    readonly month: number,
    readonly day: number,
    readonly weekday: Weekday,
  ) {}

  static fromLocalDate(date: Date): CalendarDay {
    return new CalendarDay(date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getDay() as Weekday);
  }

  static parse(isoDate: string): CalendarDay {
    const match = ISO_DATE.exec(isoDate);
    if (!match) throw new InvalidCalendarDayError(isoDate);
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const date = new Date(year, month - 1, day);
    if (date.getMonth() !== month - 1 || date.getDate() !== day) throw new InvalidCalendarDayError(isoDate);
    return CalendarDay.fromLocalDate(date);
  }

  equals(other: CalendarDay): boolean {
    return this.year === other.year && this.month === other.month && this.day === other.day;
  }

  toIsoDate(): string {
    return `${this.year}-${pad(this.month)}-${pad(this.day)}`;
  }
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

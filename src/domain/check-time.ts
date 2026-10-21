import { InvalidCheckTimeError } from "./errors.ts";

const HOURS_MINUTES = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CheckTime {
  private constructor(
    readonly hours: number,
    readonly minutes: number,
  ) {}

  static parse(value: string): CheckTime {
    const match = HOURS_MINUTES.exec(value);
    if (!match) throw new InvalidCheckTimeError(value);
    return new CheckTime(Number(match[1]), Number(match[2]));
  }

  isReachedAt(date: Date): boolean {
    return date.getHours() * 60 + date.getMinutes() >= this.hours * 60 + this.minutes;
  }

  toString(): string {
    return `${String(this.hours).padStart(2, "0")}:${String(this.minutes).padStart(2, "0")}`;
  }
}

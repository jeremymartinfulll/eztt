import { InvalidOfficeNetworkError } from "./errors.ts";

export class OfficeNetwork {
  private constructor(readonly ssid: string) {}

  static create(ssid: string): OfficeNetwork {
    const trimmed = ssid.trim();
    if (!trimmed) throw new InvalidOfficeNetworkError();
    return new OfficeNetwork(trimmed);
  }

  matches(ssid: string): boolean {
    return this.ssid === ssid.trim();
  }
}

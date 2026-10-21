export class InvalidCalendarDayError extends Error {
  constructor(readonly value: string) {
    super(`Date invalide : « ${value} » (format attendu AAAA-MM-JJ)`);
  }
}

export class InvalidCheckTimeError extends Error {
  constructor(readonly value: string) {
    super(`Heure invalide : « ${value} » (format attendu HH:MM)`);
  }
}

export class NoWorkingDayError extends Error {
  constructor() {
    super("Au moins un jour travaillé est requis");
  }
}

export class InvalidOfficeNetworkError extends Error {
  constructor() {
    super("Le nom du Wi-Fi du bureau est requis");
  }
}

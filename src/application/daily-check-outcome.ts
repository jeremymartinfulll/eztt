import type { CalendarDay } from "../domain/calendar-day.ts";
import type { Notification } from "./ports.ts";

export type DailyCheckOutcome =
  | { readonly kind: "not-due" }
  | { readonly kind: "at-office"; readonly day: CalendarDay }
  | { readonly kind: "unidentified-network"; readonly day: CalendarDay; readonly reason: string }
  | { readonly kind: "already-declared"; readonly day: CalendarDay }
  | { readonly kind: "remote-work-declared"; readonly day: CalendarDay }
  | { readonly kind: "failed"; readonly day: CalendarDay; readonly reason: string };

export function notificationFor(outcome: DailyCheckOutcome): Notification | null {
  switch (outcome.kind) {
    case "remote-work-declared":
      return {
        title: "Télétravail déclaré",
        body: `Demande de télétravail envoyée pour le ${frenchDate(outcome.day)}.`,
      };
    case "unidentified-network":
      return {
        title: "Aucune demande de télétravail",
        body: `Réseau non identifié (${outcome.reason}) : déclare ta journée à la main si besoin.`,
      };
    case "failed":
      return {
        title: "Échec de la déclaration de télétravail",
        body: `La demande du ${frenchDate(outcome.day)} n'a pas pu être envoyée : ${outcome.reason}`,
      };
    case "not-due":
    case "at-office":
    case "already-declared":
      return null;
  }
}

function frenchDate(day: CalendarDay): string {
  const [year, month, date] = day.toIsoDate().split("-");
  return `${date}/${month}/${year}`;
}

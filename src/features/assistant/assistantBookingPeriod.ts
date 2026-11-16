import { bookingPeriodFromCard } from "./assistantProtocol";
import { rentalParts } from "./assistantLanguage";
export type RentalPeriod = { startAt?: string | null; endAt?: string | null };
export type AssistantSlotEvidence = { origin?: string; confirmation?: string; precision?: string; updatedAt?: string; sourceMessageId?: string | null; sourceTurnSequence?: number | null };
/** Merge independently so a partial draft never hides known conversation dates. */
export function resolveBookingPeriod(draft: RentalPeriod | undefined, filters: unknown, latest: RentalPeriod = {}, evidence?: Record<string, AssistantSlotEvidence>): RentalPeriod {
  const fromState = bookingPeriodFromCard(filters);
  const saved = bookingPeriodFromCard(draft);
  const result: RentalPeriod = { ...fromState, ...saved };
  const stateAvailable = filters !== undefined && filters !== null;
  for (const key of ["startAt", "endAt"] as const) {
    const proof = evidence?.[key];
    let stateValue = fromState[key];
    if (proof?.precision === "DateOnly" && stateValue) stateValue = rentalParts(stateValue).date;
    // Verified server evidence includes both CustomerForm edits and later chat
    // corrections. Older timeline suggestions must never overrule either one.
    const incoming = !stateAvailable
      ? (!saved[key] ? latest[key] : undefined)
      : proof?.origin && stateValue ? stateValue : latest[key] ?? stateValue;
    if (!incoming) continue;
    const existing = saved[key];
    // A day-only mention on the same day must not erase the customer's chosen clock.
    if (incoming.length === 10 && existing && existing.length > 10 && rentalParts(existing).date === incoming) continue;
    result[key] = incoming;
  }
  return result;
}

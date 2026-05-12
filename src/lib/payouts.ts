import type { Party } from "@/types";

export interface Payouts {
  totalPot: number;
  first: number;
  second: number;
  third: number;
  currency: string;
}

/**
 * Calculate payouts for a party.
 *
 * - 3rd place (if enabled): gets their buy-in back
 * - 2nd place (if enabled): gets buy-in × 2 (their money + one other)
 * - 1st place: gets the remainder of the pot
 */
export function calculatePayouts(party: Party): Payouts {
  const pot = party.buyIn * party.memberUids.length;
  const third = party.thirdPlacePayout ? party.buyIn : 0;
  const second = party.secondPlacePayout ? party.buyIn * 2 : 0;
  const first = pot - second - third;

  return {
    totalPot: pot,
    first: Math.max(first, 0),
    second,
    third,
    currency: party.currency || "EUR",
  };
}

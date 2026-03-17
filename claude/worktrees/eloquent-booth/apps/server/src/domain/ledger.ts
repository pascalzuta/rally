import { randomUUID } from "node:crypto";
import type { LedgerEntry } from "../types/window.js";

interface LedgerRules {
  graceMissesPerMonth: number;
  monthlyChargeCapCents: number;
}

interface ChargeDecisionInput {
  userId: string;
  day: string;
  missesThisMonth: number;
  chargedCentsThisMonth: number;
  rules: LedgerRules;
}

export interface ChargeDecision {
  shouldCharge: boolean;
  entry: LedgerEntry;
}

export function decideLateCharge(input: ChargeDecisionInput): ChargeDecision {
  const overGrace = input.missesThisMonth >= input.rules.graceMissesPerMonth;
  const hasCapRoom = input.chargedCentsThisMonth + 100 <= input.rules.monthlyChargeCapCents;
  const shouldCharge = overGrace && hasCapRoom;

  return {
    shouldCharge,
    entry: {
      id: randomUUID(),
      userId: input.userId,
      day: input.day,
      amountCents: shouldCharge ? 100 : 0,
      reason: shouldCharge ? "late_response" : "waived_grace",
      createdAt: new Date().toISOString(),
      metadata: {
        missesThisMonth: String(input.missesThisMonth),
        chargedCentsThisMonth: String(input.chargedCentsThisMonth)
      }
    }
  };
}

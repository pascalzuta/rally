import { randomUUID } from "node:crypto";
import type {
  AccountabilitySettings,
  ChargeHistoryEntry,
  DueEvaluationResult
} from "../types/accountability.js";

interface EvaluateInput {
  settings: AccountabilitySettings;
  now: Date;
  goalsSetCount: number;
  existingDayEntry: ChargeHistoryEntry | null;
  monthlyChargedCount: number;
  forceChargeFailure?: boolean;
}

function dayPartsInTimezone(date: Date, timezone: string): { day: string; minutes: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { day: `${year}-${month}-${day}`, minutes: hour * 60 + minute };
}

function parseHmToMinutes(value: string): number {
  const [hRaw, mRaw] = value.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error("invalid_hhmm");
  }
  return h * 60 + m;
}

function daysInMonth(isoDay: string): number {
  const [yearRaw, monthRaw] = isoDay.split("-").map((v) => Number(v));
  if (!yearRaw || !monthRaw) return 31;
  return new Date(Date.UTC(yearRaw, monthRaw, 0)).getUTCDate();
}

function buildEntry(
  settings: AccountabilitySettings,
  day: string,
  amountCents: number,
  status: ChargeHistoryEntry["status"],
  reason: ChargeHistoryEntry["reason"],
  nowIso: string,
  extras?: Partial<ChargeHistoryEntry>
): ChargeHistoryEntry {
  return {
    id: randomUUID(),
    userId: settings.userId,
    day,
    amountCents,
    status,
    reason,
    createdAt: nowIso,
    metadata: {
      timezone: settings.timezone,
      reminderTime: settings.reminderTime,
      deadlineTime: settings.deadlineTime,
      requiredGoals: String(settings.requiredGoals)
    },
    ...extras
  };
}

export function defaultAccountabilitySettings(userId: string): AccountabilitySettings {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return {
    userId,
    timezone: tz,
    reminderTime: "08:20",
    deadlineTime: "08:30",
    requiredGoals: 2,
    accountabilityEnabled: false,
    paymentMethodStatus: "none",
    paymentMethodProvider: "stripe",
    paymentMethodType: "apple_pay_only",
    updatedAt: new Date().toISOString()
  };
}

export function normalizeSettingsUpdate(
  base: AccountabilitySettings,
  input: Partial<AccountabilitySettings>
): AccountabilitySettings {
  const requiredGoals = Math.max(2, Math.floor(input.requiredGoals ?? base.requiredGoals));
  return {
    ...base,
    ...input,
    requiredGoals,
    updatedAt: new Date().toISOString()
  };
}

export function evaluateDueCharge(input: EvaluateInput): DueEvaluationResult {
  const nowIso = input.now.toISOString();
  const local = dayPartsInTimezone(input.now, input.settings.timezone);
  const deadlineMinutes = parseHmToMinutes(input.settings.deadlineTime);

  if (local.minutes < deadlineMinutes) {
    return {
      evaluated: false,
      due: false,
      localDay: local.day,
      message: "not_due_yet"
    };
  }

  if (input.existingDayEntry) {
    return {
      evaluated: true,
      due: true,
      localDay: local.day,
      message: "already_evaluated_for_day",
      entry: input.existingDayEntry
    };
  }

  if (!input.settings.accountabilityEnabled) {
    return {
      evaluated: true,
      due: true,
      localDay: local.day,
      message: "accountability_disabled",
      entry: buildEntry(input.settings, local.day, 0, "waived", "accountability_disabled", nowIso)
    };
  }

  if (input.goalsSetCount >= input.settings.requiredGoals) {
    return {
      evaluated: true,
      due: true,
      localDay: local.day,
      message: "goals_met_no_charge",
      entry: buildEntry(input.settings, local.day, 0, "waived", "goals_met", nowIso, {
        metadata: {
          goalsSetCount: String(input.goalsSetCount),
          requiredGoals: String(input.settings.requiredGoals),
          timezone: input.settings.timezone
        }
      })
    };
  }

  const monthlyCap = daysInMonth(local.day);
  if (input.monthlyChargedCount >= monthlyCap) {
    return {
      evaluated: true,
      due: true,
      localDay: local.day,
      message: "monthly_cap_reached",
      entry: buildEntry(input.settings, local.day, 0, "waived", "monthly_cap_reached", nowIso)
    };
  }

  if (input.settings.paymentMethodStatus !== "active") {
    return {
      evaluated: true,
      due: true,
      localDay: local.day,
      message: "payment_not_ready",
      entry: buildEntry(input.settings, local.day, 0, "waived", "payment_not_ready", nowIso)
    };
  }

  if (input.forceChargeFailure) {
    return {
      evaluated: true,
      due: true,
      localDay: local.day,
      message: "charge_failed_accountability_disabled",
      entry: buildEntry(input.settings, local.day, 100, "failed", "payment_failed", nowIso),
      disabledAccountability: true
    };
  }

  return {
    evaluated: true,
    due: true,
    localDay: local.day,
    message: "charged_goal_missed",
    entry: buildEntry(input.settings, local.day, 100, "charged", "goal_missed", nowIso, {
      providerChargeId: `mock_ch_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      receiptUrl: "https://pay.stripe.com/receipts/simulated"
    })
  };
}

export type PaymentMethodStatus = "none" | "pending_setup" | "active";

export interface AccountabilitySettings {
  userId: string;
  timezone: string;
  reminderTime: string; // HH:MM local
  deadlineTime: string; // HH:MM local
  requiredGoals: number; // min 2
  accountabilityEnabled: boolean;
  paymentMethodStatus: PaymentMethodStatus;
  paymentMethodProvider: "stripe";
  paymentMethodType: "apple_pay_only";
  paymentMethodLast4?: string;
  providerCustomerId?: string;
  providerPaymentMethodId?: string;
  updatedAt: string;
}

export interface DailyGoalReport {
  userId: string;
  day: string; // YYYY-MM-DD in local day for user's timezone
  goalsSetCount: number;
  updatedAt: string;
}

export type ChargeStatus = "charged" | "waived" | "failed";

export interface ChargeHistoryEntry {
  id: string;
  userId: string;
  day: string;
  amountCents: number;
  reason:
    | "goals_met"
    | "goal_missed"
    | "accountability_disabled"
    | "payment_not_ready"
    | "daily_cap_reached"
    | "monthly_cap_reached"
    | "payment_failed";
  status: ChargeStatus;
  receiptUrl?: string;
  providerChargeId?: string;
  createdAt: string;
  metadata?: Record<string, string>;
}

export interface DueEvaluationResult {
  evaluated: boolean;
  due: boolean;
  localDay: string;
  message: string;
  entry?: ChargeHistoryEntry;
  disabledAccountability?: boolean;
}

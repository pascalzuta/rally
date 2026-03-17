export type WindowStatus = "open" | "completed" | "expired";

export interface AccountabilityWindow {
  id: string;
  userId: string;
  day: string;
  startedAt: number;
  expiresAt: number;
  completedAt?: number;
  status: WindowStatus;
}

export interface LedgerEntry {
  id: string;
  userId: string;
  day: string;
  amountCents: number;
  reason: "late_response" | "waived_grace";
  createdAt: string;
  metadata?: Record<string, string>;
}

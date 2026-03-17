import type { AuthUser } from "../types/auth.js";
import type { AccountabilitySettings, ChargeHistoryEntry, DailyGoalReport } from "../types/accountability.js";
import type { AccountabilityWindow, LedgerEntry } from "../types/window.js";

export interface UserRepo {
  findByEmail(email: string): Promise<AuthUser | null>;
  findById(id: string): Promise<AuthUser | null>;
  upsert(user: AuthUser): Promise<void>;
}

export interface WindowRepo {
  getOpenWindowForDay(userId: string, day: string): Promise<AccountabilityWindow | null>;
  getById(id: string): Promise<AccountabilityWindow | null>;
  save(window: AccountabilityWindow): Promise<void>;
}

export interface LedgerRepo {
  add(entry: LedgerEntry): Promise<void>;
  listByUser(userId: string): Promise<LedgerEntry[]>;
  monthlySummary(userId: string, yearMonth: string): Promise<{ misses: number; chargedCents: number }>;
}

export interface AccountabilityRepo {
  getByUser(userId: string): Promise<AccountabilitySettings | null>;
  upsert(settings: AccountabilitySettings): Promise<void>;
}

export interface GoalReportRepo {
  upsert(report: DailyGoalReport): Promise<void>;
  getByUserAndDay(userId: string, day: string): Promise<DailyGoalReport | null>;
}

export interface ChargeHistoryRepo {
  add(entry: ChargeHistoryEntry): Promise<void>;
  findByUserDay(userId: string, day: string): Promise<ChargeHistoryEntry | null>;
  listByUser(userId: string): Promise<ChargeHistoryEntry[]>;
  monthlyChargedCount(userId: string, yearMonth: string): Promise<number>;
}

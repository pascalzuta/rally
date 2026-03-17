import type { AuthUser } from "../types/auth.js";
import type { AccountabilitySettings, ChargeHistoryEntry, DailyGoalReport } from "../types/accountability.js";
import type { AccountabilityWindow, LedgerEntry } from "../types/window.js";
import type {
  AccountabilityRepo,
  ChargeHistoryRepo,
  GoalReportRepo,
  LedgerRepo,
  UserRepo,
  WindowRepo
} from "./interfaces.js";

export class InMemoryUserRepo implements UserRepo {
  private readonly byId = new Map<string, AuthUser>();
  private readonly byEmail = new Map<string, string>();

  async findByEmail(email: string): Promise<AuthUser | null> {
    const id = this.byEmail.get(email.toLowerCase());
    return id ? (this.byId.get(id) ?? null) : null;
  }

  async findById(id: string): Promise<AuthUser | null> {
    return this.byId.get(id) ?? null;
  }

  async upsert(user: AuthUser): Promise<void> {
    this.byId.set(user.id, user);
    this.byEmail.set(user.email.toLowerCase(), user.id);
  }
}

export class InMemoryWindowRepo implements WindowRepo {
  private readonly windows = new Map<string, AccountabilityWindow>();

  async getOpenWindowForDay(userId: string, day: string): Promise<AccountabilityWindow | null> {
    for (const value of this.windows.values()) {
      if (value.userId === userId && value.day === day && value.status === "open") {
        return value;
      }
    }
    return null;
  }

  async getById(id: string): Promise<AccountabilityWindow | null> {
    return this.windows.get(id) ?? null;
  }

  async save(window: AccountabilityWindow): Promise<void> {
    this.windows.set(window.id, window);
  }
}

export class InMemoryLedgerRepo implements LedgerRepo {
  private readonly entries: LedgerEntry[] = [];

  async add(entry: LedgerEntry): Promise<void> {
    this.entries.push(entry);
  }

  async listByUser(userId: string): Promise<LedgerEntry[]> {
    return this.entries.filter((entry) => entry.userId === userId).sort((a, b) => b.day.localeCompare(a.day));
  }

  async monthlySummary(userId: string, yearMonth: string): Promise<{ misses: number; chargedCents: number }> {
    const monthly = this.entries.filter((entry) => entry.userId === userId && entry.day.startsWith(yearMonth));
    return {
      misses: monthly.length,
      chargedCents: monthly.reduce((sum, entry) => sum + entry.amountCents, 0)
    };
  }
}

export class InMemoryAccountabilityRepo implements AccountabilityRepo {
  private readonly settingsByUser = new Map<string, AccountabilitySettings>();

  async getByUser(userId: string): Promise<AccountabilitySettings | null> {
    return this.settingsByUser.get(userId) ?? null;
  }

  async upsert(settings: AccountabilitySettings): Promise<void> {
    this.settingsByUser.set(settings.userId, settings);
  }
}

export class InMemoryGoalReportRepo implements GoalReportRepo {
  private readonly reportsByUserDay = new Map<string, DailyGoalReport>();

  async upsert(report: DailyGoalReport): Promise<void> {
    this.reportsByUserDay.set(`${report.userId}:${report.day}`, report);
  }

  async getByUserAndDay(userId: string, day: string): Promise<DailyGoalReport | null> {
    return this.reportsByUserDay.get(`${userId}:${day}`) ?? null;
  }
}

export class InMemoryChargeHistoryRepo implements ChargeHistoryRepo {
  private readonly entries: ChargeHistoryEntry[] = [];

  async add(entry: ChargeHistoryEntry): Promise<void> {
    this.entries.push(entry);
  }

  async findByUserDay(userId: string, day: string): Promise<ChargeHistoryEntry | null> {
    return this.entries.find((entry) => entry.userId === userId && entry.day === day) ?? null;
  }

  async listByUser(userId: string): Promise<ChargeHistoryEntry[]> {
    return this.entries
      .filter((entry) => entry.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async monthlyChargedCount(userId: string, yearMonth: string): Promise<number> {
    return this.entries.filter(
      (entry) => entry.userId === userId && entry.day.startsWith(yearMonth) && entry.status === "charged"
    ).length;
  }
}

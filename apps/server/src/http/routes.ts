import { Router } from "express";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import { issueAccessToken, newUser } from "../auth/tokens.js";
import { authMiddleware } from "../middleware/auth.js";
import {
  defaultAccountabilitySettings,
  evaluateDueCharge,
  normalizeSettingsUpdate
} from "../domain/accountability.js";
import { decideLateCharge } from "../domain/ledger.js";
import {
  completeWindow,
  createWindowToken,
  expireWindow,
  startAccountabilityWindow,
  verifyWindowToken
} from "../domain/window.js";
import type {
  AccountabilityRepo,
  ChargeHistoryRepo,
  GoalReportRepo,
  LedgerRepo,
  UserRepo,
  WindowRepo
} from "../repo/interfaces.js";
import { generateCoachReply } from "../services/coach.js";

interface RouteDeps {
  config: AppConfig;
  users: UserRepo;
  windows: WindowRepo;
  ledger: LedgerRepo;
  accountability: AccountabilityRepo;
  goalReports: GoalReportRepo;
  chargeHistory: ChargeHistoryRepo;
}

const loginSchema = z.object({
  email: z.string().email()
});

const completeSchema = z.object({
  windowToken: z.string().min(20),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

const expireSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

const coachSchema = z.object({
  message: z.string().min(1).max(280),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(320)
      })
    )
    .max(12)
    .default([]),
  context: z
    .object({
      prioritiesToday: z.number().int().nonnegative().optional(),
      missionLocked: z.boolean().optional(),
      secondsLeft: z.number().int().nonnegative().optional(),
      pendingClarifier: z.boolean().optional()
    })
    .optional()
});

const settingsSchema = z.object({
  timezone: z.string().min(2).max(120).optional(),
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  deadlineTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  requiredGoals: z.number().int().min(2).max(50).optional(),
  accountabilityEnabled: z.boolean().optional()
});

const goalsReportSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  goalsSetCount: z.number().int().nonnegative().max(200)
});

const runDueSchema = z.object({
  nowIso: z.string().datetime().optional(),
  forceChargeFailure: z.boolean().optional()
});

function currentDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function yearMonth(day: string): string {
  return day.slice(0, 7);
}

function pseudoLast4(userId: string): string {
  const digits = userId.replace(/\D/g, "").slice(-4);
  return digits.padStart(4, "0");
}

function localDayIso(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

export function createRoutes(deps: RouteDeps): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  router.post("/auth/dev-login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      return;
    }

    const email = parsed.data.email.toLowerCase();
    let user = await deps.users.findByEmail(email);
    if (!user) {
      user = newUser(email);
      await deps.users.upsert(user);
    }

    const accessToken = issueAccessToken(user, deps.config.AUTH_TOKEN_SECRET);
    res.status(200).json({ accessToken, user });
  });

  router.post("/coach/respond", async (req, res) => {
    const parsed = coachSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      return;
    }

    const context = parsed.data.context
      ? {
          ...(parsed.data.context.prioritiesToday !== undefined
            ? { prioritiesToday: parsed.data.context.prioritiesToday }
            : {}),
          ...(parsed.data.context.missionLocked !== undefined
            ? { missionLocked: parsed.data.context.missionLocked }
            : {}),
          ...(parsed.data.context.secondsLeft !== undefined
            ? { secondsLeft: parsed.data.context.secondsLeft }
            : {}),
          ...(parsed.data.context.pendingClarifier !== undefined
            ? { pendingClarifier: parsed.data.context.pendingClarifier }
            : {})
        }
      : undefined;

    const result = await generateCoachReply({
      apiKey: deps.config.OPENAI_API_KEY,
      model: deps.config.OPENAI_MODEL,
      timeoutMs: deps.config.COACH_API_TIMEOUT_MS
    }, {
      message: parsed.data.message,
      history: parsed.data.history,
      ...(context ? { context } : {})
    });

    res.status(200).json(result);
  });

  router.use(authMiddleware(deps.config, deps.users));

  router.get("/accountability/settings", async (req, res) => {
    const existing = await deps.accountability.getByUser(req.user.id);
    const settings = existing ?? defaultAccountabilitySettings(req.user.id);
    if (!existing) {
      await deps.accountability.upsert(settings);
    }
    res.status(200).json({ settings });
  });

  router.put("/accountability/settings", async (req, res) => {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      return;
    }

    const existing = (await deps.accountability.getByUser(req.user.id)) ?? defaultAccountabilitySettings(req.user.id);
    const updateInput = {
      ...(parsed.data.timezone ? { timezone: parsed.data.timezone } : {}),
      ...(parsed.data.reminderTime ? { reminderTime: parsed.data.reminderTime } : {}),
      ...(parsed.data.deadlineTime ? { deadlineTime: parsed.data.deadlineTime } : {}),
      ...(parsed.data.requiredGoals !== undefined ? { requiredGoals: parsed.data.requiredGoals } : {}),
      ...(parsed.data.accountabilityEnabled !== undefined
        ? { accountabilityEnabled: parsed.data.accountabilityEnabled }
        : {})
    };
    const updated = normalizeSettingsUpdate(existing, updateInput);
    await deps.accountability.upsert(updated);
    res.status(200).json({ settings: updated });
  });

  router.post("/accountability/goals/report", async (req, res) => {
    const parsed = goalsReportSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      return;
    }

    await deps.goalReports.upsert({
      userId: req.user.id,
      day: parsed.data.day,
      goalsSetCount: parsed.data.goalsSetCount,
      updatedAt: new Date().toISOString()
    });

    res.status(200).json({ ok: true });
  });

  router.post("/accountability/payment/setup-session", async (req, res) => {
    const existing = (await deps.accountability.getByUser(req.user.id)) ?? defaultAccountabilitySettings(req.user.id);
    const pending = {
      ...existing,
      paymentMethodStatus: "pending_setup" as const,
      updatedAt: new Date().toISOString()
    };
    await deps.accountability.upsert(pending);

    const setupSessionId = `seti_${req.user.id.slice(0, 8)}_${Date.now()}`;
    res.status(200).json({
      setupSessionId,
      checkoutUrl: `https://checkout.stripe.com/pay/${setupSessionId}`,
      provider: "stripe",
      paymentMethodType: "apple_pay_only",
      consent: {
        savePaymentMethod: true,
        offSessionCharges: true
      }
    });
  });

  router.post("/accountability/payment/confirm", async (req, res) => {
    const existing = (await deps.accountability.getByUser(req.user.id)) ?? defaultAccountabilitySettings(req.user.id);
    const active = {
      ...existing,
      paymentMethodStatus: "active" as const,
      providerCustomerId: existing.providerCustomerId ?? `cus_${req.user.id.slice(0, 10)}`,
      providerPaymentMethodId: existing.providerPaymentMethodId ?? `pm_${req.user.id.slice(0, 12)}`,
      paymentMethodLast4: existing.paymentMethodLast4 ?? pseudoLast4(req.user.id),
      updatedAt: new Date().toISOString()
    };
    await deps.accountability.upsert(active);
    res.status(200).json({ settings: active });
  });

  router.delete("/accountability/payment-method", async (req, res) => {
    const existing = (await deps.accountability.getByUser(req.user.id)) ?? defaultAccountabilitySettings(req.user.id);
    const { paymentMethodLast4, providerCustomerId, providerPaymentMethodId, ...rest } = existing;
    void paymentMethodLast4;
    void providerCustomerId;
    void providerPaymentMethodId;
    const updated = {
      ...rest,
      accountabilityEnabled: false,
      paymentMethodStatus: "none" as const,
      updatedAt: new Date().toISOString()
    };
    await deps.accountability.upsert(updated);
    res.status(200).json({ settings: updated });
  });

  router.post("/accountability/charges/run-due", async (req, res) => {
    const parsed = runDueSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      return;
    }

    const settings = (await deps.accountability.getByUser(req.user.id)) ?? defaultAccountabilitySettings(req.user.id);
    const now = parsed.data.nowIso ? new Date(parsed.data.nowIso) : new Date();
    if (Number.isNaN(now.getTime())) {
      res.status(400).json({ error: "invalid_nowIso" });
      return;
    }
    const localDay = localDayIso(now, settings.timezone);

    const goals = await deps.goalReports.getByUserAndDay(req.user.id, localDay);
    const existingDayEntry = await deps.chargeHistory.findByUserDay(req.user.id, localDay);
    const monthlyChargedCount = await deps.chargeHistory.monthlyChargedCount(req.user.id, localDay.slice(0, 7));
    const evaluation = evaluateDueCharge({
      settings,
      now,
      goalsSetCount: goals?.goalsSetCount ?? 0,
      existingDayEntry,
      monthlyChargedCount,
      forceChargeFailure: parsed.data.forceChargeFailure ?? false
    });

    if (evaluation.entry) {
      await deps.chargeHistory.add(evaluation.entry);
    }

    if (evaluation.disabledAccountability) {
      await deps.accountability.upsert({
        ...settings,
        accountabilityEnabled: false,
        updatedAt: new Date().toISOString()
      });
    }

    res.status(200).json({
      result: evaluation,
      settings: evaluation.disabledAccountability
        ? {
            ...settings,
            accountabilityEnabled: false
          }
        : settings
    });
  });

  router.get("/accountability/charge-history", async (req, res) => {
    const entries = await deps.chargeHistory.listByUser(req.user.id);
    res.status(200).json({
      entries: entries.map((entry) => ({
        id: entry.id,
        dateTime: entry.createdAt,
        day: entry.day,
        amountCents: entry.amountCents,
        reason: entry.reason,
        status: entry.status,
        receiptUrl: entry.receiptUrl ?? null,
        providerChargeId: entry.providerChargeId ?? null
      }))
    });
  });

  router.post("/checkins/window/start", async (req, res) => {
    const day = typeof req.body?.day === "string" ? req.body.day : currentDay();
    const existing = await deps.windows.getOpenWindowForDay(req.user.id, day);
    if (existing) {
      const token = createWindowToken(existing, deps.config.WINDOW_TOKEN_SECRET);
      res.status(200).json({ window: existing, windowToken: token, reused: true });
      return;
    }

    const window = startAccountabilityWindow(req.user.id, day);
    await deps.windows.save(window);

    res.status(201).json({
      window,
      windowToken: createWindowToken(window, deps.config.WINDOW_TOKEN_SECRET),
      reused: false
    });
  });

  router.post("/checkins/window/complete", async (req, res) => {
    const parsed = completeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      return;
    }

    const claims = verifyWindowToken(parsed.data.windowToken, deps.config.WINDOW_TOKEN_SECRET);
    if (!claims) {
      res.status(401).json({ error: "invalid_window_token" });
      return;
    }

    if (claims.uid !== req.user.id || claims.day !== parsed.data.day) {
      res.status(403).json({ error: "window_token_subject_mismatch" });
      return;
    }

    const window = await deps.windows.getById(claims.wid);
    if (!window) {
      res.status(404).json({ error: "window_not_found" });
      return;
    }

    try {
      const completed = completeWindow(window);
      await deps.windows.save(completed);
      res.status(200).json({
        status: "mission_completed_in_window",
        chargeCents: 0,
        window: completed
      });
    } catch (error) {
      res.status(409).json({ error: error instanceof Error ? error.message : "window_completion_failed" });
    }
  });

  router.post("/checkins/window/expire", async (req, res) => {
    const parsed = expireSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      return;
    }

    const openWindow = await deps.windows.getOpenWindowForDay(req.user.id, parsed.data.day);
    if (!openWindow) {
      res.status(404).json({ error: "open_window_not_found" });
      return;
    }

    const expired = expireWindow(openWindow);
    await deps.windows.save(expired);

    if (expired.status !== "expired") {
      res.status(200).json({ status: "still_open", window: expired });
      return;
    }

    const summary = await deps.ledger.monthlySummary(req.user.id, yearMonth(parsed.data.day));
    const decision = decideLateCharge({
      userId: req.user.id,
      day: parsed.data.day,
      missesThisMonth: summary.misses,
      chargedCentsThisMonth: summary.chargedCents,
      rules: {
        graceMissesPerMonth: deps.config.GRACE_MISSES_PER_MONTH,
        monthlyChargeCapCents: deps.config.MONTHLY_CHARGE_CAP_CENTS
      }
    });

    await deps.ledger.add(decision.entry);

    res.status(200).json({
      status: decision.shouldCharge ? "late_fee_applied" : "late_fee_waived_grace",
      chargeCents: decision.entry.amountCents,
      ledgerEntry: decision.entry
    });
  });

  router.get("/ledger", async (req, res) => {
    const entries = await deps.ledger.listByUser(req.user.id);
    res.status(200).json({ entries });
  });

  return router;
}

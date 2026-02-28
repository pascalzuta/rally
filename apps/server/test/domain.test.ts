import { describe, expect, it } from "vitest";
import { decideLateCharge } from "../src/domain/ledger.js";
import { completeWindow, startAccountabilityWindow } from "../src/domain/window.js";

describe("window logic", () => {
  it("completes before expiration", () => {
    const started = startAccountabilityWindow("u1", "2026-02-18", 0);
    const completed = completeWindow(started, 60_000);
    expect(completed.status).toBe("completed");
  });
});

describe("late charge decisions", () => {
  it("waives charge during grace period", () => {
    const decision = decideLateCharge({
      userId: "u1",
      day: "2026-02-18",
      missesThisMonth: 1,
      chargedCentsThisMonth: 0,
      rules: { graceMissesPerMonth: 2, monthlyChargeCapCents: 1500 }
    });

    expect(decision.shouldCharge).toBe(false);
    expect(decision.entry.amountCents).toBe(0);
  });

  it("charges after grace when cap allows", () => {
    const decision = decideLateCharge({
      userId: "u1",
      day: "2026-02-18",
      missesThisMonth: 3,
      chargedCentsThisMonth: 200,
      rules: { graceMissesPerMonth: 2, monthlyChargeCapCents: 1500 }
    });

    expect(decision.shouldCharge).toBe(true);
    expect(decision.entry.amountCents).toBe(100);
  });
});

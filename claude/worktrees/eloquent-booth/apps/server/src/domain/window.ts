import { randomUUID } from "node:crypto";
import type { AccountabilityWindow } from "../types/window.js";
import { signToken, verifyToken } from "../security/hmacToken.js";

const TEN_MINUTES_MS = 10 * 60 * 1000;

export interface WindowTokenClaims {
  wid: string;
  uid: string;
  day: string;
  iat: number;
  exp: number;
}

export function startAccountabilityWindow(userId: string, day: string, nowMs = Date.now()): AccountabilityWindow {
  return {
    id: randomUUID(),
    userId,
    day,
    startedAt: nowMs,
    expiresAt: nowMs + TEN_MINUTES_MS,
    status: "open"
  };
}

export function createWindowToken(window: AccountabilityWindow, secret: string): string {
  const iat = Math.floor(window.startedAt / 1000);
  const exp = Math.floor(window.expiresAt / 1000);
  return signToken<WindowTokenClaims>(
    {
      wid: window.id,
      uid: window.userId,
      day: window.day,
      iat,
      exp
    },
    secret
  );
}

export function verifyWindowToken(token: string, secret: string): WindowTokenClaims | null {
  return verifyToken<WindowTokenClaims>(token, secret);
}

export function completeWindow(window: AccountabilityWindow, nowMs = Date.now()): AccountabilityWindow {
  if (window.status !== "open") {
    throw new Error("Window is no longer open.");
  }
  if (nowMs > window.expiresAt) {
    throw new Error("Window expired before completion.");
  }

  return {
    ...window,
    completedAt: nowMs,
    status: "completed"
  };
}

export function expireWindow(window: AccountabilityWindow, nowMs = Date.now()): AccountabilityWindow {
  if (window.status !== "open") return window;
  if (nowMs <= window.expiresAt) return window;
  return {
    ...window,
    status: "expired"
  };
}

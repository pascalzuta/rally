import type { DailyCheckin, PriorityStatus } from "./types";

const STATUS_POINTS: Record<PriorityStatus, number> = {
  pending: 0,
  done: 100,
  partial: 50,
  missed: 0
};

export function calculateDailyScore(checkin: DailyCheckin): number {
  if (!checkin.priorities.length) return 0;

  const total = checkin.priorities.reduce((acc, p) => acc + STATUS_POINTS[p.status], 0);
  const completion = Math.round(total / checkin.priorities.length);

  const confidenceMultiplier = Math.min(Math.max(checkin.confidence, 1), 5) / 5;
  return Math.round(completion * 0.8 + confidenceMultiplier * 20);
}

export function calculateStreak(scores: number[]): number {
  let streak = 0;
  for (let i = scores.length - 1; i >= 0; i -= 1) {
    if (scores[i] >= 70) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

export function smallWinMessage(score: number): string {
  if (score >= 90) return "Strong execution today. Keep the momentum.";
  if (score >= 70) return "Solid follow-through. Protect this rhythm tomorrow.";
  if (score >= 40) return "Partial progress still counts. Tighten scope for tomorrow.";
  return "Reset with one focused win first thing tomorrow.";
}

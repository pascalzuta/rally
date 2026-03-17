import type { Priority } from "./types";

const ACTION_VERBS = [
  "write",
  "ship",
  "review",
  "call",
  "build",
  "draft",
  "plan",
  "finish",
  "complete",
  "study",
  "practice",
  "submit",
  "record",
  "learn",
  "organize",
  "outline",
  "update",
  "improve",
  "start",
  "test",
  "fix",
  "design",
  "publish",
  "prepare",
  "finalize",
  "send",
  "refactor",
  "deploy"
];

const NON_ACTION_STARTERS = ["the", "a", "an", "my", "our", "your", "this", "that", "today", "tomorrow", "later"];

function hasActionVerb(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return false;

  const words = normalized.match(/[a-z']+/g) ?? [];
  if (words.length === 0) return false;

  const first = words[0] ?? "";
  if (!first) return false;
  if (ACTION_VERBS.includes(first)) return true;

  // Accept common imperative forms even if the verb is not in our static dictionary.
  if (!NON_ACTION_STARTERS.includes(first) && /^[a-z]{3,}$/.test(first)) return true;

  // Accept gerund/past forms like "finishing" / "submitted".
  if (/^[a-z]{3,}(ing|ed)$/.test(first)) return true;

  return words.some((word) => ACTION_VERBS.includes(word));
}

function hasMeasurableSignal(text: string): boolean {
  return /\b\d+\b|\bby\b|\bbefore\b|\bdeliver\b|\bcompleted\b/i.test(text);
}

export interface PriorityValidation {
  isValid: boolean;
  hints: string[];
  score: number;
}

export function validatePriority(priority: Pick<Priority, "title" | "why">): PriorityValidation {
  const hints: string[] = [];
  let score = 0;

  if (priority.title.trim().length >= 12) {
    score += 35;
  } else {
    hints.push("Make the priority more specific.");
  }

  if (hasActionVerb(priority.title)) {
    score += 25;
  } else {
    hints.push("Start with a concrete action verb.");
  }

  if (hasMeasurableSignal(priority.title)) {
    score += 20;
  } else {
    hints.push("Add a measurable result or deadline.");
  }

  if (priority.why.trim().length >= 15) {
    score += 20;
  } else {
    hints.push("Clarify why this matters today.");
  }

  return {
    isValid: score >= 70,
    hints,
    score
  };
}

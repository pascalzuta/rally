import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { Priority } from "@daily-priorities/core";
import { validatePriority } from "@daily-priorities/core";

type Role = "friend" | "you" | "system";
type Screen = "start" | "schedule" | "payment" | "mission" | "history";
type Platform = "snapchat" | "instagram";
type BillingPlatform = "ios" | "android" | "web_test";
type YesterdayStatus = "unanswered" | "done" | "partial" | "missed";

interface YesterdayItem {
  id: string;
  title: string;
  status: YesterdayStatus;
}

interface LastLockedPayload {
  day: string;
  items: Array<{ id: string; title: string }>;
}

interface ChatMessage {
  id: string;
  role: Role;
  text: string;
  ts: string;
}

interface LockedPrioritySnapshot {
  id: string;
  title: string;
}

interface HistoryEntry {
  day: string;
  priorities: Array<{ title: string; status: string }>;
  locked: boolean;
  charged: boolean;
  streak: number;
}

interface PendingPriorityDraft {
  raw: string;
  title: string;
}

interface CoachApiResponse {
  reply: string;
  source: "openai" | "fallback";
}

const WINDOW_SECONDS = 10 * 60;
const APP_PASSWORD = "painful";
const ACCESS_GRANTED_KEY = "painful-dollar-access-granted";
const START_SEEN_KEY = "painful-dollar-start-seen";
const PING_TIME_KEY = "painful-dollar-ping-time";
const BILLING_PLATFORM_KEY = "painful-dollar-billing-platform";
const BILLING_READY_KEY = "painful-dollar-billing-ready";
const CHALLENGE_STREAK_KEY = "painful-dollar-challenge-streak";
const CHALLENGE_LAST_DAY_KEY = "painful-dollar-challenge-last-day";
const CHALLENGE_REWARDS_KEY = "painful-dollar-challenge-rewards";
const CHALLENGE_ENABLED_KEY = "painful-dollar-challenge-enabled";
const ONBOARDING_DONE_KEY = "painful-dollar-onboarding-done";
const LAST_LOCKED_PRIORITIES_KEY = "painful-dollar-last-locked-priorities";
const TEST_DAY_KEY = "painful-dollar-test-day";
const LAST_PRIORITY_DAY_KEY = "painful-dollar-last-priority-day";
const HISTORY_KEY = "painful-dollar-history";
const APP_LINK = "https://thepainfuldollar.app/invite";
const API_BASE_URL = ((import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL ?? "/v1").replace(/\/$/, "");

const PLATFORM_CONFIG: Record<Platform, { appUrl: string; webUrl: string; label: string }> = {
  snapchat: {
    appUrl: "snapchat://",
    webUrl: "https://www.snapchat.com/",
    label: "Snapchat"
  },
  instagram: {
    appUrl: "instagram://direct-inbox",
    webUrl: "https://www.instagram.com/direct/inbox/",
    label: "Instagram"
  }
};

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowLabel(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function countdownLabel(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function formatTimeDisplay(value: string): string {
  const [hhRaw, mmRaw] = value.split(":");
  const hh = Number(hhRaw);
  const mm = Number(mmRaw);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return value;
  const suffix = hh >= 12 ? "PM" : "AM";
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${hour12}:${String(mm).padStart(2, "0")} ${suffix}`;
}

function formatDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isValidTimeValue(value: string): boolean {
  return /^\d{2}:\d{2}$/.test(value);
}

function sentenceCase(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function coachAckText(reworded: string): string {
  const raw = reworded.replace(/[.!?]+$/, "");
  const options = [
    `Got it, "${raw}".`,
    `I hear you: "${raw}".`,
    `Nice. Goal set: "${raw}".`
  ];
  return options[Math.floor(Math.random() * options.length)];
}

function formatPriorityEcho(text: string): string {
  const clean = text.replace(/[.!?]+$/, "").trim();
  if (!clean) return "that";
  return clean;
}

function defaultUnderstandingLine(text: string): string {
  const clean = formatPriorityEcho(text);
  const lower = clean.toLowerCase().replace(/[.!?]+$/, "");
  const normalizedIntent = lower === "clean room" || lower === "clean the room" ? "clean your room" : lower;
  const options = [
    `Got it, you want to ${normalizedIntent}.`,
    `Makes sense - your plan is to ${normalizedIntent}.`,
    `Okay, you're aiming to ${normalizedIntent}.`
  ];
  return options[Math.floor(Math.random() * options.length)];
}

function refinePromptFor(priorityText: string): string {
  const clean = formatPriorityEcho(priorityText);
  return `Want to sharpen "${clean}"? You can add a simple outcome or time, or keep it as is.`;
}

function isActionPlanningQuestion(text: string): boolean {
  const normalized = text.toLowerCase();
  if (!normalized.includes("?")) return false;
  const markers = ["which one", "tackle", "start by", "first", "right now", "what's your pick"];
  return markers.some((marker) => normalized.includes(marker));
}

function isPriorityCorrectionSignal(text: string): boolean {
  const normalized = text.toLowerCase();
  const markers = ["not right", "wrong", "mistake", "meant", "typo", "change that", "fix that"];
  return markers.some((marker) => normalized.includes(marker));
}

function extractCorrectionIntent(text: string): string | null {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return null;

  const patterns = [
    /(?:that'?s|that is)\s+wrong[\s,.:-]+(.+?)\s+is\s+what\s+i\s+meant$/i,
    /(?:no[\s,.:-]+)?wrong[\s,.:-]+(.+?)\s+is\s+what\s+i\s+meant$/i,
    /(?:what\s+i\s+meant\s+is|i\s+meant)\s+["']?(.+?)["']?$/i
  ];

  for (const pattern of patterns) {
    const match = clean.match(pattern);
    const candidate = match?.[1]?.trim();
    if (candidate) return candidate;
  }
  return null;
}

function senderIcon(role: Role): string {
  if (role === "friend") return "P";
  if (role === "you") return "Y";
  return "$";
}

function senderLabel(role: Role): string {
  if (role === "friend") return "Coach";
  if (role === "you") return "You";
  return "System";
}

function toCoachHistory(messages: ChatMessage[]): Array<{ role: "user" | "assistant"; content: string }> {
  return messages
    .filter((m) => m.role === "you" || m.role === "friend")
    .slice(-8)
    .map((m) => ({
      role: m.role === "you" ? "user" : "assistant",
      content: m.text
    }));
}

function cleanedPriorityFallback(text: string): string {
  return sentenceCase(text.replace(/\s+/g, " ").replace(/[.!?]+$/, "").trim());
}

function extractCleanPriorityTitle(text: string): string {
  const cleaned = text
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .replace(/^(priority|goal)\s*:\s*/i, "")
    .replace(/^(you should|you can|try to)\s+/i, "")
    .split("\n")[0]
    .trim();
  return sentenceCase(cleaned.replace(/[.!?]+$/, ""));
}

function ordinalWord(index: number): string {
  if (index === 0) return "first";
  if (index === 1) return "second";
  if (index === 2) return "third";
  return `${index + 1}th`;
}

function isoDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function isConsecutiveDay(prevDay: string, currentDay: string): boolean {
  const prev = new Date(`${prevDay}T00:00:00Z`);
  const curr = new Date(`${currentDay}T00:00:00Z`);
  const diff = curr.getTime() - prev.getTime();
  return diff === 24 * 60 * 60 * 1000;
}

function shiftIsoDay(day: string, deltaDays: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

function initialMessages(): ChatMessage[] {
  return [
    {
      id: makeId(),
      role: "friend",
      text: "Morning. Drop your first goal and keep it real.",
      ts: nowLabel()
    }
  ];
}

export default function App() {
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const composerInputRef = useRef<HTMLInputElement | null>(null);
  const [day2Demo] = useState<boolean>(() => new URLSearchParams(window.location.search).get("demo") === "day2");
  const [testDaysMode] = useState<boolean>(() => new URLSearchParams(window.location.search).get("testdays") === "1");
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [accessGranted, setAccessGranted] = useState<boolean>(() => localStorage.getItem(ACCESS_GRANTED_KEY) === "1");
  const [screen, setScreen] = useState<Screen>("start");
  const [messages, setMessages] = useState<ChatMessage[]>(() => initialMessages());
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [title, setTitle] = useState("");
  const [missionLocked, setMissionLocked] = useState(false);
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [remainingSeconds, setRemainingSeconds] = useState(WINDOW_SECONDS);
  const [in7DayChallenge, setIn7DayChallenge] = useState<boolean>(() => localStorage.getItem(CHALLENGE_ENABLED_KEY) === "1");
  const [squadCompletions] = useState(() => Math.floor(Math.random() * 9) + 4);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountEmail] = useState("you@painfuldollar.app");
  const [pingTime, setPingTime] = useState<string>(() => {
    const saved = localStorage.getItem(PING_TIME_KEY);
    return saved && isValidTimeValue(saved) ? saved : "08:10";
  });
  const [billingPlatform, setBillingPlatform] = useState<BillingPlatform | null>(() => {
    const saved = localStorage.getItem(BILLING_PLATFORM_KEY);
    return saved === "ios" || saved === "android" || saved === "web_test" ? saved : null;
  });
  const [billingReady, setBillingReady] = useState<boolean>(() => localStorage.getItem(BILLING_READY_KEY) === "1");
  const [nudgePickerOpen, setNudgePickerOpen] = useState(false);
  const [challengeStreak, setChallengeStreak] = useState<number>(() => {
    const raw = Number(localStorage.getItem(CHALLENGE_STREAK_KEY) ?? "0");
    return Number.isFinite(raw) ? Math.max(0, raw) : 0;
  });
  const [challengeLastDay, setChallengeLastDay] = useState<string>(() => localStorage.getItem(CHALLENGE_LAST_DAY_KEY) ?? "");
  const [challengeRewards, setChallengeRewards] = useState<number>(() => {
    const raw = Number(localStorage.getItem(CHALLENGE_REWARDS_KEY) ?? "0");
    return Number.isFinite(raw) ? Math.max(0, raw) : 0;
  });
  const [lastPriorityDay, setLastPriorityDay] = useState<string>(() => localStorage.getItem(LAST_PRIORITY_DAY_KEY) ?? "");
  const [yesterdayItems, setYesterdayItems] = useState<YesterdayItem[]>([]);
  const [showRewardFirework, setShowRewardFirework] = useState(false);
  const [simulatedDay, setSimulatedDay] = useState<string>(() => {
    const saved = localStorage.getItem(TEST_DAY_KEY);
    return saved && /^\d{4}-\d{2}-\d{2}$/.test(saved) ? saved : isoDay();
  });
  const [reviewSourceText, setReviewSourceText] = useState("yesterday");
  const [firstPriorityActions, setFirstPriorityActions] = useState<{ priorityId: string; prompt: string } | null>(null);
  const [refiningPriorityId, setRefiningPriorityId] = useState<string | null>(null);
  const [lockedBoardOpen, setLockedBoardOpen] = useState(false);
  const [postLockTimePromptOpen, setPostLockTimePromptOpen] = useState(false);
  const [windowMissedNoticeSent, setWindowMissedNoticeSent] = useState(false);
  const [chargeAppliedForToday, setChargeAppliedForToday] = useState(false);
  const [awaitingCorrectionInput, setAwaitingCorrectionInput] = useState(false);
  const [pendingPriorityDraft, setPendingPriorityDraft] = useState<PendingPriorityDraft | null>(null);
  const [showTickCelebration, setShowTickCelebration] = useState(false);
  const [tickBurstOrigin, setTickBurstOrigin] = useState<{ x: number; y: number; radius: number }>({
    x: 50,
    y: 50,
    radius: 900
  });
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
    } catch {
      return [];
    }
  });
  const expirySavedRef = useRef<string>("");

  useEffect(() => {
    if (!accessGranted) return;
    if (day2Demo) {
      setScreen("mission");
      setMissionLocked(false);
      setRemainingSeconds(WINDOW_SECONDS);
      setYesterdayItems([
        { id: "d2-1", title: "Finish math worksheet by 6pm", status: "unanswered" },
        { id: "d2-2", title: "Send science project outline", status: "unanswered" }
      ]);
      setMessages([
        {
          id: makeId(),
          role: "friend",
          text: "Day 2. Quick review first: done, partial, or missed?",
          ts: nowLabel()
        }
      ]);
      return;
    }
    const seen = localStorage.getItem(START_SEEN_KEY) === "1";
    if (seen && billingReady) setScreen("mission");
  }, [billingReady, day2Demo, accessGranted]);

  useEffect(() => {
    localStorage.setItem(PING_TIME_KEY, pingTime);
  }, [pingTime]);

  useEffect(() => {
    if (!billingPlatform) return;
    localStorage.setItem(BILLING_PLATFORM_KEY, billingPlatform);
  }, [billingPlatform]);

  useEffect(() => {
    localStorage.setItem(BILLING_READY_KEY, billingReady ? "1" : "0");
  }, [billingReady]);

  useEffect(() => {
    localStorage.setItem(CHALLENGE_STREAK_KEY, String(challengeStreak));
  }, [challengeStreak]);

  useEffect(() => {
    localStorage.setItem(CHALLENGE_LAST_DAY_KEY, challengeLastDay);
  }, [challengeLastDay]);

  useEffect(() => {
    localStorage.setItem(CHALLENGE_REWARDS_KEY, String(challengeRewards));
  }, [challengeRewards]);

  useEffect(() => {
    localStorage.setItem(CHALLENGE_ENABLED_KEY, in7DayChallenge ? "1" : "0");
  }, [in7DayChallenge]);

  useEffect(() => {
    localStorage.setItem(LAST_PRIORITY_DAY_KEY, lastPriorityDay);
  }, [lastPriorityDay]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(historyEntries));
  }, [historyEntries]);

  useEffect(() => {
    if (remainingSeconds > 0 || missionLocked || screen !== "mission" || day2Demo) return;
    const effectToday = testDaysMode ? simulatedDay : isoDay();
    if (expirySavedRef.current === effectToday) return;
    expirySavedRef.current = effectToday;
    const charged = billingPlatform === "ios" || billingPlatform === "android";
    setHistoryEntries((prev) => {
      const filtered = prev.filter((e) => e.day !== effectToday);
      return [{ day: effectToday, priorities: [], locked: false, charged, streak: 0 }, ...filtered].slice(0, 90);
    });
  }, [remainingSeconds, missionLocked, screen, day2Demo, testDaysMode, simulatedDay, billingPlatform]);

  useEffect(() => {
    if (!showRewardFirework) return;
    const timer = window.setTimeout(() => setShowRewardFirework(false), 9600);
    return () => window.clearTimeout(timer);
  }, [showRewardFirework]);

  useEffect(() => {
    if (!showTickCelebration) return;
    const timer = window.setTimeout(() => setShowTickCelebration(false), 2000);
    return () => window.clearTimeout(timer);
  }, [showTickCelebration]);

  useEffect(() => {
    if (!testDaysMode) return;
    localStorage.setItem(TEST_DAY_KEY, simulatedDay);
  }, [testDaysMode, simulatedDay]);

  useEffect(() => {
    if (!accountOpen) return;
    function handleClickOutside(event: MouseEvent): void {
      const target = event.target as Node;
      if (accountMenuRef.current && !accountMenuRef.current.contains(target)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [accountOpen]);

  useEffect(() => {
    if (screen !== "mission") return;
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [screen, messages, yesterdayItems, postLockTimePromptOpen]);

  useEffect(() => {
    if (day2Demo) return;
    if (screen !== "mission") return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setRemainingSeconds(Math.max(0, WINDOW_SECONDS - elapsed));
    }, 1000);
    return () => clearInterval(interval);
  }, [screen, startedAt, day2Demo]);

  useEffect(() => {
    if (screen !== "mission") return;
    if (missionLocked) return;
    if (remainingSeconds !== 0) return;
    if (windowMissedNoticeSent) return;
    post("system", "The painful dollar has been charged. You can still set goals for today.");
    setChargeAppliedForToday(true);
    setWindowMissedNoticeSent(true);
  }, [screen, missionLocked, remainingSeconds, windowMissedNoticeSent]);

  const expired = remainingSeconds === 0 && !missionLocked;
  const hasChargeToday = chargeAppliedForToday || expired;
  const todaysChargeLabel = hasChargeToday ? "$1" : missionLocked ? "$0" : "Pending";
  const isUrgent = remainingSeconds > 0 && remainingSeconds <= 120 && !missionLocked;
  const isWarning = remainingSeconds > 120 && remainingSeconds <= 300 && !missionLocked;
  const today = testDaysMode ? simulatedDay : isoDay();
  const hasSetPrioritiesToday = lastPriorityDay === today;
  const challengePreviewDay = hasSetPrioritiesToday && !missionLocked && challengeLastDay !== today ? 1 : 0;
  const challengeVisualDays = Math.min(challengeStreak + challengePreviewDay, 7);
  const challengeProgress = Math.round((challengeVisualDays / 7) * 100);
  const yesterdayAnsweredCount = yesterdayItems.filter((item) => item.status !== "unanswered").length;
  const allYesterdayAnswered = yesterdayItems.length > 0 && yesterdayAnsweredCount === yesterdayItems.length;
  const nextYesterdayIndex = yesterdayItems.findIndex((item) => item.status === "unanswered");
  const activeYesterdayItem = nextYesterdayIndex >= 0 ? yesterdayItems[nextYesterdayIndex] : null;
  const canSetTodayPriorities = yesterdayItems.length === 0 || allYesterdayAnswered;
  const streakAtRisk = !hasSetPrioritiesToday;
  const realChargeEnabled = billingReady && (billingPlatform === "ios" || billingPlatform === "android");
  const chargeMessage = missionLocked
    ? chargeAppliedForToday
      ? "The painful dollar has been charged already today. You still locked your goals, and that still helps."
      : "Charge avoided. You are at $0 for today."
    : expired
      ? realChargeEnabled
        ? "Time is up. The painful dollar has been charged."
        : "Time is up. The painful dollar has been charged (simulated in web mode)."
      : "Set daily goals. Make progress every day.\nNo goals? That's $1.";
  const riskClass = missionLocked ? (chargeAppliedForToday ? "late" : "safe") : expired ? "late" : isUrgent ? "urgent" : isWarning ? "warning" : "open";

  function post(role: Role, text: string): void {
    setMessages((prev) => [...prev, { id: makeId(), role, text, ts: nowLabel() }]);
  }

  async function requestCoachReply(userText: string): Promise<string> {
    try {
      const response = await fetch(`${API_BASE_URL}/coach/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          history: toCoachHistory(messages),
          context: {
            prioritiesToday: priorities.length,
            missionLocked,
            secondsLeft: remainingSeconds
          }
        })
      });

      if (!response.ok) return "";
      const payload = (await response.json()) as CoachApiResponse;
      return typeof payload.reply === "string" ? payload.reply.trim() : "";
    } catch {
      return "";
    }
  }

  async function requestCleanPriorityTitle(rawText: string): Promise<string> {
    const reply = await requestCoachReply(
      `Rewrite this into one clean goal title only (no extra commentary, no quotes). Correct obvious typos if clear from context: "${rawText}".`
    );
    if (!reply) return cleanedPriorityFallback(rawText);
    const extracted = extractCleanPriorityTitle(reply);
    return extracted || cleanedPriorityFallback(rawText);
  }

  function unlockApp(): void {
    if (passwordInput.trim() === APP_PASSWORD) {
      setAccessGranted(true);
      setPasswordError("");
      localStorage.setItem(ACCESS_GRANTED_KEY, "1");
      return;
    }
    setPasswordError("Wrong password");
  }

  function openStartScreen(): void {
    setScreen("start");
  }

  function shiftTestDay(days: number): void {
    setSimulatedDay((prev) => shiftIsoDay(prev, days));
  }

  function resetTestDayToToday(): void {
    setSimulatedDay(isoDay());
  }

  function enableTestMode(): void {
    const params = new URLSearchParams(window.location.search);
    params.set("testdays", "1");
    window.location.search = params.toString();
  }

  function disableTestMode(): void {
    const params = new URLSearchParams(window.location.search);
    params.delete("testdays");
    window.location.search = params.toString();
  }

  function simulateStreakReached(): void {
    setIn7DayChallenge(true);
    setChallengeRewards((prev) => prev + 1);
    setChallengeStreak(0);
    setChallengeLastDay("");
    setShowRewardFirework(true);
    post("system", "Test mode: 7-day streak reached. $1 back awarded.");
  }

  function simulateWindowMissed(): void {
    setMissionLocked(false);
    setStartedAt(Date.now() - WINDOW_SECONDS * 1000);
    setRemainingSeconds(0);
    setChargeAppliedForToday(true);
    post("system", "Test mode: 10-minute window missed.");
  }

  function resetAsNewUser(): void {
    Object.keys(localStorage)
      .filter((key) => key.startsWith("painful-dollar-"))
      .forEach((key) => localStorage.removeItem(key));
    // Keep test/dev access so "new user" starts at the app start screen, not password gate.
    localStorage.setItem(ACCESS_GRANTED_KEY, "1");
    window.location.href = window.location.pathname;
  }

  function beginMission(): void {
    if (!billingReady) {
      setScreen("payment");
      return;
    }

    const messagesToSet = initialMessages();
    if (in7DayChallenge) {
      messagesToSet.push({
        id: makeId(),
        role: "system",
        text: "7-day challenge started.",
        ts: nowLabel()
      });
    }

    const storedYesterday = localStorage.getItem(LAST_LOCKED_PRIORITIES_KEY);
    let nextYesterday: YesterdayItem[] = [];
    let sourceText = "yesterday";
    if (storedYesterday) {
      try {
        const parsed = JSON.parse(storedYesterday) as LastLockedPayload;
        if (parsed.day && parsed.day !== today) {
          const isYesterday = isConsecutiveDay(parsed.day, today);
          sourceText = isYesterday ? "yesterday" : `your last check-in (${formatDayLabel(parsed.day)})`;
          nextYesterday = parsed.items.slice(0, 3).map((item) => ({
            id: item.id,
            title: item.title,
            status: "unanswered"
          }));
        }
      } catch {
        nextYesterday = [];
      }
    }

    if (!nextYesterday.length && storedYesterday) {
      try {
        const parsedLegacy = JSON.parse(storedYesterday) as Array<{ id: string; title: string }>;
        nextYesterday = parsedLegacy.slice(0, 3).map((item) => ({
          id: item.id,
          title: item.title,
          status: "unanswered"
        }));
      } catch {
        nextYesterday = [];
      }
    }

    setMessages(messagesToSet);
    setYesterdayItems(nextYesterday);
    setReviewSourceText(sourceText);
    setPriorities([]);
    setTitle("");
    setMissionLocked(false);
    setFirstPriorityActions(null);
    setRefiningPriorityId(null);
    setLockedBoardOpen(false);
    setPostLockTimePromptOpen(false);
    setWindowMissedNoticeSent(false);
    setChargeAppliedForToday(false);
    setAwaitingCorrectionInput(false);
    setPendingPriorityDraft(null);
    setScreen("mission");
    setStartedAt(Date.now());
    setRemainingSeconds(WINDOW_SECONDS);
    localStorage.setItem(START_SEEN_KEY, "1");
    localStorage.setItem(ONBOARDING_DONE_KEY, "1");
  }

  function openScheduleQuestion(): void {
    setScreen("schedule");
  }

  function openPaymentSetup(): void {
    setScreen("payment");
  }

  function selectBillingPlatform(platform: BillingPlatform): void {
    setBillingPlatform(platform);
    setBillingReady(true);
  }

  function signOut(): void {
    localStorage.removeItem(START_SEEN_KEY);
    localStorage.removeItem(ACCESS_GRANTED_KEY);
    setAccessGranted(false);
    setScreen("start");
    setMessages(initialMessages());
    setPriorities([]);
    setTitle("");
    setMissionLocked(false);
    setFirstPriorityActions(null);
    setRefiningPriorityId(null);
    setLockedBoardOpen(false);
    setPostLockTimePromptOpen(false);
    setWindowMissedNoticeSent(false);
    setChargeAppliedForToday(false);
    setAwaitingCorrectionInput(false);
    setPendingPriorityDraft(null);
    setYesterdayItems([]);
    setStartedAt(Date.now());
    setRemainingSeconds(WINDOW_SECONDS);
    setAccountOpen(false);
  }

  function addHistoryEntry(entry: HistoryEntry): void {
    setHistoryEntries((prev) => {
      const filtered = prev.filter((e) => e.day !== entry.day);
      return [entry, ...filtered].slice(0, 90);
    });
  }

  async function copyToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fall through to legacy copy approach.
    }

    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "absolute";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(area);
      return copied;
    } catch {
      return false;
    }
  }

  async function shareInvite(): Promise<void> {
    const text = "Join me on The Painful Dollar. We lock goals in 10 minutes or pay $1.";
    if (navigator.share) {
      try {
        await navigator.share({ title: "The Painful Dollar", text, url: APP_LINK });
        post("system", "Invite shared.");
        return;
      } catch {
        // Fall back to clipboard.
      }
    }

    const copied = await copyToClipboard(`${text} ${APP_LINK}`);
    post("system", copied ? "Invite link copied. Drop it in your group chat." : "Couldn't auto-copy. Share the invite from the app link.");
  }

  async function shareLockWin(): Promise<void> {
    const text = `I locked my day on The Painful Dollar: ${priorities.length} goals, $0 charge.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Mission Locked", text });
        post("system", "Lock win shared.");
        return;
      } catch {
        // Fall back to clipboard.
      }
    }
    const copied = await copyToClipboard(text);
    post("system", copied ? "Lock win copied. Share it with your squad." : "Couldn't auto-copy lock win.");
  }

  async function nudgeSquad(): Promise<void> {
    setNudgePickerOpen(true);
  }

  async function nudgeViaShareSheet(): Promise<void> {
    const text = "Mission check: lock your goals now so nobody pays the painful dollar.";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Nudge Squad", text });
        post("system", "Nudge shared.");
        return;
      } catch {
        // Fall through to copy fallback.
      }
    }
    const copied = await copyToClipboard(text);
    post("system", copied ? "Nudge copied. Share it anywhere." : "Couldn't auto-copy nudge.");
  }

  async function shareViaPlatform(platform: Platform, text: string, includeLink = false): Promise<void> {
    const payload = includeLink ? `${text} ${APP_LINK}` : text;
    const copied = await copyToClipboard(payload);
    const config = PLATFORM_CONFIG[platform];

    // Best effort: try opening the app, then fallback to the platform web inbox/home.
    window.location.href = config.appUrl;
    setTimeout(() => {
      window.location.href = config.webUrl;
    }, 900);

    post(
      "system",
      copied
        ? `${config.label} opened. Paste and send your message.`
        : `${config.label} opened. Copy failed, but you can still type the message manually.`
    );
  }

  async function inviteViaPlatform(platform: Platform): Promise<void> {
    const text = "Join me on The Painful Dollar. We lock goals in 10 minutes or pay $1.";
    await shareViaPlatform(platform, text, true);
  }

  async function nudgeViaPlatform(platform: Platform): Promise<void> {
    const text = "Mission check: lock your goals now so nobody pays the painful dollar.";
    await shareViaPlatform(platform, text);
  }

  async function shareLockViaPlatform(platform: Platform): Promise<void> {
    const text = `I locked my day on The Painful Dollar: ${priorities.length} goals, $0 charge.`;
    await shareViaPlatform(platform, text);
  }

  async function commitPriority(cleanTitle: string, options?: { echoUser?: boolean }): Promise<void> {
    const shouldEchoUser = options?.echoUser ?? true;
    const validation = validatePriority({ title: cleanTitle, why: cleanTitle });
    if (shouldEchoUser) post("you", cleanTitle);

    const rewrittenTitle = await requestCleanPriorityTitle(cleanTitle);
    const priorityId = makeId();
    const next: Priority = {
      id: priorityId,
      title: rewrittenTitle,
      why: `From your check-in: "${cleanTitle}"`,
      blockers: "",
      status: "pending"
    };

    setPriorities((prev) => [...prev, next]);
    setTitle("");
    setLastPriorityDay(today);
    const nextCount = priorities.length + 1;
    const hint = validation.hints[0] ?? "add a deadline so it's easier to finish.";
    if (nextCount === 1) {
      const firstPriorityReply = await requestCoachReply(
        `User set first goal: "${cleanTitle}". Respond in one short natural sentence confirming intent only. Do not ask how to execute it, do not ask ordering questions, and do not ask what to tackle now.`
      );
      const opener = !firstPriorityReply || isActionPlanningQuestion(firstPriorityReply)
        ? defaultUnderstandingLine(cleanTitle)
        : firstPriorityReply;
      setFirstPriorityActions({
        priorityId,
        prompt: `${opener} Want to refine that one or add your next goal?`
      });
      return;
    }

    setFirstPriorityActions(null);
    const coachReply = await requestCoachReply(cleanTitle);
    const parts: string[] = [coachReply || coachAckText(rewrittenTitle)];
    if (!validation.isValid && hint) parts.push("If you want, I can sharpen it.");
    if (nextCount >= 2) parts.push("You can lock now or add one more.");
    post("friend", parts.join(" "));
  }

  async function addPriority(): Promise<void> {
    if (missionLocked || !canSetTodayPriorities) return;

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      post("friend", "Send one thing you'll do today.");
      return;
    }

    if (refiningPriorityId) {
      post("you", cleanTitle);
      const rewrittenTitle = await requestCleanPriorityTitle(cleanTitle);
      setPriorities((prev) =>
        prev.map((p) => (p.id === refiningPriorityId ? { ...p, title: rewrittenTitle, why: `From your check-in: "${cleanTitle}"` } : p))
      );
      setRefiningPriorityId(null);
      setTitle("");
      setLastPriorityDay(today);
      const coachReply = await requestCoachReply(`I refined my goal to: ${cleanTitle}`);
      post("friend", coachReply || `Nice update. I’ve got "${formatPriorityEcho(cleanTitle)}".`);
      return;
    }

    if (isPriorityCorrectionSignal(cleanTitle)) {
      post("you", cleanTitle);
      const correctedIntent = extractCorrectionIntent(cleanTitle);
      if (!priorities.length) {
        if (correctedIntent) {
          const rewrittenTitle = await requestCleanPriorityTitle(correctedIntent);
          setPendingPriorityDraft({ raw: correctedIntent, title: rewrittenTitle });
          setAwaitingCorrectionInput(false);
          setTitle("");
          return;
        }
        setTitle("");
        setAwaitingCorrectionInput(true);
        post("friend", "Got it. Send the corrected goal and I’ll add it once you confirm.");
        return;
      }
      if (correctedIntent) {
        const rewrittenTitle = await requestCleanPriorityTitle(correctedIntent);
        const lastPriority = priorities[priorities.length - 1];
        setPriorities((prev) =>
          prev.map((p, idx) =>
            idx === prev.length - 1 ? { ...p, title: rewrittenTitle, why: `From your check-in: "${correctedIntent}"` } : p
          )
        );
        setAwaitingCorrectionInput(false);
        setPendingPriorityDraft(null);
        setTitle("");
        if (priorities.length === 1) {
          setFirstPriorityActions({
            priorityId: lastPriority.id,
            prompt: `Got it - updated to "${rewrittenTitle}". Want to refine it or add your next goal?`
          });
        } else {
          post("friend", `Got it - updated to "${rewrittenTitle}".`);
        }
        return;
      }
      const removed = priorities[priorities.length - 1];
      setPriorities((prev) => prev.slice(0, -1));
      if (firstPriorityActions?.priorityId === removed.id) setFirstPriorityActions(null);
      setAwaitingCorrectionInput(true);
      setPendingPriorityDraft(null);
      setTitle("");
      post("friend", `Got it. I removed "${removed.title}". Send the corrected goal and I’ll add it once you confirm.`);
      return;
    }

    if (awaitingCorrectionInput) {
      post("you", cleanTitle);
      const rewrittenTitle = await requestCleanPriorityTitle(cleanTitle);
      setPendingPriorityDraft({ raw: cleanTitle, title: rewrittenTitle });
      setAwaitingCorrectionInput(false);
      setTitle("");
      return;
    }

    if (pendingPriorityDraft) {
      post("you", cleanTitle);
      const rewrittenTitle = await requestCleanPriorityTitle(cleanTitle);
      setPendingPriorityDraft({ raw: cleanTitle, title: rewrittenTitle });
      setTitle("");
      return;
    }

    await commitPriority(cleanTitle);
  }

  async function confirmPendingPriority(): Promise<void> {
    if (!pendingPriorityDraft) return;
    const raw = pendingPriorityDraft.raw;
    setPendingPriorityDraft(null);
    await commitPriority(raw, { echoUser: false });
  }

  function changePendingPriority(): void {
    if (!pendingPriorityDraft) return;
    setTitle(pendingPriorityDraft.raw);
    setPendingPriorityDraft(null);
    window.setTimeout(() => composerInputRef.current?.focus(), 0);
  }

  function chooseRefinePriority(priorityId: string): void {
    const selected = priorities.find((p) => p.id === priorityId);
    if (!selected) return;
    setRefiningPriorityId(priorityId);
    setFirstPriorityActions(null);
    setTitle(selected.title.replace(/[.!?]+$/, ""));
    post("friend", refinePromptFor(selected.title));
    window.setTimeout(() => composerInputRef.current?.focus(), 0);
  }

  function chooseAddNextPriority(): void {
    setFirstPriorityActions(null);
    setRefiningPriorityId(null);
    post("friend", "Okay, what's next?");
    window.setTimeout(() => composerInputRef.current?.focus(), 0);
  }

  async function lockDay(): Promise<void> {
    if (missionLocked) return;
    if (priorities.length === 0) {
      post("friend", "Add at least one goal first.");
      return;
    }

    const alreadyCharged = chargeAppliedForToday || remainingSeconds === 0;
    setMissionLocked(true);
    if (alreadyCharged) {
      post("friend", "Locked. The painful dollar has already been charged today, but still a strong move locking your goals.");
    } else {
      post("friend", "Locked. You're safe from today's $1 charge.");
    }
    const lockedTitles = priorities.map((p) => p.title);
    const leadLine = "Locked goals for today:";
    const bullets = lockedTitles.length
      ? lockedTitles.map((title) => `• ${title}`).join("\n")
      : "• No goals captured";
    const chargedLine = alreadyCharged
      ? "The painful dollar has already been charged today, but locking your goals still helps your day."
      : "";
    const tailLine =
      lockedTitles.length === 1
        ? "You can come back to Today Board anytime and mark it done."
        : "You can come back to Today Board anytime and mark them done.";
    post("friend", `${leadLine}\n${bullets}${chargedLine ? `\n${chargedLine}` : ""}\n${tailLine}`);
    setPostLockTimePromptOpen(true);
    setLockedBoardOpen(false);
    const lockedItems: LockedPrioritySnapshot[] = priorities.map((p) => ({ id: p.id, title: p.title }));
    localStorage.setItem(
      LAST_LOCKED_PRIORITIES_KEY,
      JSON.stringify({
        day: today,
        items: lockedItems
      } satisfies LastLockedPayload)
    );

    // Save to history
    addHistoryEntry({
      day: today,
      priorities: priorities.map((p) => ({ title: p.title, status: p.status })),
      locked: true,
      charged: false,
      streak: challengeStreak,
    });

    if (in7DayChallenge) {
      const current = today;
      if (challengeLastDay !== current) {
        const nextStreak = challengeLastDay && isConsecutiveDay(challengeLastDay, current) ? challengeStreak + 1 : 1;
        setChallengeStreak(nextStreak);
        setChallengeLastDay(current);

        if (nextStreak >= 7) {
          setChallengeRewards((prev) => prev + 1);
          setChallengeStreak(0);
          setChallengeLastDay("");
          setShowRewardFirework(true);
          post("system", "7-day challenge complete. You got $1 back.");
        } else {
          post("system", `7-day challenge progress: ${nextStreak}/7`);
        }
      }
    }
  }

  function keepNextCheckInTime(): void {
    setPostLockTimePromptOpen(false);
    post("friend", `Perfect. I’ll check in tomorrow at ${formatTimeDisplay(pingTime)}.`);
  }

  function changeNextCheckInTime(): void {
    const suggested = window.prompt("Set your check-in time for tomorrow (HH:MM)", pingTime);
    if (suggested === null) return;
    const next = suggested.trim();
    if (!isValidTimeValue(next)) {
      post("friend", "Use HH:MM format, like 08:10.");
      return;
    }
    setPingTime(next);
    setPostLockTimePromptOpen(false);
    post("friend", `Updated. I’ll check in tomorrow at ${formatTimeDisplay(next)}.`);
  }

  function reworkTodaysPriorities(): void {
    setMissionLocked(false);
    setPostLockTimePromptOpen(false);
    post("friend", "Okay. Rework today's goals and lock again.");
    window.setTimeout(() => composerInputRef.current?.focus(), 0);
  }

  function quickTickPriority(id: string, event?: ReactMouseEvent<HTMLButtonElement>): void {
    if (event?.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
      const y = ((rect.top + rect.height / 2) / window.innerHeight) * 100;
      const radius = Math.hypot(window.innerWidth, window.innerHeight);
      setTickBurstOrigin({ x, y, radius });
    }
    let turnedDone = false;
    setPriorities((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (p.status !== "done") {
          turnedDone = true;
          return { ...p, status: "done" };
        }
        return { ...p, status: "pending" };
      })
    );
    if (turnedDone) setShowTickCelebration(true);
  }

  function updateYesterdayStatus(id: string, status: Exclude<YesterdayStatus, "unanswered">): void {
    const selected = yesterdayItems.find((item) => item.id === id);
    if (!selected || selected.status !== "unanswered") return;

    post("you", `${status} — ${selected.title}`);

    const next = yesterdayItems.map((item) => (item.id === id ? { ...item, status } : item));
    setYesterdayItems(next);

    const nextIndex = next.findIndex((item) => item.status === "unanswered");
    if (nextIndex === -1) {
      post("friend", "Review done. Now set today's goals.");
      return;
    }
    const nextItem = next[nextIndex];
    if (nextItem) {
      post("friend", `Next one: "${nextItem.title}" - done, partial, or missed?`);
    }
  }

  if (!accessGranted) {
    return (
      <div className="app">
        <section className="start-card">
          <img src="/logo.svg" alt="The Painful Dollar logo" className="app-logo" />
          <p className="eyebrow">PRIVATE ACCESS</p>
          <h1>Enter password to continue</h1>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") unlockApp();
            }}
            className="schedule-time"
            placeholder="Password"
          />
          {passwordError ? <p className="password-error">{passwordError}</p> : null}
          <div className="schedule-actions">
            <button onClick={unlockApp}>Unlock</button>
          </div>
        </section>
      </div>
    );
  }

  if (screen === "start") {
    return (
      <div className="app">
        <section className="start-card">
          <img src="/logo.svg" alt="The Painful Dollar logo" className="app-logo" />
          <p className="eyebrow">THE PAINFUL DOLLAR</p>
          <h1>
            Set daily goals.
            <br />
            Make progress every day.
            <br />
            No goals? That's $1.
          </h1>
          <button
            className="start-cta"
            onClick={() => {
              const onboardingDone = localStorage.getItem(ONBOARDING_DONE_KEY) === "1";
              if (onboardingDone && billingReady) {
                beginMission();
              } else {
                openScheduleQuestion();
              }
            }}
          >
            Set today's goals
          </button>
          <div className="start-hooks">
            <button className="secondary" onClick={() => setIn7DayChallenge((v) => !v)}>
              {in7DayChallenge ? (
                <>
                  Seven Day Challenge:
                  <br />
                  On
                </>
              ) : (
                <>
                  Seven Day Challenge:
                  <br />
                  Get your dollar back.
                </>
              )}
            </button>
            <button className="secondary" onClick={shareInvite}>Invite Friend</button>
            <button className="secondary" onClick={() => inviteViaPlatform("snapchat")}>Invite via Snapchat</button>
            <button className="secondary" onClick={() => inviteViaPlatform("instagram")}>Invite via Instagram</button>
          </div>
        </section>
      </div>
    );
  }

  if (screen === "schedule") {
    return (
      <div className="app">
        <section className="start-card">
          <img src="/logo.svg" alt="The Painful Dollar logo" className="app-logo" />
          <p className="eyebrow">THE PAINFUL DOLLAR</p>
          <h1>At what time in the morning should I ping you to set your goals?</h1>
          <p className="muted">Set them in 10 minutes - or pay $1.</p>
          <input
            id="ping-time"
            type="time"
            value={pingTime}
            onChange={(e) => setPingTime(e.target.value)}
            className="schedule-time"
          />
          <div className="schedule-actions">
            <button className="secondary" onClick={() => setScreen("start")}>Back</button>
            <button onClick={openPaymentSetup}>Save and continue</button>
          </div>
        </section>
      </div>
    );
  }

  if (screen === "payment") {
    return (
      <div className="app">
        <section className="start-card">
          <img src="/logo.svg" alt="The Painful Dollar logo" className="app-logo" />
          <p className="eyebrow">PAYMENT SETUP</p>
          <h1>Connect payment so missed goals trigger $1.</h1>
          <p className="muted">In this web prototype, real App Store / Google Play billing cannot run yet.</p>
          <div className="payment-options">
            <button className={billingPlatform === "ios" ? "pay-option active" : "pay-option"} onClick={() => selectBillingPlatform("ios")}>
              iPhone (App Store billing)
            </button>
            <button className={billingPlatform === "android" ? "pay-option active" : "pay-option"} onClick={() => selectBillingPlatform("android")}>
              Android (Google Play billing)
            </button>
            <button className={billingPlatform === "web_test" ? "pay-option active" : "pay-option"} onClick={() => selectBillingPlatform("web_test")}>
              Web test mode (simulated charges)
            </button>
          </div>
          <div className="schedule-actions">
            <button className="secondary" onClick={() => setScreen("schedule")}>Back</button>
            <button onClick={beginMission} disabled={!billingReady}>Continue</button>
          </div>
        </section>
      </div>
    );
  }

  if (screen === "history") {
    const lockedCount = historyEntries.filter((e) => e.locked).length;
    const missedCount = historyEntries.filter((e) => !e.locked).length;
    const chargedTotal = historyEntries.filter((e) => e.charged).length;
    const recentStreak = (() => {
      let streak = 0;
      const sorted = [...historyEntries].sort((a, b) => b.day.localeCompare(a.day));
      for (const e of sorted) {
        if (e.locked) streak++;
        else break;
      }
      return streak;
    })();

    return (
      <div className="app">
        <header className="history-header">
          <button className="history-back" onClick={() => setScreen("mission")}>
            ← Back
          </button>
          <div>
            <p className="eyebrow">THE PAINFUL DOLLAR</p>
            <h2 className="history-title">Your History</h2>
          </div>
        </header>

        <section className="history-stats">
          <div className="history-stat">
            <strong>{lockedCount}</strong>
            <span>Locked</span>
          </div>
          <div className="history-stat">
            <strong>{missedCount}</strong>
            <span>Missed</span>
          </div>
          <div className="history-stat">
            <strong>{recentStreak}</strong>
            <span>Streak</span>
          </div>
          <div className="history-stat charged">
            <strong>${chargedTotal}</strong>
            <span>Charged</span>
          </div>
        </section>

        {historyEntries.length === 0 ? (
          <section className="history-empty">
            <p>No check-ins yet.</p>
            <p className="muted">Lock your first day to start tracking.</p>
          </section>
        ) : (
          <section className="history-list">
            {[...historyEntries]
              .sort((a, b) => b.day.localeCompare(a.day))
              .map((entry) => {
                const d = new Date(`${entry.day}T00:00:00`);
                const dateLabel = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
                const doneCount = entry.priorities.filter((p) => p.status === "done").length;
                return (
                  <article key={entry.day} className={`history-card ${entry.locked ? "locked" : "missed"}`}>
                    <div className="history-card-head">
                      <div>
                        <p className="history-date">{dateLabel}</p>
                        {entry.priorities.length > 0 ? (
                          <p className="history-meta">
                            {entry.priorities.length} {entry.priorities.length === 1 ? "priority" : "priorities"}
                            {entry.locked ? ` · ${doneCount}/${entry.priorities.length} done` : ""}
                          </p>
                        ) : (
                          <p className="history-meta muted">No priorities recorded</p>
                        )}
                      </div>
                      <div className="history-badges">
                        <span className={`history-status ${entry.locked ? "safe" : "late"}`}>
                          {entry.locked ? "Locked" : "Missed"}
                        </span>
                        <span className={`history-charge ${entry.charged ? "charged" : "free"}`}>
                          {entry.charged ? "$1" : "$0"}
                        </span>
                      </div>
                    </div>
                    {entry.priorities.length > 0 ? (
                      <ul className="history-priorities">
                        {entry.priorities.map((p, i) => (
                          <li key={i} className={`history-priority-item ${p.status}`}>
                            <span className="history-priority-dot" />
                            {p.title}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                );
              })}
          </section>
        )}
      </div>
    );
  }

  return (
    <>
      {showTickCelebration ? (
        <div className="tick-celebration" aria-hidden="true">
          <div
            className="tick-burst-origin"
            style={{ left: `${tickBurstOrigin.x}%`, top: `${tickBurstOrigin.y}%` }}
          >
            <span className="tick-ring r1" />
            <span className="tick-ring r2" />
            <span className="tick-ring r3" />
          </div>
          <div
            className="tick-celebration-spray"
            style={{
              background: `
                radial-gradient(circle at ${tickBurstOrigin.x}% ${tickBurstOrigin.y}%, rgba(168, 255, 194, 0.2), transparent 28%),
                radial-gradient(circle at ${tickBurstOrigin.x}% ${tickBurstOrigin.y}%, rgba(182, 130, 255, 0.2), transparent 36%)
              `
            }}
          >
            {Array.from({ length: 72 }).map((_, i) => {
              const angleDeg = (i * 137.5) % 360;
              const angle = (angleDeg * Math.PI) / 180;
              const distance = tickBurstOrigin.radius * (0.32 + (i % 5) * 0.11);
              const dx = Math.cos(angle) * distance;
              const dy = Math.sin(angle) * distance;
              const hue = i % 2 === 0 ? 140 + (i % 7) * 2 : 266 + (i % 7) * 2;
              const size = 3 + (i % 4);
              const delay = (i % 12) * 22;
              const duration = 880 + (i % 6) * 120;
              return (
                <span
                  key={i}
                  className="tick-dot"
                  style={{
                    left: `${tickBurstOrigin.x}%`,
                    top: `${tickBurstOrigin.y}%`,
                    width: `${size}px`,
                    height: `${size}px`,
                    animationDelay: `${delay}ms`,
                    animationDuration: `${duration}ms`,
                    background: `hsl(${hue} 92% 60%)`,
                    ["--tx" as string]: `${dx}px`,
                    ["--ty" as string]: `${dy}px`
                  }}
                />
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="app mission-app">

      <header className="header">
        <div>
          <button className="logo-home" onClick={openStartScreen} aria-label="Go to start screen">
            <img src="/logo.svg" alt="The Painful Dollar logo" className="app-logo small" />
          </button>
          <p className="eyebrow">THE PAINFUL DOLLAR</p>
        </div>
        <div className="header-actions">
          <div className="account-menu" ref={accountMenuRef}>
            <button
              className="account-icon"
              aria-label="Open account information"
              onClick={() => setAccountOpen((v) => !v)}
            >
              <span aria-hidden="true">👤</span>
            </button>
            {accountOpen ? (
              <div className="account-panel" role="dialog" aria-label="Account information">
                <p className="account-title">Account</p>
                <p className="account-line"><strong>Email:</strong> {accountEmail}</p>
                <p className="account-line"><strong>Status:</strong> {missionLocked ? "Locked" : hasChargeToday ? "Late" : "Open"}</p>
                <p className="account-line"><strong>Today's charge:</strong> {todaysChargeLabel}</p>
                <p className="account-line"><strong>Goals:</strong> {priorities.length}</p>
                <p className="account-line"><strong>7-day challenge:</strong> {in7DayChallenge ? "On" : "Off"}</p>
                <p className="account-line"><strong>Morning ping:</strong> {formatTimeDisplay(pingTime)} (weekdays)</p>
                <p className="account-line">
                  <strong>Payment setup:</strong>{" "}
                  {billingPlatform === "ios"
                    ? "iPhone (App Store)"
                    : billingPlatform === "android"
                      ? "Android (Google Play)"
                      : billingPlatform === "web_test"
                        ? "Web test mode"
                        : "Not set"}
                </p>
                <p className="account-line"><strong>7-day progress:</strong> {challengeStreak}/7</p>
                <p className="account-line"><strong>Dollars back earned:</strong> ${challengeRewards}</p>
                <p className="account-line"><strong>Days tracked:</strong> {historyEntries.length}</p>
                <button
                  className="secondary account-signout"
                  onClick={() => { setAccountOpen(false); setScreen("history"); }}
                >
                  View History
                </button>
                <button className="secondary account-signout" onClick={signOut}>Sign out</button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <section className={`accountability-strip ${riskClass}`} aria-live="polite">
        <section className="fee-alert">
          <strong>{missionLocked ? (chargeAppliedForToday ? "The painful dollar has been charged." : "No charge locked in.") : expired ? "The painful dollar has been charged." : "Dollar alert."}</strong>
          <span>{chargeMessage}</span>
        </section>

        <section className="strip-metrics">
          <div className="strip-metric">
            <p>Time left</p>
            <strong>{countdownLabel(remainingSeconds)}</strong>
          </div>
          <div className="strip-divider" aria-hidden="true" />
          <div className="strip-metric">
            <p>Charge</p>
            <strong>{todaysChargeLabel}</strong>
          </div>
        </section>
      </section>

      <main className="layout">
        <section className="chat">
          <div className="chat-messages" role="log" aria-live="polite">
            {messages.map((m) => (
              <div key={m.id} className={`row ${m.role}`}>
                {m.role !== "you" ? (
                  <span className={`sender-icon ${m.role}`} aria-label={senderLabel(m.role)} title={senderLabel(m.role)}>
                    {senderIcon(m.role)}
                  </span>
                ) : null}
                <div className={`bubble ${m.role}`}>
                  <p>{m.text}</p>
                  <time>{m.ts}</time>
                </div>
                {m.role === "you" ? (
                  <span className={`sender-icon ${m.role}`} aria-label={senderLabel(m.role)} title={senderLabel(m.role)}>
                    {senderIcon(m.role)}
                  </span>
                ) : null}
              </div>
            ))}

            {activeYesterdayItem ? (
              <div className="row friend">
                <span className="sender-icon friend" aria-label="Coach" title="Coach">P</span>
                <div className="bubble friend">
                  <p>
                    Did you finish your {ordinalWord(nextYesterdayIndex)} goal
                    {reviewSourceText !== "yesterday" ? ` from ${reviewSourceText}` : ""} which was "{activeYesterdayItem.title}"?
                  </p>
                  <div className="status-row">
                    {(["done", "partial", "missed"] as Array<Exclude<YesterdayStatus, "unanswered">>).map((status) => (
                      <button
                        key={status}
                        className="chip ghost"
                        onClick={() => updateYesterdayStatus(activeYesterdayItem.id, status)}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {firstPriorityActions ? (
              <div className="row friend">
                <span className="sender-icon friend" aria-label="Coach" title="Coach">P</span>
                <div className="bubble friend">
                  <p>{firstPriorityActions.prompt}</p>
                  <div className="status-row">
                    <button className="chip ghost" onClick={() => chooseRefinePriority(firstPriorityActions.priorityId)}>
                      Refine goal
                    </button>
                    <button className="chip active" onClick={chooseAddNextPriority}>
                      Add next goal
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {pendingPriorityDraft ? (
              <div className="row friend">
                <span className="sender-icon friend" aria-label="Coach" title="Coach">P</span>
                <div className="bubble friend">
                  <p>Add this goal: "{pendingPriorityDraft.title}"?</p>
                  <div className="status-row">
                    <button className="chip active" onClick={() => void confirmPendingPriority()}>
                      Confirm add
                    </button>
                    <button className="chip ghost" onClick={changePendingPriority}>
                      Change it
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {postLockTimePromptOpen ? (
              <div className="row friend">
                <span className="sender-icon friend" aria-label="Coach" title="Coach">P</span>
                <div className="bubble friend">
                  <p>
                    I’ll check in tomorrow at {formatTimeDisplay(pingTime)}. Keep this time or change it for tomorrow?
                  </p>
                  <div className="status-row">
                    <button className="chip ghost" onClick={keepNextCheckInTime}>
                      Keep time
                    </button>
                    <button className="chip ghost" onClick={changeNextCheckInTime}>
                      Change time
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            <div ref={chatBottomRef} />
          </div>

          <div className="composer">
            {missionLocked ? (
              <div className="composer-actions">
                <button className="secondary" onClick={reworkTodaysPriorities}>
                  Rework todays goals
                </button>
              </div>
            ) : (
              <>
                <input
                  ref={composerInputRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void addPriority();
                    }
                  }}
                  placeholder={
                    !canSetTodayPriorities
                      ? "Finish yesterday check-in first"
                      : awaitingCorrectionInput
                        ? "Enter corrected goal"
                        : pendingPriorityDraft
                          ? "Type a revision or confirm below"
                          : "What will you do today?"
                  }
                  disabled={!canSetTodayPriorities}
                />
                <div className="composer-actions">
                  <button className="primary" onClick={() => void addPriority()} disabled={!canSetTodayPriorities}>Add Goal</button>
                  {priorities.length > 0 ? (
                    <button className="secondary" onClick={() => void lockDay()} disabled={!canSetTodayPriorities}>Lock Day</button>
                  ) : null}
                </div>
              </>
            )}
          </div>

        </section>

      </main>

      <section className="today-board-dock">
        <button className="today-board-dock-btn" onClick={() => setLockedBoardOpen(true)}>
          <span className="eyebrow today-board-dock-label">TODAY BOARD</span>
          <small>See today's goals · Check your 7-day challenge · Tap to open</small>
        </button>
      </section>

        {nudgePickerOpen ? (
          <div className="share-sheet-backdrop" role="dialog" aria-modal="true" aria-label="Choose nudge app">
            <div className="share-sheet">
              <h3>Send Nudge</h3>
              <p className="muted">Choose where to nudge your squad.</p>
              <div className="share-sheet-actions">
                <button className="primary" onClick={() => { void nudgeViaPlatform("snapchat"); setNudgePickerOpen(false); }}>
                  Snapchat
                </button>
                <button className="primary" onClick={() => { void nudgeViaPlatform("instagram"); setNudgePickerOpen(false); }}>
                  Instagram
                </button>
                <button className="tertiary" onClick={() => { void nudgeViaShareSheet(); setNudgePickerOpen(false); }}>
                  More apps
                </button>
                <button className="ghost" onClick={() => setNudgePickerOpen(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {lockedBoardOpen ? (
        <div className="today-board-sheet-backdrop" onClick={() => setLockedBoardOpen(false)}>
          <section
            className="today-board-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Today board"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="today-board-sheet-head">
              <div>
                <p className="eyebrow">TODAY BOARD</p>
                <h3>Locked Goals</h3>
              </div>
              <button className="secondary today-board-close" onClick={() => setLockedBoardOpen(false)}>
                Close
              </button>
            </div>
            <div className="today-board-sheet-list">
              {priorities.length === 0 ? (
                <p className="muted">No goals set yet.</p>
              ) : (
                priorities.map((p, index) => (
                  <article key={p.id} className="priority-item">
                    <h4>{index + 1}. {p.title}</h4>
                    <div className="status-row">
                      <button
                        className={p.status === "done" ? "tick-btn done" : "tick-btn"}
                        onClick={(e) => quickTickPriority(p.id, e)}
                        aria-label={p.status === "done" ? "Mark as pending" : "Mark as done"}
                      >
                      <span className="tick-glyph" aria-hidden="true" />
                    </button>
                      <span className="status-pill">{p.status}</span>
                    </div>
                  </article>
                ))
              )}
            </div>
            <section className="today-board-challenge">
              <section className={showRewardFirework ? "challenge-rainbow-card reward" : streakAtRisk ? "challenge-rainbow-card danger" : "challenge-rainbow-card"}>
                <div className="challenge-title-row">
                  <p>Seven-day challenge</p>
                  <strong>{challengeVisualDays}/7</strong>
                </div>
                <div className="challenge-rainbow-track" aria-label="Seven-day challenge progress">
                  <div className="challenge-rainbow-fill" style={{ width: `${challengeProgress}%` }} />
                </div>
                {showRewardFirework ? (
                  <div className="challenge-firework" aria-hidden="true">
                    <div className="bloom-grid" />
                    <div className="bloom-haze" />
                    <div className="bloom-spray">
                      {Array.from({ length: 42 }).map((_, i) => {
                        const left = 6 + (i % 14) * 5.2;
                        const row = Math.floor(i / 14);
                        const hueBase = row === 0 ? 24 : row === 1 ? 62 : 122;
                        const hue = hueBase + (i % 14) * (row === 2 ? 3 : 2);
                        const size = 3 + (i % 4);
                        const delay = i * 42;
                        const duration = 1200 + (i % 8) * 110;
                        return (
                          <span
                            key={i}
                            className="bloom-dot"
                            style={{
                              left: `${left}%`,
                              width: `${size}px`,
                              height: `${size}px`,
                              animationDelay: `${delay}ms`,
                              animationDuration: `${duration}ms`,
                              background: `hsl(${hue} 92% 60%)`
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                <p className="muted">
                  {showRewardFirework
                    ? "Boom. 7-day streak complete. You got $1 back."
                    : streakAtRisk
                      ? "No goals today. Streak at risk."
                      : "Nice. Your streak is safe today."}
                </p>
              </section>
            </section>
            <section className="today-board-viral">
              <p className="muted">Squad Pulse</p>
              <strong>{squadCompletions} friends locked today</strong>
              <div className="squad-actions">
                <button className="primary" onClick={nudgeSquad}>Nudge Squad</button>
                <button className="secondary" onClick={shareLockWin}>Share Lock Win</button>
                <button className="tertiary" onClick={() => shareLockViaPlatform("snapchat")}>Share on Snapchat</button>
                <button className="tertiary" onClick={() => shareLockViaPlatform("instagram")}>Share on Instagram</button>
              </div>
            </section>
          </section>
        </div>
      ) : null}

      <section className="test-toolbar test-toolbar-external">
        <p>
          Test tools. Mode: <strong>{testDaysMode ? "On" : "Off"}</strong>
          {testDaysMode ? <> · Date: <strong>{today}</strong></> : null}
          {" · "}Claude Version
        </p>
        <div className="test-toolbar-actions">
          {testDaysMode ? (
            <>
              <button className="secondary" onClick={() => shiftTestDay(-1)}>Previous day</button>
              <button className="secondary" onClick={() => shiftTestDay(1)}>Next day</button>
              <button className="secondary" onClick={resetTestDayToToday}>Reset to real today</button>
              <button className="primary" onClick={beginMission}>Start this day</button>
              <button className="tertiary" onClick={simulateWindowMissed}>Simulate window missed</button>
              <button className="tertiary" onClick={simulateStreakReached}>Simulate 7-day reward</button>
              <button className="tertiary" onClick={resetAsNewUser}>Start fresh (new user)</button>
              <button className="secondary" onClick={disableTestMode}>Turn test mode off</button>
            </>
          ) : (
            <button className="primary" onClick={enableTestMode}>Turn test mode on</button>
          )}
        </div>
      </section>
    </>
  );
}

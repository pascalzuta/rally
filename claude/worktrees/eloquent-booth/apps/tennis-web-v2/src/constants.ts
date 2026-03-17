export const API_BASE = "/v1";
export const TOKEN_KEY = "rally-v2-token";

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const LEVEL_OPTIONS = [
  { value: "beginner", label: "Beginner (NTRP 3.0)", ntrp: 3.0 },
  { value: "intermediate", label: "Intermediate (NTRP 3.5)", ntrp: 3.5 },
  { value: "advanced", label: "Advanced (NTRP 4.0)", ntrp: 4.0 },
] as const;

export const TAB_CONFIG = [
  { id: "home" as const, label: "Home", icon: "\u{1F3E0}" },
  { id: "tourney" as const, label: "Tourney", icon: "\u{1F3C6}" },
  { id: "activity" as const, label: "Activity", icon: "\u{1F4C5}" },
  { id: "profile" as const, label: "Profile", icon: "\u{1F464}" },
] as const;

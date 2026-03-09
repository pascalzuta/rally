export const TOKEN_KEY = "rally-v3-token";

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const LEVEL_OPTIONS = [
  { value: "beginner", label: "Beginner (NTRP 3.0)", ntrp: 3.0 },
  { value: "intermediate", label: "Intermediate (NTRP 3.5)", ntrp: 3.5 },
  { value: "advanced", label: "Advanced (NTRP 4.0)", ntrp: 4.0 },
] as const;

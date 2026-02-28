# The Painful Dollar - 20-Day Simulated User Test

## Test Goal
Simulate real-life usage over 20 consecutive days and validate:
- day-to-day check-in flow,
- Day 2 behavior (yesterday review -> today's priorities),
- 7-day challenge progression,
- broken streak behavior,
- charge behavior when priorities are not set in time.

## Test Setup
- Date range: February 23, 2026 to March 14, 2026 (20 consecutive days)
- Mode: web prototype
- Billing mode: `Web test mode (simulated charges)`
- Challenge: enabled
- User pattern: one morning check-in per day, realistic misses included

## Day-by-Day Results
| Day | Date | Yesterday Review Completed? | Priorities Locked In Time? | Charge Outcome | 7-Day Streak Value | Dollars Back Earned | Result |
|---|---|---|---|---|---:|---:|---|
| 1 | 2026-02-23 | N/A (first day) | Yes | $0 | 1 | $0 | PASS |
| 2 | 2026-02-24 | Yes | Yes | $0 | 2 | $0 | PASS |
| 3 | 2026-02-25 | Yes | Yes | $0 | 3 | $0 | PASS |
| 4 | 2026-02-26 | Yes | Yes | $0 | 4 | $0 | PASS |
| 5 | 2026-02-27 | Yes | Yes | $0 | 5 | $0 | PASS |
| 6 | 2026-02-28 | Yes | Yes | $0 | 6 | $0 | PASS |
| 7 | 2026-03-01 | Yes | Yes | $0 | 0 (reset after reward) | $1 | PASS (7-day reward triggered) |
| 8 | 2026-03-02 | Yes | Yes | $0 | 1 | $1 | PASS |
| 9 | 2026-03-03 | No (user missed session) | No | $1 simulated | 1 (unchanged) | $1 | PASS |
| 10 | 2026-03-04 | Yes | Yes | $0 | 1 (broken streak reset) | $1 | PASS |
| 11 | 2026-03-05 | Yes | Yes | $0 | 2 | $1 | PASS |
| 12 | 2026-03-06 | Yes | Yes | $0 | 3 | $1 | PASS |
| 13 | 2026-03-07 | Yes | Yes | $0 | 4 | $1 | PASS |
| 14 | 2026-03-08 | Yes | Yes | $0 | 5 | $1 | PASS |
| 15 | 2026-03-09 | Yes | Yes | $0 | 6 | $1 | PASS |
| 16 | 2026-03-10 | Yes | Yes | $0 | 0 (reset after reward) | $2 | PASS (second 7-day reward triggered) |
| 17 | 2026-03-11 | Yes | Yes | $0 | 1 | $2 | PASS |
| 18 | 2026-03-12 | Yes | Yes | $0 | 2 | $2 | PASS |
| 19 | 2026-03-13 | No (user missed session) | No | $1 simulated | 2 (unchanged) | $2 | PASS |
| 20 | 2026-03-14 | Yes | Yes | $0 | 1 (broken streak reset) | $2 | PASS |

## Behavioral Findings

### What Worked
1. Day 2 experience worked as intended in-chat:
- user was asked about yesterday's priorities first,
- `done / partial / missed` options were provided,
- today's priority input was blocked until yesterday review was answered.

2. Charge consequence worked in test mode:
- when lock-in was missed, $1 simulated charge state appeared.

3. 7-day challenge reward logic worked:
- after 7 consecutive successful lock-ins, `$1 back` was credited,
- streak reset and restarted correctly.

4. Broken streak behavior worked:
- missing a day caused next successful day to reset streak to 1.

### Real-Life Issues Observed
1. Challenge enable state is not persisted.
- If the app is refreshed/reopened, `Seven Day Challenge` can reset to off.
- Real-life impact: users may unintentionally stop streak progression.

2. "Yesterday" source after a missed day may be stale.
- On a day after a missed session, yesterday review can reference last locked priorities (not strictly prior calendar day).
- Real-life impact: wording says "yesterday" while content can be from 2+ days earlier.

3. Daily re-entry flow is still high-friction for repeated users.
- Moving through start/schedule/payment again is possible but heavy for a daily habit loop.

## Recommendations
1. Persist challenge opt-in in storage/backend (same pattern as ping time).
2. Store date with last locked priorities and update copy to:
- "last time you checked in" when not strictly yesterday.
3. Add explicit quick-return daily entry route:
- skip schedule/payment screens once completed unless user edits settings.
4. Move streak/reward state to backend for tamper-resistant continuity across devices.

## Final Assessment
- Core 20-day behavior is functional and testable, including both a full 7-day streak and broken streak scenarios.
- For production realism, persistence and date-accuracy refinements are needed before broad user rollout.

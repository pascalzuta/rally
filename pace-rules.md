# Tournament Pace Rules & Notification Framework

> Keeps every tournament moving toward completion within ~30 days — even when
> individual players go silent — while giving busy recreational players fair
> leeway through multiple reminders and gentle auto-actions before any forfeit.

---

## 1. Tournament Timeline

| Phase | Duration | Calendar Days | What Happens |
|-------|----------|---------------|-------------|
| Registration | Up to 7 days | 0 – 7 | Players join. Auto-activates at 8 players or after 7 days with 4+. |
| Round-Robin | 18 days | 7 – 25 | All 28 matches scheduled, played, and scored. Deadline enforcement active. |
| Finals | 5 days | 25 – 30 | Championship (#1 vs #2) and 3rd-place (#3 vs #4). |
| Hard Deadline | Day 32 | — | Absolute backstop. Any remaining match auto-forfeited. Tournament completes. |

If round-robin finishes early, finals begin immediately.

---

## 2. Match Deadline Chain

Every match has per-status deadlines. The clock resets when the match enters a new
status. The system always tries the **gentlest auto-action first** before forfeits.

### 2a. Pending → 7 days to start scheduling

Applies to matches the auto-scheduler couldn't resolve (Tier 2 flex, Tier 3 propose).

| Day | Event |
|-----|-------|
| 0 | Match created at activation. Both players notified. |
| 3 | **Reminder 1** — friendly nudge. |
| 5 | **Reminder 2** — "2 days left to schedule your match." |
| 6 | **Final warning** — "Match will be auto-resolved tomorrow." |
| **7** | **Auto-action** *(not a forfeit)*: |
| | • Tier 2 → system auto-accepts the flex suggestion (`nearMiss.flexedWindow`). Match → `scheduled`. |
| | • Tier 3 → system auto-generates 3 proposals from challenger's availability. Match → `scheduling`, fresh 5-day clock for opponent. |

### 2b. Scheduling → 5 days to accept a proposal

Proposals exist. The opponent must pick one.

| Day | Event |
|-----|-------|
| 0 | Proposals created. Opponent notified. |
| 2 | **Reminder 1** — "[Name] proposed 3 times. Pick one!" |
| 4 | **Reminder 2** — "Auto-scheduled to earliest time tomorrow." |
| **5** | **Auto-action:** accept earliest proposal on the opponent's behalf. Match → `scheduled`. |

### 2c. Scheduled → 3 days after match date to submit scores

| Day | Event |
|-----|-------|
| Match day | "Your match is today! Good luck 🎾" |
| +1 | **Reminder 1** — "How'd it go? Submit your score." |
| +2 | **Reminder 2** — "Score needed by tomorrow." |
| **+3** | **Auto-action:** one player submitted → auto-confirm that score. Neither submitted → mutual no-show forfeit. |

**Cap:** If `scheduledAt` is > 14 days out, score deadline is capped at 14 days from scheduling.

### 2d. Awaiting Confirmation → 48 hours *(existing)*

| Hour | Event |
|------|-------|
| 0 | Score submitted. Opponent notified. |
| 24 | **Reminder** — "Auto-confirms in 24 hours." |
| **48** | **Auto-confirm.** |

---

## 3. Notification Schedule

### 3a. Channels

| Channel | Usage |
|---------|-------|
| **In-app badge** | Always. Red dot on Tourney tab for pending actions. |
| **Email** | Primary async channel. All reminders and confirmations. |
| **Push** | Future enhancement. |

### 3b. Full Notification Catalog

#### Tournament Lifecycle

| ID | Trigger | Who | When | Subject |
|----|---------|-----|------|---------|
| N-01 | Tournament activates | All 8 players | Immediate | "Your [County] tournament has started!" |
| N-02 | 7 days left in round-robin | Players w/ incomplete matches | Day 11 | "One week left in round-robin" |
| N-03 | Finals created | Top 4 + spectators | Immediate | "You made the finals!" |
| N-04 | Tournament completes | All 8 players | Immediate | "Tournament complete! Standings inside" |

#### Scheduling — Tier 2 (Flex)

| ID | Trigger | Who | When | Subject |
|----|---------|-----|------|---------|
| N-10 | Tier 2 match created | Both | With N-01 | "Can you flex 30 min for your match vs [Name]?" |
| N-11 | Reminder 1 | Both | Day 3 | "Reminder: flex scheduling needed" |
| N-12 | Reminder 2 | Both | Day 5 | "2 days left to schedule" |
| N-13 | Final warning | Both | Day 6 | "Last chance — auto-scheduled tomorrow" |
| N-14 | Auto-flexed | Both | Day 7 | "Match auto-scheduled to keep things moving" |

#### Scheduling — Tier 3 (Propose & Pick)

| ID | Trigger | Who | When | Subject |
|----|---------|-----|------|---------|
| N-20 | Tier 3 match created | Challenger | With N-01 | "Propose times for your match vs [Name]" |
| N-21 | Propose reminder | Challenger | Day 3 | "Still need to propose times" |
| N-22 | Propose final warning | Challenger | Day 6 | "System will auto-propose tomorrow" |
| N-23 | Auto-proposed | Both | Day 7 | "We proposed times — [Name] will pick" |
| N-24 | Proposals received | Opponent | Immediate | "[Name] proposed 3 times — pick one!" |
| N-25 | Pick reminder | Opponent | Day 2 | "Don't forget to pick a time" |
| N-26 | Pick final warning | Opponent | Day 4 | "Auto-scheduled to earliest time tomorrow" |
| N-27 | Auto-accepted | Both | Day 5 | "Match confirmed for [Date/Time]" |

#### Match Confirmed

| ID | Trigger | Who | When | Subject |
|----|---------|-----|------|---------|
| N-30 | Match scheduled by player | Both | Immediate | "Match confirmed: [Date] vs [Name]" |

#### Scores

| ID | Trigger | Who | When | Subject |
|----|---------|-----|------|---------|
| N-40 | Match date passed | Both | +1 day | "How'd it go? Submit your score" |
| N-41 | Score still missing | Both | +2 days | "Score needed by tomorrow" |
| N-42 | Score submitted | Opponent | Immediate | "[Name] reported the score — confirm?" |
| N-43 | Confirm reminder | Opponent | +24h | "Auto-confirms in 24 hours" |
| N-44 | Score confirmed | Both | Immediate | "Match result confirmed ✓" |

#### Forfeits

| ID | Trigger | Who | When | Subject |
|----|---------|-----|------|---------|
| N-50 | Single forfeit | Both | Immediate | *(see Section 4e for per-player wording)* |
| N-51 | Mutual no-show | Both | Immediate | "Match recorded as mutual no-show" |

### 3c. Batching & Quiet Hours

| Rule | Detail |
|------|--------|
| Batch daily | 3+ pending actions → one summary email, not separate emails |
| Quiet hours | Queue emails outside 9 AM – 8 PM local time for next morning |
| Cooldown | Max 1 reminder email per player per 6 hours (transactional exempt) |
| De-duplicate | Don't re-notify same match same day unless status changed |

---

## 4. Forfeit Rules

### 4a. Types

| Type | Trigger | Score Recorded | Standings |
|------|---------|---------------|-----------|
| **Single no-show** | One player responsive, other silent | Responsive wins **W/O 6-0 6-0** | Win / Loss |
| **Mutual no-show** | Neither player acted | **No winner** | No W/L impact |

### 4b. Determining Fault

A player is "responsive" if they took **any** action on the match: proposed times,
accepted, flex-accepted, submitted score, or confirmed score.

| Scenario | Outcome |
|----------|---------|
| Player A responsive, Player B silent | B forfeits, A wins W/O |
| Both silent | Mutual no-show, no winner |
| Both responsive but neither submitted score | Mutual no-show (both forgot, not intentional) |

### 4c. Score Recording

**Single no-show:**
```
winnerId:      <responsive_player>
sets:          [{ aGames: 6, bGames: 0 }, { aGames: 6, bGames: 0 }]
reportedBy:    "system"
confirmedBy:   "auto-forfeit"
forfeit:       true
forfeitReason: "Opponent did not respond after multiple reminders"
```

**Mutual no-show:**
```
winnerId:      null
sets:          []
reportedBy:    "system"
confirmedBy:   "auto-forfeit"
forfeit:       true
forfeitReason: "Neither player responded"
```

### 4d. Rating Impact

| | ELO Rating | Tournament Standings |
|---|-----------|---------------------|
| Forfeit | **Not affected** — walkovers don't reflect skill | **Counted** — shows up deserve credit |
| Real match | Updated normally | Counted normally |

### 4e. Notification Tone

**To the player who was forfeited (single no-show):**
> Your match against [Name] has been recorded as a forfeit because no response
> was received after multiple reminders. [Name] was awarded the win.
> We understand life gets busy — you can set a vacation hold in future tournaments.

**To the responsive player (single no-show):**
> Your match against [Name] has been recorded as a forfeit win for you.
> [Name] did not respond to scheduling requests. Sorry for the wait.

**Both players (mutual no-show):**
> Your match against [Name] has been recorded as a mutual no-show.
> Neither player responded. This match won't affect your win/loss record.

---

## 5. Grace Mechanisms

### 5a. Multiple Reminders (Core Fairness)

No single missed notification results in a penalty.

| Status | Reminders Before Auto-Action | Warning Time |
|--------|------------------------------|-------------|
| Pending (7 days) | 4 notifications | 6 days |
| Scheduling (5 days) | 3 notifications | 4 days |
| Score (3 days) | 3 notifications | 2 days |
| Confirmation (48h) | 2 notifications | 24 hours |

### 5b. Vacation Hold

Players can flag **"I'm away this week"** in their profile.

| Setting | Detail |
|---------|--------|
| Duration | 1–7 days, set in advance |
| Effect | All match deadlines pause. Opponents notified. |
| Limit | 1 hold per tournament, 7 days max |
| Anti-abuse | After hold expires, remaining time resumes (not a full reset) |

### 5c. Opponent-Initiated Extension

Before auto-forfeit, the responsive player is asked:

> [Name] hasn't responded. Would you like to:
> **A)** Record a forfeit win, or
> **B)** Grant a 3-day extension (in case they're busy)?

The extension can be granted **once per match**. Many players will prefer to wait
for a real match.

### 5d. First-Tournament Grace

A player's very first Rally tournament gets **+2 days on all deadlines**.
New users shouldn't be penalized while learning the app.

### 5e. Late Action Window

If a player acts after the deadline but before the system's next 30-second tick
processes the auto-action, their action takes precedence. No harm in squeaking in
at the last second.

---

## 6. Hard Deadline (Day 32)

The absolute backstop that guarantees completion.

| Situation at Day 32 | Resolution |
|---------------------|-----------|
| Round-robin incomplete | Forfeit remaining matches, skip finals, rank by round-robin |
| In finals | Forfeit unplayed finals matches, then complete |
| All done | N/A — tournament already completed |

**Notification:** "The [Tournament] has reached its completion deadline. [X] remaining
matches resolved. Final standings are now locked."

### Finals-Specific Timeline (5 days)

| Day | Event |
|-----|-------|
| 0 | Finals created. Top 4 notified. |
| 2 | Reminder if not yet scheduled. |
| 3 | "Auto-scheduled tomorrow" warning. |
| 4 | Auto-schedule (or auto-forfeit if impossible). |
| 5 | Score deadline. Auto-forfeit if no score. |

---

## 7. Example: Ghost Player Scenario

How the framework resolves the exact problem the simulation exposed.

```
Day 0    Tournament activates. Player #6 is a ghost (never responds).
         7 matches: 2 auto-scheduled (Tier 1), 3 Tier 2, 2 Tier 3.
         N-01 sent. Player #6 ignores everything.

Day 3    Reminder for Tier 2/3 matches. Ignored.
Day 5    "2 days left." Ignored.
Day 6    "Last chance." Ignored.
Day 7    AUTO: 3 Tier 2 matches auto-flex-scheduled.
              2 Tier 3 matches auto-proposed from challenger's availability.

Day 9    Reminder to accept proposals. Ignored.
Day 11   "Auto-scheduled tomorrow." Ignored.
Day 12   AUTO: Earliest proposals accepted. All 7 matches now "scheduled."

Day 13-15  Tier 1 matches hit score deadline. Opponents offered
           extension-or-forfeit choice. Most choose forfeit.
           Player #6: 0-2.

Day 15-18  Remaining 5 matches hit score deadline.
           Same pattern. Player #6: 0-7.

Day 18   All 28 matches done → finals begin.
         Responsive top 4 play normally.
Day 23   Tournament complete. Within 30 days. ✓
```

**Simulation comparison:** Without pace rules, 0 of 18 tournaments completed in
50 days. With this framework, the worst case (1 ghost player) resolves by Day 23.

---

## 8. Configuration Constants

All timing values centralized and tunable:

```
PENDING_DEADLINE_DAYS           7      # Days to start scheduling
SCHEDULING_DEADLINE_DAYS        5      # Days to accept a proposal
SCORE_DEADLINE_DAYS             3      # Days after match to submit score
CONFIRMATION_DEADLINE_HOURS    48      # Hours to confirm score (existing)

ROUND_ROBIN_DAYS               18      # Max days for round-robin phase
FINALS_DAYS                     5      # Max days for finals phase
HARD_DEADLINE_DAYS             32      # Absolute tournament backstop

PENDING_REMINDER_1_DAY          3      # First nudge
PENDING_REMINDER_2_DAY          5      # Second nudge
PENDING_FINAL_WARNING_DAY       6      # Last chance

SCHEDULING_REMINDER_1_DAY       2
SCHEDULING_REMINDER_2_DAY       4

SCORE_REMINDER_1_DAY            1      # Days after match date
SCORE_REMINDER_2_DAY            2

VACATION_HOLD_MAX_DAYS          7
FIRST_TOURNAMENT_GRACE_DAYS     2
EXTENSION_DAYS                  3
MAX_EXTENSIONS_PER_MATCH        1

BATCH_COOLDOWN_HOURS            6
QUIET_HOURS_START              20      # 8 PM
QUIET_HOURS_END                 9      # 9 AM

FORFEIT_WINNER_GAMES            6
FORFEIT_LOSER_GAMES             0
```

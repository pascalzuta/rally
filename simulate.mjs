#!/usr/bin/env node
/**
 * Rally Tournament Simulation
 *
 * Simulates 200 players across 10 counties running through the full
 * tournament lifecycle. Each tick = 30 seconds real time ≈ 1 simulated day.
 * Players respond with varying delays based on personality type.
 *
 * Usage:  node simulate.mjs
 * Requires: Node 18+ (native fetch), server running on localhost:8788
 */

import { writeFileSync, appendFileSync } from "fs";

const API = "http://localhost:8788/v1";
const TICK_MS = 5_000;        // 5 seconds = 1 simulated day (fast mode)
const MAX_TICKS = 50;         // 50 simulated days
const LOG_FILE = "simulation-log.md";

// ─── Reproduce email pattern from seedRich.ts ───────────────────────────────

const FIRST_NAMES = [
  "James","Emma","Jack","Olivia","Ryan","Sophia","Connor","Ava",
  "Dylan","Charlotte","Liam","Grace","Owen","Lily","Ethan","Harper",
  "Carlos","Sofia","Diego","Isabella","Marco","Valentina","Mateo","Camila",
  "Luis","Elena","Andres","Lucia","Javier","Gabriela",
  "Kevin","Michelle","Jason","Cindy","David","Jenny","Brian","Amy",
  "Eric","Lisa","Andrew","Nicole","Steven","Karen",
  "Raj","Priya","Arjun","Ananya","Vikram","Neha","Kiran","Divya",
];

const LAST_NAMES = [
  "Anderson","Mitchell","Thompson","Parker","Collins",
  "Garcia","Rodriguez","Martinez","Hernandez","Lopez",
  "Chen","Wang","Kim","Nguyen","Lee",
  "Patel","Shah","Kumar","Gupta","Singh",
];

const COUNTIES = [
  { county: "Marin County", city: "San Rafael" },
  { county: "San Francisco County", city: "San Francisco" },
  { county: "Sonoma County", city: "Santa Rosa" },
  { county: "Napa County", city: "Napa" },
  { county: "Contra Costa County", city: "Walnut Creek" },
  { county: "Alameda County", city: "Oakland" },
  { county: "San Mateo County", city: "San Mateo" },
  { county: "Santa Clara County", city: "San Jose" },
  { county: "Solano County", city: "Vallejo" },
  { county: "Santa Cruz County", city: "Santa Cruz" },
];

// Player personality types: controls response delay in ticks (simulated days)
const PERSONALITIES = [
  { name: "eager",  weight: 0.20, minDelay: 0, maxDelay: 0 },   // responds same day
  { name: "normal", weight: 0.45, minDelay: 1, maxDelay: 3 },   // 1-3 days
  { name: "slow",   weight: 0.25, minDelay: 3, maxDelay: 7 },   // 3-7 days
  { name: "ghost",  weight: 0.10, minDelay: 8, maxDelay: 20 },  // 8-20 days (may never respond)
];

function pickPersonality() {
  const r = Math.random();
  let cumulative = 0;
  for (const p of PERSONALITIES) {
    cumulative += p.weight;
    if (r <= cumulative) return p;
  }
  return PERSONALITIES[1]; // fallback to normal
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// ─── API helpers ────────────────────────────────────────────────────────────

async function apiPost(path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  try {
    const res = await fetch(`${API}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { _error: true, status: res.status, message: data.error || `HTTP ${res.status}` };
    return data;
  } catch (e) {
    return { _error: true, status: 0, message: e.message };
  }
}

async function apiGet(path, token) {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { _error: true, status: res.status, message: data.error || `HTTP ${res.status}` };
    return data;
  } catch (e) {
    return { _error: true, status: 0, message: e.message };
  }
}

async function apiPut(path, body, token) {
  try {
    const res = await fetch(`${API}${path}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { _error: true, status: res.status, message: data.error || `HTTP ${res.status}` };
    return data;
  } catch (e) {
    return { _error: true, status: 0, message: e.message };
  }
}

// ─── Score generation ───────────────────────────────────────────────────────

function generateRandomScore() {
  const setPatterns = [
    [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [7, 5], [7, 6],
  ];
  const weights =     [0.05,  0.10,  0.20,  0.25,  0.20,  0.12,  0.08];

  function pickSetScore() {
    const r = Math.random();
    let c = 0;
    for (let i = 0; i < setPatterns.length; i++) {
      c += weights[i];
      if (r <= c) return setPatterns[i];
    }
    return setPatterns[3]; // 6-3 default
  }

  // 65% chance of straight-sets win, 35% three sets
  const threeSet = Math.random() < 0.35;
  const sets = [];

  if (threeSet) {
    // Winner loses set 1, wins sets 2 and 3
    const [wGames, lGames] = pickSetScore();
    sets.push({ aGames: lGames, bGames: wGames }); // Loss for "a" (winner)
    const s2 = pickSetScore();
    sets.push({ aGames: s2[0], bGames: s2[1] });
    const s3 = pickSetScore();
    sets.push({ aGames: s3[0], bGames: s3[1] });
  } else {
    const s1 = pickSetScore();
    sets.push({ aGames: s1[0], bGames: s1[1] });
    const s2 = pickSetScore();
    sets.push({ aGames: s2[0], bGames: s2[1] });
  }

  // Add tiebreak data for 7-6 sets
  for (const s of sets) {
    if (s.aGames === 7 && s.bGames === 6) {
      s.tiebreak = { aPoints: 7, bPoints: randomInt(2, 5) };
    } else if (s.aGames === 6 && s.bGames === 7) {
      s.tiebreak = { aPoints: randomInt(2, 5), bPoints: 7 };
    }
  }

  return sets;
}

// ─── Availability generation ────────────────────────────────────────────────

function generateAvailability() {
  const slots = [];
  // Pick 4 unique days
  const allDays = [0, 1, 2, 3, 4, 5, 6];
  const shuffled = allDays.sort(() => Math.random() - 0.5);
  const days = shuffled.slice(0, 4);

  for (const day of days) {
    // Start hour between 8 and 16 (so 2hr slot ends by 18:00)
    const hour = 8 + Math.floor(Math.random() * 9);
    slots.push({
      dayOfWeek: day,
      startTime: `${String(hour).padStart(2, "0")}:00`,
      endTime: `${String(hour + 2).padStart(2, "0")}:00`,
    });
  }
  return slots;
}

// ─── Logging ────────────────────────────────────────────────────────────────

const events = [];
const bugs = [];
const stuckMatches = new Map(); // matchId → { firstSeen, status, details }

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  const line = `[${ts}] ${msg}`;
  console.log(line);
  events.push(line);
}

function logBug(msg, details = {}) {
  const ts = new Date().toISOString().slice(11, 19);
  const line = `[${ts}] BUG: ${msg}`;
  console.log(`\x1b[31m${line}\x1b[0m`);
  bugs.push({ time: ts, message: msg, ...details });
}

// ─── Player state ───────────────────────────────────────────────────────────

const players = new Map(); // email → { token, player, personality, county, pendingActions }

function buildEmailList() {
  const emails = [];
  for (let countyIdx = 0; countyIdx < COUNTIES.length; countyIdx++) {
    const { county } = COUNTIES[countyIdx];
    const countySlug = county.toLowerCase().replace(/\s+/g, "");
    for (let i = 0; i < 20; i++) {
      const firstName = FIRST_NAMES[(i + countyIdx * 5) % FIRST_NAMES.length];
      const lastName = LAST_NAMES[i % LAST_NAMES.length];
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${countySlug}@rally.test`;
      emails.push({ email, county, playerIndex: i, countyIdx });
    }
  }
  return emails;
}

// ─── Match processing ───────────────────────────────────────────────────────

async function processMatch(player, match, tournamentId, tick) {
  const { token } = player;
  const playerId = player.player.id;

  // Determine player sides — API uses challengerId/opponentId
  const homeId = match.challengerId || match.homePlayerId;
  const awayId = match.opponentId || match.awayPlayerId;
  const isHome = homeId === playerId;
  const opponentId = isHome ? awayId : homeId;

  const matchKey = `${match.id}`;
  const opponentName = opponentId?.slice(0, 8) || "???";

  switch (match.status) {
    case "pending": {
      // Needs scheduling action
      if (match.schedulingTier === 1) {
        // Should have been auto-scheduled — this is a bug
        logBug(`Match ${matchKey} is Tier 1 but still pending`, { matchId: match.id, tick });
        break;
      }

      if (match.schedulingTier === 2 && match.nearMiss) {
        // Flex accept — either player can do it
        const nm = match.nearMiss;
        const datetime = `${nm.date}T${nm.flexedWindow?.startTime || nm.suggestedTime || "09:00"}`;
        const label = `Flex schedule`;
        const r = await apiPost(`/matches/${match.id}/flex-accept`, { datetime, label }, token);
        if (r._error) {
          logBug(`${player.player.name} failed flex-accept: ${r.message}`, { matchId: match.id });
        } else {
          log(`[Day ${tick}] ${player.player.name} flex-accepted match vs ${opponentName}`);
        }
        break;
      }

      // Tier 3 or unassigned — try to get scheduling info first
      const info = await apiGet(`/matches/${match.id}/scheduling-info`, token);
      if (info._error) {
        logBug(`${player.player.name} failed scheduling-info: ${info.message}`, { matchId: match.id });
        break;
      }

      if (info.overlaps && info.overlaps.length > 0) {
        // Has overlaps — schedule directly
        const opt = info.overlaps[0];
        const r = await apiPost(`/matches/${match.id}/schedule`, { datetime: opt.datetime, label: opt.label }, token);
        if (r._error) {
          logBug(`${player.player.name} failed to schedule: ${r.message}`, { matchId: match.id });
        } else {
          log(`[Day ${tick}] ${player.player.name} scheduled match (Tier 1 manual)`);
        }
      } else {
        // No overlaps — propose times
        const mySlots = info.mySlots || [];
        if (mySlots.length === 0) {
          logBug(`${player.player.name} has no availability slots for proposing`, { matchId: match.id });
          break;
        }

        // Generate proposal times from availability
        const now = new Date();
        const times = [];
        for (let d = 1; d <= 14 && times.length < 3; d++) {
          const date = new Date(now.getTime() + d * 86400000);
          for (const slot of mySlots) {
            if (date.getDay() === slot.dayOfWeek && times.length < 3) {
              const dateStr = date.toISOString().split("T")[0];
              times.push({
                datetime: `${dateStr}T${slot.startTime}`,
                label: `${dateStr} at ${slot.startTime}`,
              });
            }
          }
        }

        if (times.length > 0) {
          const r = await apiPost(`/matches/${match.id}/propose-times`, { times }, token);
          if (r._error) {
            logBug(`${player.player.name} failed to propose times: ${r.message}`, { matchId: match.id });
          } else {
            log(`[Day ${tick}] ${player.player.name} proposed ${times.length} times for match vs ${opponentName}`);
          }
        } else {
          logBug(`${player.player.name} could not generate any proposal times`, { matchId: match.id });
        }
      }
      break;
    }

    case "scheduling": {
      // Has proposals — opponent needs to accept one
      const proposals = match.proposals || [];
      if (proposals.length === 0) {
        logBug(`Match ${matchKey} in 'scheduling' but no proposals`, { matchId: match.id });
        break;
      }

      // Check if any proposal is NOT from us (so we can accept it)
      const otherProposals = proposals.filter(p => p.proposedBy !== playerId);
      if (otherProposals.length > 0) {
        const proposal = otherProposals[0];
        const r = await apiPost(`/matches/${match.id}/accept-time`, { proposalId: proposal.id }, token);
        if (r._error) {
          if (!r.message.includes("already")) {
            logBug(`${player.player.name} failed to accept proposal: ${r.message}`, { matchId: match.id });
          }
        } else {
          log(`[Day ${tick}] ${player.player.name} accepted proposal for match vs ${opponentName}`);
        }
      }
      // If all proposals are from us, we wait for opponent
      break;
    }

    case "scheduled": {
      // Check if score needs action
      if (match.result) break; // Already completed

      const pending = match.pendingResult || (match.pendingResults ? Object.values(match.pendingResults).find(r => r.matchId === match.id) : null);

      if (pending && pending.reportedBy !== playerId) {
        // Opponent reported — I need to confirm
        const r = await apiPost(
          `/tournaments/${tournamentId}/matches/${match.id}/score`,
          { winnerId: pending.winnerId, sets: pending.sets },
          token,
        );
        if (r._error) {
          logBug(`${player.player.name} failed to confirm score: ${r.message}`, { matchId: match.id });
        } else {
          log(`[Day ${tick}] ${player.player.name} confirmed score (${r.status || "ok"}) vs ${opponentName}`);
        }
      } else if (!pending) {
        // No one reported yet — I'll report
        // Decide winner: slight home advantage + skill-based
        const myRating = player.player.rating || 1000;
        const winProb = 0.5; // Simplified — 50/50
        const winnerId = Math.random() < winProb ? playerId : opponentId;
        const sets = generateRandomScore();

        const r = await apiPost(
          `/tournaments/${tournamentId}/matches/${match.id}/score`,
          { winnerId, sets },
          token,
        );
        if (r._error) {
          logBug(`${player.player.name} failed to submit score: ${r.message}`, { matchId: match.id });
        } else {
          log(`[Day ${tick}] ${player.player.name} reported score (${r.status || "ok"}) vs ${opponentName}`);
        }
      }
      // If I already reported, wait for opponent to confirm
      break;
    }

    case "completed":
    case "cancelled":
      // Nothing to do
      break;

    default:
      logBug(`Unknown match status: ${match.status}`, { matchId: match.id, status: match.status });
  }
}

// ─── Tournament stats ───────────────────────────────────────────────────────

const tournamentStats = new Map(); // tournamentId → { status, matchCounts, ... }

async function collectTournamentStats(token, tournamentId, tick) {
  const tData = await apiGet(`/tournaments/${tournamentId}`, token);
  if (tData._error) return null;

  const tournament = tData.tournament;
  const mData = await apiGet(`/tournaments/${tournamentId}/matches`, token);
  const matches = mData._error ? [] : (mData.matches || []);

  const counts = { pending: 0, scheduling: 0, scheduled: 0, completed: 0, cancelled: 0 };
  for (const m of matches) {
    counts[m.status] = (counts[m.status] || 0) + 1;
  }

  const stats = {
    name: tournament.name,
    status: tournament.status,
    playerCount: tournament.playerIds?.length || 0,
    totalMatches: matches.length,
    ...counts,
    tick,
  };

  // Track stuck matches
  for (const m of matches) {
    if (m.status === "completed" || m.status === "cancelled") continue;
    const key = m.id;
    if (!stuckMatches.has(key)) {
      stuckMatches.set(key, { firstSeen: tick, status: m.status, lastStatus: m.status, stuckDays: 0 });
    } else {
      const prev = stuckMatches.get(key);
      if (prev.lastStatus === m.status) {
        prev.stuckDays = tick - prev.firstSeen;
      } else {
        prev.firstSeen = tick;
        prev.lastStatus = m.status;
        prev.stuckDays = 0;
      }
    }
  }

  tournamentStats.set(tournamentId, stats);
  return { tournament, matches };
}

// ─── Main simulation ────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║     Rally Tournament Simulation             ║");
  console.log("║     200 players · 10 counties · 50 days     ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // ── Phase 1: Seed ──────────────────────────────────────────
  log("PHASE 1: Seeding 200 players across 10 counties...");
  const seedResult = await apiPost("/debug/seed-rich", {});
  if (seedResult._error) {
    console.error("FATAL: Seed failed:", seedResult.message);
    process.exit(1);
  }
  log(`  Seeded: ${seedResult.players} players, ${seedResult.tournaments} tournaments`);

  // ── Phase 2: Login all players + set availability ──────────
  log("\nPHASE 2: Logging in 200 players and setting availability...");
  const emailList = buildEmailList();
  let loginSuccess = 0;
  let loginFail = 0;

  for (const { email, county, playerIndex, countyIdx } of emailList) {
    const loginResult = await apiPost("/auth/login", { email });
    if (loginResult._error) {
      logBug(`Login failed for ${email}: ${loginResult.message}`);
      loginFail++;
      continue;
    }

    const personality = pickPersonality();
    players.set(email, {
      token: loginResult.accessToken,
      player: loginResult.player,
      personality,
      county,
      playerIndex,
      countyIdx,
      email,
      actionQueue: new Map(), // matchId → tick when they'll respond
    });

    // Set availability: 4 random 2-hour slots between 8am-6pm
    const slots = generateAvailability();
    const availResult = await apiPut("/players/me/availability", { slots }, loginResult.accessToken);
    if (availResult._error) {
      logBug(`Set availability failed for ${email}: ${availResult.message}`);
    }

    loginSuccess++;
  }

  log(`  Logged in: ${loginSuccess} success, ${loginFail} failed`);
  const personalityCounts = [...players.values()].reduce((acc, p) => {
    acc[p.personality.name] = (acc[p.personality.name] || 0) + 1;
    return acc;
  }, {});
  log(`  Personalities: ${Object.entries(personalityCounts).map(([k,v]) => `${k}=${v}`).join(", ")}`);

  // ── Phase 3: Join tournaments ──────────────────────────────
  log("\nPHASE 3: Players joining tournaments...");

  // First, get all tournaments
  const firstPlayer = [...players.values()][0];
  const tournamentsResult = await apiGet("/tournaments", firstPlayer.token);
  if (tournamentsResult._error) {
    console.error("FATAL: Cannot list tournaments:", tournamentsResult.message);
    process.exit(1);
  }

  const tournaments = tournamentsResult.tournaments || [];
  log(`  Found ${tournaments.length} tournaments`);

  // For each county, have the 8th player (index 7) join to activate
  // Then have players 8-19 also join (creating overflow for future tournaments)
  const activatedTournaments = [];

  for (const t of tournaments) {
    if (t.status !== "registration") continue;

    // Find players in this county who aren't already in the tournament
    const countyPlayers = [...players.values()].filter(p => p.county === t.county);
    const notJoined = countyPlayers.filter(p => !t.playerIds.includes(p.player.id));

    let joined = 0;
    for (const p of notJoined) {
      if (t.playerIds.length + joined >= t.maxPlayers) break; // Don't exceed max

      const r = await apiPost(`/tournaments/${t.id}/join`, {}, p.token);
      if (r._error) {
        logBug(`${p.player.name} failed to join tournament ${t.name}: ${r.message}`);
      } else {
        joined++;
        if (r.activated) {
          log(`  ACTIVATED: ${t.name} (${t.playerIds.length + joined} players)`);
          activatedTournaments.push(t.id);

          // Log scheduling result
          if (r.schedulingResult) {
            const sr = r.schedulingResult;
            log(`    Scheduling: ${sr.tier1Auto || 0} auto, ${sr.tier2Flex || 0} flex, ${sr.tier3Propose || 0} propose`);
          }
        }
      }
    }
  }

  log(`  Activated ${activatedTournaments.length} tournaments`);

  // ── Phase 4: Simulation loop ───────────────────────────────
  log(`\nPHASE 4: Starting simulation (${MAX_TICKS} days, 1 day = ${TICK_MS / 1000}s)...\n`);

  for (let tick = 1; tick <= MAX_TICKS; tick++) {
    log(`\n═══ Day ${tick} ═══════════════════════════════════`);

    // Refresh tournament data
    const refreshedTournaments = await apiGet("/tournaments", firstPlayer.token);
    const allTournaments = (refreshedTournaments.tournaments || []).filter(
      t => t.status === "active" || t.status === "finals" || t.status === "completed",
    );

    // Collect stats for each tournament
    for (const t of allTournaments) {
      await collectTournamentStats(firstPlayer.token, t.id, tick);
    }

    // Print tournament summary
    for (const [tid, stats] of tournamentStats) {
      const progress = stats.totalMatches > 0
        ? `${stats.completed}/${stats.totalMatches} completed`
        : "no matches";
      log(`  [${stats.name?.split("–")[1]?.trim() || tid.slice(0,8)}] status=${stats.status} ${progress} (P:${stats.pending} Sch:${stats.scheduling} Sched:${stats.scheduled} Done:${stats.completed})`);
    }

    // Process each player's actions
    let actionsThisTick = 0;
    const playerList = [...players.values()].sort(() => Math.random() - 0.5); // Randomize order

    for (const p of playerList) {
      // Check if this player acts this tick based on personality
      const { minDelay, maxDelay } = p.personality;

      // For each tournament they're in, get matches
      for (const t of allTournaments) {
        if (!t.playerIds?.includes(p.player.id)) continue;

        const matchData = await apiGet(`/tournaments/${t.id}/matches`, p.token);
        if (matchData._error) {
          logBug(`${p.player.name} failed to get matches: ${matchData.message}`);
          continue;
        }

        const matches = matchData.matches || [];
        for (const match of matches) {
          if (match.status === "completed" || match.status === "cancelled") continue;

          // Check if this player is involved
          const homeId = match.challengerId || match.homePlayerId;
          const awayId = match.opponentId || match.awayPlayerId;
          if (homeId !== p.player.id && awayId !== p.player.id) continue;

          // Check response delay
          const matchKey = `${match.id}-${p.player.id}`;
          if (!p.actionQueue.has(matchKey)) {
            // First time seeing this action — schedule response
            const delay = randomInt(minDelay, maxDelay);
            p.actionQueue.set(matchKey, tick + delay);
          }

          const respondAt = p.actionQueue.get(matchKey);
          if (tick < respondAt) continue; // Not ready to respond yet

          // Player is ready to act
          try {
            await processMatch(p, match, t.id, tick);
            actionsThisTick++;
            p.actionQueue.delete(matchKey); // Clear so we don't re-process
          } catch (e) {
            logBug(`${p.player.name} exception processing match: ${e.message}`, { matchId: match.id });
          }
        }
      }
    }

    log(`  Actions this day: ${actionsThisTick}`);

    // Check for stuck matches
    const stuckCount = [...stuckMatches.values()].filter(s => s.stuckDays >= 10).length;
    if (stuckCount > 0) {
      log(`  WARNING: ${stuckCount} matches stuck for 10+ days`);
    }

    // Check if all tournaments are completed
    const allCompleted = allTournaments.length > 0 && allTournaments.every(t => t.status === "completed");
    if (allCompleted) {
      log(`\n🏆 ALL TOURNAMENTS COMPLETED on Day ${tick}!`);
      break;
    }

    // Also check for finals advancement
    for (const t of allTournaments) {
      if (t.status === "active") {
        const stats = tournamentStats.get(t.id);
        if (stats && stats.pending === 0 && stats.scheduling === 0 && stats.scheduled === 0 && stats.completed > 0) {
          log(`  Tournament ${t.name?.split("–")[1]?.trim()} may be ready for finals (all round-robin done)`);
        }
      }
    }

    // Wait for next tick
    if (tick < MAX_TICKS) {
      await new Promise(resolve => setTimeout(resolve, TICK_MS));
    }
  }

  // ── Phase 5: Final report ──────────────────────────────────
  log("\n\n══════════════════════════════════════════════════");
  log("SIMULATION COMPLETE — FINAL REPORT");
  log("══════════════════════════════════════════════════\n");

  // Tournament results
  log("TOURNAMENT RESULTS:");
  for (const [tid, stats] of tournamentStats) {
    log(`  ${stats.name || tid.slice(0,8)}: status=${stats.status}, ${stats.completed}/${stats.totalMatches} matches done`);
  }

  // Stuck matches
  const reallyStuck = [...stuckMatches.entries()].filter(([, s]) => s.stuckDays >= 5);
  log(`\nSTUCK MATCHES (5+ days in same state): ${reallyStuck.length}`);
  for (const [id, s] of reallyStuck.slice(0, 20)) {
    log(`  Match ${id.slice(0, 8)}: stuck in '${s.lastStatus}' for ${s.stuckDays} days`);
  }

  // Bugs
  log(`\nBUGS FOUND: ${bugs.length}`);
  const bugsByType = {};
  for (const b of bugs) {
    const type = b.message.split(":")[0].replace(/^.*?(failed|BUG|exception|Unknown|has no)/, "$1");
    bugsByType[type] = (bugsByType[type] || 0) + 1;
  }
  for (const [type, count] of Object.entries(bugsByType).sort((a, b) => b[1] - a[1])) {
    log(`  ${type}: ${count} occurrences`);
  }

  // Write detailed log file
  const report = [
    "# Rally Tournament Simulation Report",
    `\nDate: ${new Date().toISOString()}`,
    `Players: ${players.size}`,
    `Tournaments: ${tournamentStats.size}`,
    `Total ticks (days): ${MAX_TICKS}`,
    "",
    "## Bugs Found",
    "",
    ...bugs.map((b, i) => `${i + 1}. **[${b.time}]** ${b.message}${b.matchId ? ` (match: ${b.matchId.slice(0, 8)})` : ""}`),
    "",
    "## Stuck Matches",
    "",
    ...reallyStuck.map(([id, s]) => `- Match \`${id.slice(0, 8)}\`: stuck in **${s.lastStatus}** for ${s.stuckDays} days`),
    "",
    "## Tournament Final States",
    "",
    ...[...tournamentStats.entries()].map(([, s]) =>
      `- **${s.name || "?"}**: status=\`${s.status}\`, matches=${s.completed}/${s.totalMatches} done (P:${s.pending} Sch:${s.scheduling} Sched:${s.scheduled})`
    ),
    "",
    "## Event Log",
    "",
    ...events.map(e => `    ${e}`),
  ].join("\n");

  writeFileSync(LOG_FILE, report);
  log(`\nFull report written to ${LOG_FILE}`);
}

// ─── Run ────────────────────────────────────────────────────────────────────

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});

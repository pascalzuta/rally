/**
 * ELO rating system for tennis match results.
 * New players start at 1000. K=32 for first 20 games, K=16 after.
 *
 * Enhanced functions add confidence-based K-factor, margin multipliers,
 * and NTRP <-> ELO conversions for tournament play.
 */

import type { SetScore, SkillBand } from "./types.js";

const STARTING_RATING = 1000;
const K_NEW = 32;   // < 20 games
const K_EST = 16;   // 20+ games
const SCALE = 400;

export function startingRating(): number {
  return STARTING_RATING;
}

export function expectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / SCALE));
}

export function kFactor(gamesPlayed: number): number {
  return gamesPlayed < 20 ? K_NEW : K_EST;
}

export interface RatingUpdate {
  newRating: number;
  delta: number;
}

export function computeRatingUpdate(
  playerRating: number,
  opponentRating: number,
  gamesPlayed: number,
  won: boolean
): RatingUpdate {
  const expected = expectedScore(playerRating, opponentRating);
  const actual = won ? 1 : 0;
  const k = kFactor(gamesPlayed);
  const delta = Math.round(k * (actual - expected));
  return {
    newRating: Math.max(100, playerRating + delta),
    delta
  };
}

export function levelFromRating(rating: number): string {
  if (rating < 1050) return "Beginner";
  if (rating < 1200) return "Intermediate";
  return "Advanced";
}

// ─── Enhanced Rating Functions ────────────────────────────────────────────────

/**
 * Compute margin multiplier from structured set scores.
 * Rewards decisive victories with a multiplier clamped between 1.0 and 1.5.
 */
export function marginMultiplier(sets: SetScore[]): number {
  let setsA = 0;
  let setsB = 0;
  let gamesA = 0;
  let gamesB = 0;
  for (const s of sets) {
    gamesA += s.aGames;
    gamesB += s.bGames;
    if (s.aGames > s.bGames) setsA++;
    else setsB++;
  }
  const setDiff = Math.abs(setsA - setsB);
  const gameDiff = Math.abs(gamesA - gamesB);
  return Math.min(1.5, 1 + 0.05 * setDiff + 0.01 * gameDiff);
}

/**
 * K-factor adjusted for confidence and provisional status.
 * Provisional players (provisionalRemaining > 0) use a higher base K of 48.
 * Confidence scales the K down: higher confidence = lower volatility.
 */
export function kFactorWithConfidence(
  confidence: number,
  provisionalRemaining: number
): number {
  const base = provisionalRemaining > 0 ? 48 : 32;
  return Math.round(base * (1.1 - confidence * 0.5));
}

/**
 * Enhanced rating update with confidence-based K-factor and optional margin multiplier.
 * Used for tournament matches with structured set scores.
 */
export function computeEnhancedRatingUpdate(
  playerRating: number,
  opponentRating: number,
  confidence: number,
  provisionalRemaining: number,
  won: boolean,
  sets?: SetScore[]
): RatingUpdate {
  const expected = expectedScore(playerRating, opponentRating);
  const actual = won ? 1 : 0;
  const k = kFactorWithConfidence(confidence, provisionalRemaining);
  const margin = sets ? marginMultiplier(sets) : 1;
  const delta = Math.round(k * (actual - expected) * margin);
  return {
    newRating: Math.max(100, playerRating + delta),
    delta
  };
}

/**
 * Map NTRP self-rating to approximate ELO rating.
 * NTRP 2.5 ~ 950, 3.0 ~ 1060, 3.5 ~ 1170, 4.0 ~ 1280, 4.5 ~ 1390, 5.0 ~ 1500
 */
export function ntrpToRating(ntrp: number): number {
  return Math.round(400 + ntrp * 220);
}

/**
 * Map ELO rating back to approximate NTRP (rounded to nearest 0.5).
 */
export function ratingToNtrp(rating: number): number {
  const raw = (rating - 400) / 220;
  return Math.round(raw * 2) / 2;
}

/**
 * Get the skill band a player should be grouped into based on NTRP self-rating.
 *   <= 3.0 -> "3.0"
 *   < 4.0  -> "3.5"
 *   >= 4.0 -> "4.0"
 */
export function skillBandFromNtrp(ntrp: number): SkillBand {
  if (ntrp <= 3.0) return "3.0";
  if (ntrp < 4.0) return "3.5";
  return "4.0";
}

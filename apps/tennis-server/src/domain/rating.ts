import { computeRatingUpdate, computeEnhancedRatingUpdate, startingRating } from "@rally/core";
import type { Player, SetScore } from "@rally/core";

export function newPlayer(id: string, email: string): Player {
  return {
    id, email, name: "", city: "", county: "", level: "beginner",
    ntrp: 3.0, rating: startingRating(), ratingConfidence: 0.2,
    provisionalRemaining: 5, subscription: "free",
    wins: 0, losses: 0,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
}

export function applyMatchResult(
  winner: Player,
  loser: Player
): { updatedWinner: Player; updatedLoser: Player } {
  const winnerUpdate = computeRatingUpdate(winner.rating, loser.rating, winner.wins + winner.losses, true);
  const loserUpdate = computeRatingUpdate(loser.rating, winner.rating, loser.wins + loser.losses, false);

  const updatedWinner: Player = {
    ...winner,
    rating: winnerUpdate.newRating,
    wins: winner.wins + 1,
    updatedAt: new Date().toISOString()
  };

  const updatedLoser: Player = {
    ...loser,
    rating: loserUpdate.newRating,
    losses: loser.losses + 1,
    updatedAt: new Date().toISOString()
  };

  return { updatedWinner, updatedLoser };
}

export function applyEnhancedMatchResult(
  winner: Player, loser: Player, sets?: SetScore[]
): { updatedWinner: Player; updatedLoser: Player } {
  const winnerUpdate = computeEnhancedRatingUpdate(winner.rating, loser.rating, winner.ratingConfidence, winner.provisionalRemaining, true, sets);
  const loserUpdate = computeEnhancedRatingUpdate(loser.rating, winner.rating, loser.ratingConfidence, loser.provisionalRemaining, false, sets);
  const updateConf = (c: number) => Math.min(1.0, c + 0.05);
  const updateProv = (p: number) => Math.max(0, p - 1);
  return {
    updatedWinner: { ...winner, rating: winnerUpdate.newRating, wins: winner.wins + 1, ratingConfidence: updateConf(winner.ratingConfidence), provisionalRemaining: updateProv(winner.provisionalRemaining), updatedAt: new Date().toISOString() },
    updatedLoser: { ...loser, rating: loserUpdate.newRating, losses: loser.losses + 1, ratingConfidence: updateConf(loser.ratingConfidence), provisionalRemaining: updateProv(loser.provisionalRemaining), updatedAt: new Date().toISOString() }
  };
}

/** Find players in the same city within a rating range */
export function findNearbyPlayers(
  allPlayers: Player[],
  forPlayer: Player,
  ratingRange = 300
): Player[] {
  return allPlayers.filter(
    (p) => p.id !== forPlayer.id &&
      p.city.toLowerCase() === forPlayer.city.toLowerCase() &&
      Math.abs(p.rating - forPlayer.rating) <= ratingRange && p.name !== ""
  );
}

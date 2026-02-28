import { useMemo } from "react";
import type { Tournament, TournamentMatch, ActionItem, ActionType } from "../types";

const PRIORITY_ORDER: ActionType[] = [
  "confirm-score",
  "flex-schedule",
  "propose-times",
  "pick-time",
  "enter-score",
];

export function useActionItems(
  allMatches: Map<string, TournamentMatch[]>,
  tournaments: Tournament[],
  playerId: string | undefined,
  playerNames: Record<string, string>
): ActionItem[] {
  return useMemo(() => {
    if (!playerId) return [];

    const items: ActionItem[] = [];

    for (const [tournamentId, matches] of allMatches) {
      const tournament = tournaments.find(t => t.id === tournamentId);
      if (!tournament) continue;
      const tournamentName = tournament.name;

      for (const match of matches) {
        // Only consider matches where this player is involved
        const isHome = match.homePlayerId === playerId;
        const isAway = match.awayPlayerId === playerId;
        if (!isHome && !isAway) continue;

        const opponentId = isHome ? match.awayPlayerId : match.homePlayerId;
        const opponentName = playerNames[opponentId] ?? "Opponent";

        const base = {
          matchId: match.id,
          tournamentId,
          tournamentName,
          opponentName,
          opponentId,
          round: match.round,
        };

        // Check for pending result actions
        if (match.pendingResult) {
          if (match.pendingResult.reportedBy !== playerId) {
            // Opponent reported — player needs to confirm
            items.push({ ...base, type: "confirm-score" });
          }
          // If reported by this player, skip — waiting for opponent
          continue;
        }

        // Match is completed or cancelled — no action needed
        if (match.status === "completed" || match.status === "cancelled") continue;

        if (match.status === "pending" && match.schedulingTier === 2) {
          items.push({ ...base, type: "flex-schedule", nearMiss: match.nearMiss });
        } else if (match.status === "pending" && (match.schedulingTier === 3 || match.schedulingTier === undefined)) {
          const hasProposals = match.proposals && match.proposals.length > 0;
          if (!hasProposals) {
            items.push({ ...base, type: "propose-times" });
          }
        } else if (match.status === "scheduling" && match.proposals) {
          const needsAcceptance = match.proposals.some(
            p => !p.acceptedBy.includes(playerId)
          );
          if (needsAcceptance) {
            items.push({ ...base, type: "pick-time", proposals: match.proposals });
          }
        } else if (match.status === "scheduled" && !match.result && !match.pendingResult) {
          items.push({ ...base, type: "enter-score" });
        }
      }
    }

    // Sort by priority
    items.sort((a, b) => {
      const aIdx = PRIORITY_ORDER.indexOf(a.type);
      const bIdx = PRIORITY_ORDER.indexOf(b.type);
      return aIdx - bIdx;
    });

    return items;
  }, [allMatches, tournaments, playerId, playerNames]);
}

import { useState, useCallback } from "react";
import type { Tournament, TournamentMatch, SetScore, SchedulingInfo } from "../types";
import {
  apiGetTournamentMatches,
  apiSubmitTournamentScore,
  apiScheduleMatch,
  apiFlexAccept,
  apiProposeTimes,
  apiAcceptTime,
  apiGetSchedulingInfo,
} from "../api";

export function useMatches() {
  const [allMatches, setAllMatches] = useState<Map<string, TournamentMatch[]>>(new Map());
  const [loading, setLoading] = useState(false);

  const loadMatchesForTournaments = useCallback(async (token: string, tournaments: Tournament[], playerId: string) => {
    setLoading(true);
    try {
      const newMap = new Map<string, TournamentMatch[]>();
      const activeTournaments = tournaments.filter(
        t => (t.status === "active" || t.status === "finals") && t.playerIds.includes(playerId)
      );

      await Promise.all(
        activeTournaments.map(async (t) => {
          try {
            const { matches } = await apiGetTournamentMatches(token, t.id);
            newMap.set(t.id, matches);
          } catch {
            // If fetching matches fails for one tournament, skip it
            newMap.set(t.id, []);
          }
        })
      );

      setAllMatches(newMap);
    } finally {
      setLoading(false);
    }
  }, []);

  const submitScore = useCallback(async (
    token: string,
    tournamentId: string,
    matchId: string,
    winnerId: string,
    sets: SetScore[]
  ): Promise<string> => {
    const { status } = await apiSubmitTournamentScore(token, tournamentId, matchId, winnerId, sets);
    return status;
  }, []);

  const scheduleMatch = useCallback(async (token: string, matchId: string, datetime: string, label: string) => {
    await apiScheduleMatch(token, matchId, datetime, label);
  }, []);

  const flexAccept = useCallback(async (token: string, matchId: string, datetime: string, label: string) => {
    await apiFlexAccept(token, matchId, datetime, label);
  }, []);

  const proposeTimes = useCallback(async (token: string, matchId: string, times: Array<{ datetime: string; label: string }>) => {
    await apiProposeTimes(token, matchId, times);
  }, []);

  const acceptTime = useCallback(async (token: string, matchId: string, proposalId: string) => {
    await apiAcceptTime(token, matchId, proposalId);
  }, []);

  const getSchedulingInfo = useCallback(async (token: string, matchId: string): Promise<SchedulingInfo> => {
    return apiGetSchedulingInfo(token, matchId);
  }, []);

  return {
    allMatches,
    loading,
    loadMatchesForTournaments,
    submitScore,
    scheduleMatch,
    flexAccept,
    proposeTimes,
    acceptTime,
    getSchedulingInfo,
  };
}

import { useState, useCallback } from "react";
import type { Tournament, SchedulingResult } from "../types";
import { apiGetTournaments, apiGetTournament, apiJoinTournament, apiLeaveTournament } from "../api";

export function useTournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const loadTournaments = useCallback(async (token: string) => {
    setLoading(true);
    try {
      const { tournaments: list } = await apiGetTournaments(token);
      setTournaments(list);
    } finally {
      setLoading(false);
    }
  }, []);

  const joinTournament = useCallback(async (token: string, id: string): Promise<{ activated: boolean; schedulingResult?: SchedulingResult }> => {
    const result = await apiJoinTournament(token, id);
    // Update local tournament list with the returned tournament
    setTournaments(prev => prev.map(t => t.id === id ? result.tournament : t));
    return { activated: result.activated ?? false, schedulingResult: result.schedulingResult };
  }, []);

  const leaveTournament = useCallback(async (token: string, id: string) => {
    const { tournament } = await apiLeaveTournament(token, id);
    setTournaments(prev => prev.map(t => t.id === id ? tournament : t));
  }, []);

  const getTournamentDetail = useCallback(async (token: string, id: string): Promise<{ tournament: Tournament; playerNames: Record<string, string> }> => {
    const result = await apiGetTournament(token, id);
    // Merge player names into the global map
    setPlayerNames(prev => ({ ...prev, ...result.playerNames }));
    // Update local tournament list with the fresh data
    setTournaments(prev => prev.map(t => t.id === id ? result.tournament : t));
    return result;
  }, []);

  return { tournaments, playerNames, loading, loadTournaments, joinTournament, leaveTournament, getTournamentDetail };
}

import { useState, useEffect, useCallback } from "react";
import type { Tab, ActionItem, TournamentMatch, SheetContent, SchedulingInfo } from "./types";
import { TOKEN_KEY } from "./constants";
import { useAuth } from "./hooks/useAuth";
import { useTournaments } from "./hooks/useTournaments";
import { useMatches } from "./hooks/useMatches";
import { useActionItems } from "./hooks/useActionItems";
import { useAvailability } from "./hooks/useAvailability";
import { useBottomSheet } from "./hooks/useBottomSheet";
import { apiSeedRich, apiSimulateTournament, apiGetSchedulingInfo } from "./api";
import BottomNav from "./components/BottomNav";
import BottomSheet from "./components/BottomSheet";
import ScoreEntrySheet from "./components/ScoreEntrySheet";
import ConfirmScoreSheet from "./components/ConfirmScoreSheet";
import SchedulingSheet from "./components/SchedulingSheet";
import FlexSheet from "./components/FlexSheet";
import ProposeSheet from "./components/ProposeSheet";
import TestBar from "./components/TestBar";
import LoginScreen from "./screens/LoginScreen";
import SetupScreen from "./screens/SetupScreen";
import HomeScreen from "./screens/HomeScreen";
import TourneyScreen from "./screens/TourneyScreen";
import ActivityScreen from "./screens/ActivityScreen";
import ProfileScreen from "./screens/ProfileScreen";

export default function App() {
  // Auth
  const {
    token,
    player,
    loading: authLoading,
    login,
    logout,
    refreshPlayer,
    updateProfile,
  } = useAuth();

  // Tournaments
  const {
    tournaments,
    playerNames,
    loading: tourneysLoading,
    loadTournaments,
    joinTournament,
    leaveTournament,
    getTournamentDetail,
  } = useTournaments();

  // Matches
  const {
    allMatches,
    loading: matchesLoading,
    loadMatchesForTournaments,
    submitScore,
    scheduleMatch,
    flexAccept,
    proposeTimes,
    acceptTime,
    getSchedulingInfo,
  } = useMatches();

  // Action items
  const actionItems = useActionItems(allMatches, tournaments, player?.id, playerNames);

  // Availability
  const {
    slots: availSlots,
    impactSuggestions,
    loadSlots,
    saveSlots,
    loadImpact,
  } = useAvailability();

  // Bottom sheet
  const sheet = useBottomSheet();

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);

  // Needs setup: player exists but has no name or county
  const needsSetup = player && (!player.name || !player.county);

  // Load data when authenticated
  useEffect(() => {
    if (!token || !player) return;
    loadTournaments(token);
    loadSlots(token);
  }, [token, player?.id]);

  // Load matches when tournaments change
  useEffect(() => {
    if (!token || !player || tournaments.length === 0) return;
    loadMatchesForTournaments(token, tournaments, player.id);
  }, [token, player?.id, tournaments]);

  // Load player names for tournaments
  useEffect(() => {
    if (!token || tournaments.length === 0) return;
    // Load details for active tournaments to populate playerNames
    const activeTournaments = tournaments.filter(
      (t) =>
        (t.status === "active" || t.status === "finals") &&
        t.playerIds.includes(player?.id ?? ""),
    );
    for (const t of activeTournaments) {
      getTournamentDetail(token, t.id);
    }
  }, [token, tournaments.map(t => `${t.id}:${t.status}`).join(",")]);

  // Load availability impact when matches change
  useEffect(() => {
    if (!token || !player) return;
    loadImpact(token, player.id);
  }, [token, player?.id, allMatches]);

  // Auto-select first tournament
  useEffect(() => {
    if (!selectedTournamentId && player) {
      const myActive = tournaments.find(
        (t) =>
          (t.status === "active" || t.status === "finals") &&
          t.playerIds.includes(player.id),
      );
      if (myActive) setSelectedTournamentId(myActive.id);
    }
  }, [tournaments, player?.id]);

  // Reload all data
  const reloadAll = useCallback(async () => {
    if (!token || !player) return;
    await loadTournaments(token);
    await loadSlots(token);
  }, [token, player?.id]);

  // Handle action card taps
  const handleAction = useCallback(
    async (action: ActionItem) => {
      if (!token || !player) return;

      const tournament = tournaments.find((t) => t.id === action.tournamentId);
      const matches = allMatches.get(action.tournamentId) ?? [];
      const match = matches.find((m) => m.id === action.matchId);
      if (!match || !tournament) return;

      switch (action.type) {
        case "confirm-score":
          sheet.open({ type: "confirm-score", match, tournament });
          break;
        case "enter-score":
          sheet.open({ type: "score-entry", match, tournament });
          break;
        case "flex-schedule": {
          if (match.nearMiss) {
            sheet.open({ type: "flex", match, nearMiss: match.nearMiss });
          }
          break;
        }
        case "propose-times": {
          try {
            const info = await getSchedulingInfo(token, match.id);
            sheet.open({ type: "propose", match, mySlots: info.mySlots });
          } catch {
            /* ignore */
          }
          break;
        }
        case "pick-time": {
          try {
            const info = await getSchedulingInfo(token, match.id);
            sheet.open({ type: "scheduling", match, schedulingInfo: info });
          } catch {
            /* ignore */
          }
          break;
        }
      }
    },
    [token, player, tournaments, allMatches, sheet],
  );

  // Handle match action from tourney/activity screens
  const handleMatchAction = useCallback(
    async (match: TournamentMatch) => {
      if (!token || !player) return;
      const tournament = tournaments.find((t) => t.id === match.tournamentId);
      if (!tournament) return;

      if (match.pendingResult && match.pendingResult.reportedBy !== player.id) {
        sheet.open({ type: "confirm-score", match, tournament });
      } else if (
        match.status === "scheduled" &&
        !match.result &&
        !match.pendingResult
      ) {
        sheet.open({ type: "score-entry", match, tournament });
      } else if (
        match.status === "pending" &&
        match.schedulingTier === 2 &&
        match.nearMiss
      ) {
        sheet.open({ type: "flex", match, nearMiss: match.nearMiss });
      } else if (match.status === "pending") {
        try {
          const info = await getSchedulingInfo(token, match.id);
          if (info.overlaps.length > 0) {
            sheet.open({ type: "scheduling", match, schedulingInfo: info });
          } else {
            sheet.open({ type: "propose", match, mySlots: info.mySlots });
          }
        } catch {
          /* ignore */
        }
      } else if (match.status === "scheduling" && match.proposals?.length) {
        try {
          const info = await getSchedulingInfo(token, match.id);
          sheet.open({ type: "scheduling", match, schedulingInfo: info });
        } catch {
          /* ignore */
        }
      }
    },
    [token, player, tournaments, sheet],
  );

  // Score submission handler
  const handleScoreSubmit = useCallback(
    async (
      matchId: string,
      tournamentId: string,
      winnerId: string,
      sets: Array<{
        aGames: number;
        bGames: number;
        tiebreak?: { aPoints: number; bPoints: number };
      }>,
    ) => {
      if (!token) return;
      try {
        await submitScore(token, tournamentId, matchId, winnerId, sets);
        sheet.close();
        await reloadAll();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to submit score");
      }
    },
    [token, sheet, reloadAll],
  );

  // Schedule handlers
  const handleSchedule = useCallback(
    async (datetime: string, label: string, matchId: string) => {
      if (!token) return;
      try {
        await scheduleMatch(token, matchId, datetime, label);
        sheet.close();
        await reloadAll();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to schedule");
      }
    },
    [token, sheet, reloadAll],
  );

  const handleFlexAccept = useCallback(
    async (datetime: string, label: string, matchId: string) => {
      if (!token) return;
      try {
        await flexAccept(token, matchId, datetime, label);
        sheet.close();
        await reloadAll();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to flex schedule");
      }
    },
    [token, sheet, reloadAll],
  );

  const handlePropose = useCallback(
    async (
      times: Array<{ datetime: string; label: string }>,
      matchId: string,
    ) => {
      if (!token) return;
      try {
        await proposeTimes(token, matchId, times);
        sheet.close();
        await reloadAll();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to propose times");
      }
    },
    [token, sheet, reloadAll],
  );

  const handleAcceptProposal = useCallback(
    async (proposalId: string, matchId: string) => {
      if (!token) return;
      try {
        await acceptTime(token, matchId, proposalId);
        sheet.close();
        await reloadAll();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to accept time");
      }
    },
    [token, sheet, reloadAll],
  );

  // Join tournament handler
  const handleJoinTournament = useCallback(
    async (id: string) => {
      if (!token) return;

      // Warn if no availability is set
      if (availSlots.length === 0) {
        const goToProfile = confirm(
          "You haven't set any availability yet. Without availability, your matches can't be auto-scheduled and you'll need to coordinate times manually.\n\nSet availability in your Profile first?",
        );
        if (goToProfile) {
          setActiveTab("profile");
          return;
        }
        // User chose to continue anyway — fall through
      }

      try {
        const result = await joinTournament(token, id);
        if (result.activated) {
          // Reload to get scheduling results
          await reloadAll();
        }
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to join");
      }
    },
    [token, joinTournament, reloadAll, availSlots],
  );

  // View tournament handler
  const handleViewTournament = useCallback((id: string) => {
    setSelectedTournamentId(id);
    setActiveTab("tourney");
  }, []);

  // Test bar handlers
  const handleTestLogin = useCallback(
    async (email: string) => {
      try {
        await login(email);
      } catch {
        /* ignore */
      }
    },
    [login],
  );

  const handleSeedRich = useCallback(async () => {
    try {
      await apiSeedRich();
      if (token) await reloadAll();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to seed");
    }
  }, [token, reloadAll]);

  const handleSimulate = useCallback(async () => {
    try {
      await apiSimulateTournament();
      if (token) await reloadAll();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to simulate");
    }
  }, [token, reloadAll]);

  // Availability save handler
  const handleSaveAvailability = useCallback(
    async (
      newSlots: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
    ) => {
      if (!token) return;
      await saveSlots(token, newSlots);
    },
    [token, saveSlots],
  );

  // Setup completion handler
  const handleSetupComplete = useCallback(
    async (data: {
      name: string;
      city: string;
      county: string;
      level: string;
      ntrp: number;
    }) => {
      await updateProfile(data);
    },
    [updateProfile],
  );

  // Helper to extract match id from sheet content safely
  const getSheetMatchId = (): string => {
    const content = sheet.content;
    if (content && "match" in content) {
      return content.match.id;
    }
    return "";
  };

  // ---- Render ----------------------------------------------------------------

  // Loading state
  if (authLoading) {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <p>Loading Rally...</p>
      </div>
    );
  }

  // Not authenticated
  if (!token || !player) {
    return (
      <div className="app">
        <LoginScreen onLogin={login} loading={authLoading} />
        <TestBar
          onLogin={handleTestLogin}
          onSeedRich={handleSeedRich}
          onSimulate={handleSimulate}
        />
      </div>
    );
  }

  // Needs setup
  if (needsSetup) {
    return (
      <div className="app">
        <SetupScreen player={player} onComplete={handleSetupComplete} />
        <TestBar
          onLogin={handleTestLogin}
          onSeedRich={handleSeedRich}
          onSimulate={handleSimulate}
        />
      </div>
    );
  }

  // Main app
  return (
    <div className="app">
      <div className="app-content">
        {activeTab === "home" && (
          <HomeScreen
            player={player}
            actionItems={actionItems}
            tournaments={tournaments}
            allMatches={allMatches}
            playerNames={playerNames}
            onAction={handleAction}
            onJoinTournament={handleJoinTournament}
            onViewTournament={handleViewTournament}
          />
        )}
        {activeTab === "tourney" && (
          <TourneyScreen
            player={player}
            tournaments={tournaments}
            allMatches={allMatches}
            playerNames={playerNames}
            selectedTournamentId={selectedTournamentId}
            onSelectTournament={setSelectedTournamentId}
            onMatchAction={handleMatchAction}
          />
        )}
        {activeTab === "activity" && (
          <ActivityScreen
            player={player}
            allMatches={allMatches}
            tournaments={tournaments}
            playerNames={playerNames}
            onMatchAction={handleMatchAction}
          />
        )}
        {activeTab === "profile" && (
          <ProfileScreen
            player={player}
            availability={availSlots}
            impactSuggestions={impactSuggestions}
            onSaveAvailability={handleSaveAvailability}
            onSignOut={logout}
          />
        )}
      </div>

      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        actionCount={actionItems.length}
      />

      {/* Bottom Sheet Portal */}
      <BottomSheet
        isOpen={sheet.isOpen}
        onClose={sheet.close}
        title={
          sheet.content?.type === "score-entry"
            ? "Enter Score"
            : sheet.content?.type === "confirm-score"
              ? "Confirm Score"
              : sheet.content?.type === "scheduling"
                ? "Pick a Time"
                : sheet.content?.type === "flex"
                  ? "Almost There!"
                  : sheet.content?.type === "propose"
                    ? "Propose Times"
                    : undefined
        }
      >
        {sheet.content?.type === "score-entry" && (
          <ScoreEntrySheet
            match={sheet.content.match}
            tournament={sheet.content.tournament}
            playerNames={playerNames}
            playerId={player.id}
            onSubmit={handleScoreSubmit}
            onClose={sheet.close}
          />
        )}
        {sheet.content?.type === "confirm-score" && (
          <ConfirmScoreSheet
            match={sheet.content.match}
            playerNames={playerNames}
            playerId={player.id}
            onConfirm={handleScoreSubmit}
            onClose={sheet.close}
          />
        )}
        {sheet.content?.type === "scheduling" && (
          <SchedulingSheet
            match={sheet.content.match}
            playerNames={playerNames}
            playerId={player.id}
            options={sheet.content.schedulingInfo.overlaps}
            proposals={sheet.content.match.proposals}
            onSelectOption={(dt, label) =>
              handleSchedule(dt, label, getSheetMatchId())
            }
            onAcceptProposal={(pid) =>
              handleAcceptProposal(pid, getSheetMatchId())
            }
            onClose={sheet.close}
          />
        )}
        {sheet.content?.type === "flex" && (
          <FlexSheet
            match={sheet.content.match}
            nearMiss={sheet.content.nearMiss}
            playerNames={playerNames}
            playerId={player.id}
            onAccept={(dt, label) =>
              handleFlexAccept(dt, label, getSheetMatchId())
            }
            onClose={sheet.close}
          />
        )}
        {sheet.content?.type === "propose" && (
          <ProposeSheet
            match={sheet.content.match}
            mySlots={sheet.content.mySlots}
            playerNames={playerNames}
            playerId={player.id}
            onPropose={(times) => handlePropose(times, getSheetMatchId())}
            onClose={sheet.close}
          />
        )}
      </BottomSheet>

      <TestBar
        onLogin={handleTestLogin}
        onSeedRich={handleSeedRich}
        onSimulate={handleSimulate}
      />
    </div>
  );
}

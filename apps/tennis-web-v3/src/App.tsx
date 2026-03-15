import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Tab, ActionItem, TournamentMatch } from "./types";
import { useAuth } from "./hooks/useAuth";
import { useTournaments } from "./hooks/useTournaments";
import { useMatches } from "./hooks/useMatches";
import { useActionItems } from "./hooks/useActionItems";
import { useAvailability } from "./hooks/useAvailability";
import { useBottomSheet } from "./hooks/useBottomSheet";
import {
  apiSeedRich,
  apiSimulateTournament,
  apiAcceptProposals,
  apiSubmitScores,
  apiConfirmScores,
  apiAdvanceToFinals,
  apiGetTournaments,
} from "./api";
import BottomNav from "./components/BottomNav";
import BottomSheet from "./components/BottomSheet";
import ScoreEntrySheet from "./components/ScoreEntrySheet";
import ConfirmScoreSheet from "./components/ConfirmScoreSheet";
import SchedulingSheet from "./components/SchedulingSheet";
import FlexSheet from "./components/FlexSheet";
import ProposeSheet from "./components/ProposeSheet";
import JoinTournamentSheet from "./components/JoinTournamentSheet";
import TournamentRulesSheet from "./components/TournamentRulesSheet";
import TestBar from "./components/TestBar";
import GateScreen, { isGateUnlocked } from "./screens/GateScreen";
import LoginScreen from "./screens/LoginScreen";
import SetupScreen from "./screens/SetupScreen";
import HomeScreen from "./screens/HomeScreen";
import TourneyScreen from "./screens/TourneyScreen";
import ActivityScreen from "./screens/ActivityScreen";
import ProfileScreen from "./screens/ProfileScreen";

const HIW_DISMISSED_KEY = "rally_hiw_dismissed";

export default function App() {
  const [gateUnlocked, setGateUnlocked] = useState(isGateUnlocked);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [hiwDismissed, setHiwDismissed] = useState(() =>
    localStorage.getItem(HIW_DISMISSED_KEY) === "1"
  );

  const {
    token,
    player,
    loading: authLoading,
    login,
    logout,
    refreshPlayer,
    updateProfile,
  } = useAuth();

  const {
    tournaments,
    playerNames,
    playerRatings,
    loadTournaments,
    joinTournament,
    getTournamentDetail,
  } = useTournaments();

  const {
    allMatches,
    loadMatchesForTournaments,
    submitScore,
    scheduleMatch,
    flexAccept,
    proposeTimes,
    acceptTime,
    getSchedulingInfo,
  } = useMatches();

  const actionItems = useActionItems(allMatches, tournaments, player?.id, playerNames);

  const {
    slots: availSlots,
    impactSuggestions,
    loadSlots,
    saveSlots,
    loadImpact,
  } = useAvailability();

  const sheet = useBottomSheet();

  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const fetchedDetailIds = useRef<Set<string>>(new Set());

  const needsSetup = player && (!player.name || !player.county);

  const tournamentKey = useMemo(
    () => tournaments.map(t => `${t.id}:${t.status}`).join(","),
    [tournaments]
  );

  // Load data when authenticated
  useEffect(() => {
    if (!token || !player) return;
    loadTournaments(token);
    loadSlots(token);
  }, [token, player?.id, loadTournaments, loadSlots]);

  // Load matches when tournaments change
  useEffect(() => {
    if (!token || !player || tournaments.length === 0) return;
    loadMatchesForTournaments(token, tournaments, player.id);
  }, [token, player?.id, tournamentKey, loadMatchesForTournaments]);

  // Load player names for active tournaments (only fetch each once per session)
  useEffect(() => {
    if (!token || tournaments.length === 0) return;
    const myTournaments = tournaments.filter(
      (t) =>
        (t.status === "active" || t.status === "finals" || t.status === "completed") &&
        t.playerIds.includes(player?.id ?? ""),
    );
    for (const t of myTournaments) {
      if (!fetchedDetailIds.current.has(t.id)) {
        fetchedDetailIds.current.add(t.id);
        getTournamentDetail(token, t.id);
      }
    }
  }, [token, tournamentKey, player?.id, getTournamentDetail]);

  // Load availability impact when matches change
  useEffect(() => {
    if (!token || !player) return;
    loadImpact(token, player.id);
  }, [token, player?.id, allMatches, loadImpact]);

  // Periodic data refresh (every 30 seconds)
  useEffect(() => {
    if (!token || !player) return;
    const interval = setInterval(() => {
      loadTournaments(token).catch(() => {
        // Silent fail on polling — token may have expired
        logout();
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [token, player?.id, loadTournaments, logout]);

  // Auto-select first active tournament
  useEffect(() => {
    if (!selectedTournamentId && player) {
      const myActive = tournaments.find(
        (t) =>
          (t.status === "active" || t.status === "finals" || t.status === "completed") &&
          t.playerIds.includes(player.id),
      );
      if (myActive) setSelectedTournamentId(myActive.id);
    }
  }, [tournaments, player?.id, selectedTournamentId]);

  const reloadAll = useCallback(async () => {
    if (!token || !player) return;
    await loadTournaments(token);
    await loadSlots(token);
    // Force re-fetch matches for all tournaments (covers activation creating new matches)
    const fresh = await apiGetTournaments(token);
    if (fresh.tournaments.length > 0) {
      await loadMatchesForTournaments(token, fresh.tournaments, player.id);
    }
  }, [token, player?.id, loadTournaments, loadSlots, loadMatchesForTournaments]);

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
          } catch (e) {
            alert(e instanceof Error ? e.message : "Failed to load scheduling info");
          }
          break;
        }
        case "pick-time": {
          try {
            const info = await getSchedulingInfo(token, match.id);
            sheet.open({ type: "scheduling", match, schedulingInfo: info });
          } catch (e) {
            alert(e instanceof Error ? e.message : "Failed to load scheduling info");
          }
          break;
        }
      }
    },
    [token, player, tournaments, allMatches, sheet, getSchedulingInfo],
  );

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
        } catch (e) {
          console.error("Failed to load scheduling info:", e);
        }
      } else if (match.status === "scheduling" && match.proposals?.length) {
        try {
          const info = await getSchedulingInfo(token, match.id);
          sheet.open({ type: "scheduling", match, schedulingInfo: info });
        } catch (e) {
          console.error("Failed to load scheduling info:", e);
        }
      }
    },
    [token, player, tournaments, sheet, getSchedulingInfo],
  );

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
      if (!token || actionInProgress) return;
      setActionInProgress(true);
      try {
        await submitScore(token, tournamentId, matchId, winnerId, sets);
        sheet.close();
        await reloadAll();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to submit score");
      } finally {
        setActionInProgress(false);
      }
    },
    [token, sheet, reloadAll, submitScore, actionInProgress],
  );

  const handleSchedule = useCallback(
    async (datetime: string, label: string, matchId: string) => {
      if (!token || actionInProgress) return;
      setActionInProgress(true);
      try {
        await scheduleMatch(token, matchId, datetime, label);
        sheet.close();
        await reloadAll();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to schedule");
      } finally {
        setActionInProgress(false);
      }
    },
    [token, sheet, reloadAll, scheduleMatch, actionInProgress],
  );

  const handleFlexAccept = useCallback(
    async (datetime: string, label: string, matchId: string) => {
      if (!token || actionInProgress) return;
      setActionInProgress(true);
      try {
        await flexAccept(token, matchId, datetime, label);
        sheet.close();
        await reloadAll();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to flex schedule");
      } finally {
        setActionInProgress(false);
      }
    },
    [token, sheet, reloadAll, flexAccept, actionInProgress],
  );

  const handlePropose = useCallback(
    async (
      times: Array<{ datetime: string; label: string }>,
      matchId: string,
    ) => {
      if (!token || actionInProgress) return;
      setActionInProgress(true);
      try {
        await proposeTimes(token, matchId, times);
        sheet.close();
        await reloadAll();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to propose times");
      } finally {
        setActionInProgress(false);
      }
    },
    [token, sheet, reloadAll, proposeTimes, actionInProgress],
  );

  const handleAcceptProposal = useCallback(
    async (proposalId: string, matchId: string) => {
      if (!token || actionInProgress) return;
      setActionInProgress(true);
      try {
        await acceptTime(token, matchId, proposalId);
        sheet.close();
        await reloadAll();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to accept time");
      } finally {
        setActionInProgress(false);
      }
    },
    [token, sheet, reloadAll, acceptTime, actionInProgress],
  );

  const handleJoinTournament = useCallback(
    (id: string) => {
      if (!token || actionInProgress) return;

      const tournament = tournaments.find((t) => t.id === id);
      if (!tournament) return;

      // Open the join sheet with tournament info
      sheet.open({ type: "join-tournament", tournament });
    },
    [token, tournaments, actionInProgress, sheet],
  );

  const handleConfirmJoin = useCallback(
    async (id: string) => {
      if (!token || actionInProgress) return;

      if (availSlots.length === 0) {
        const goToProfile = confirm(
          "You haven't set any availability yet. Without availability, your matches can't be auto-scheduled and you'll need to coordinate times manually.\n\nSet availability in your Profile first?",
        );
        if (goToProfile) {
          sheet.close();
          setActiveTab("profile");
          return;
        }
      }

      setActionInProgress(true);
      try {
        const result = await joinTournament(token, id);
        sheet.close();
        // Always reload to pick up updated tournament state, matches, and player names
        await reloadAll();
        if (result.activated) {
          // Fetch full detail (player names/ratings) for the newly activated tournament
          fetchedDetailIds.current.delete(id);
          await getTournamentDetail(token, id);
          setSelectedTournamentId(id);
          setActiveTab("tourney");
        }
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to join");
      } finally {
        setActionInProgress(false);
      }
    },
    [token, joinTournament, reloadAll, getTournamentDetail, availSlots, actionInProgress, sheet],
  );

  const handleViewTournament = useCallback((id: string) => {
    setSelectedTournamentId(id);
    setActiveTab("tourney");
  }, []);

  const handleShowRules = useCallback(() => {
    const tournament = selectedTournamentId
      ? tournaments.find((t) => t.id === selectedTournamentId) ?? null
      : null;
    sheet.open({ type: "rules", tournament });
  }, [selectedTournamentId, tournaments, sheet]);

  const handleDismissHowItWorks = useCallback(() => {
    setHiwDismissed(true);
    localStorage.setItem(HIW_DISMISSED_KEY, "1");
  }, []);

  const handleSaveAvailability = useCallback(
    async (
      newSlots: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
    ) => {
      if (!token) return;
      await saveSlots(token, newSlots);
    },
    [token, saveSlots],
  );

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

  // TestBar shown when ?test or ?dev URL param is present, or in dev mode
  const showTestBar = import.meta.env.DEV || new URLSearchParams(window.location.search).has("test") || new URLSearchParams(window.location.search).has("dev");
  const testBarElement = showTestBar ? (
    <DevTestBar token={token} player={player} login={login} reloadAll={reloadAll} />
  ) : null;

  // Password gate
  if (!gateUnlocked) {
    return (
      <div className="app">
        <GateScreen onUnlock={() => setGateUnlocked(true)} />
      </div>
    );
  }

  // Auth loading
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
        <LoginScreen onLogin={login} />
        {testBarElement}
      </div>
    );
  }

  // Needs setup
  if (needsSetup) {
    return (
      <div className="app">
        <SetupScreen player={player} onComplete={handleSetupComplete} />
        {testBarElement}
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
            showHowItWorks={!hiwDismissed}
            onAction={handleAction}
            onJoinTournament={handleJoinTournament}
            onViewTournament={handleViewTournament}
            onTabChange={setActiveTab}
            onDismissHowItWorks={handleDismissHowItWorks}
            onShowRules={handleShowRules}
          />
        )}
        {activeTab === "tourney" && (
          <TourneyScreen
            player={player}
            tournaments={tournaments}
            allMatches={allMatches}
            playerNames={playerNames}
            playerRatings={playerRatings}
            selectedTournamentId={selectedTournamentId}
            onSelectTournament={setSelectedTournamentId}
            onMatchAction={handleMatchAction}
            onJoinTournament={handleJoinTournament}
            onShowRules={handleShowRules}
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
            onShowRules={handleShowRules}
          />
        )}
      </div>

      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        actionCount={actionItems.length}
      />

      <BottomSheet isOpen={sheet.isOpen} onClose={sheet.close}>
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
              handleSchedule(dt, label, (sheet.content as { match: TournamentMatch }).match.id)
            }
            onAcceptProposal={(pid) =>
              handleAcceptProposal(pid, (sheet.content as { match: TournamentMatch }).match.id)
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
              handleFlexAccept(dt, label, (sheet.content as { match: TournamentMatch }).match.id)
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
            onPropose={(times) => handlePropose(times, (sheet.content as { match: TournamentMatch }).match.id)}
            onClose={sheet.close}
          />
        )}
        {sheet.content?.type === "join-tournament" && (
          <JoinTournamentSheet
            tournament={sheet.content.tournament}
            onConfirmJoin={() => handleConfirmJoin((sheet.content as { tournament: { id: string } }).tournament.id)}
            onClose={sheet.close}
          />
        )}
        {sheet.content?.type === "rules" && (
          <TournamentRulesSheet
            tournament={sheet.content.tournament}
            onClose={sheet.close}
          />
        )}
      </BottomSheet>

      {testBarElement}
    </div>
  );
}

// DevTestBar wrapper handles test login and 6-step test flow
function DevTestBar({
  token,
  player,
  login,
  reloadAll,
}: {
  token: string | null;
  player: { id: string } | null;
  login: (email: string) => Promise<void>;
  reloadAll: () => Promise<void>;
}) {
  const handleTestLogin = useCallback(
    async (email: string) => {
      try {
        await login(email);
      } catch {
        /* test login failure ok */
      }
    },
    [login],
  );

  const handleTestStep = useCallback(
    async (step: 1 | 2 | 3 | 4 | 5 | 6): Promise<string> => {
      switch (step) {
        case 1: {
          const r = await apiSeedRich();
          return `Seeded ${r.players} players, ${r.tournaments} tournaments`;
        }
        case 2: {
          const r = await apiSimulateTournament(player?.id);
          if (token) await reloadAll();
          return "Tournament created";
        }
        case 3: {
          if (!player) throw new Error("Not logged in");
          const r = await apiAcceptProposals(player.id);
          if (token) await reloadAll();
          return `${r.accepted} proposal(s) accepted`;
        }
        case 4: {
          if (!player) throw new Error("Not logged in");
          const r = await apiSubmitScores(player.id);
          if (token) await reloadAll();
          return `${r.submitted} score(s) submitted`;
        }
        case 5: {
          if (!player) throw new Error("Not logged in");
          const r = await apiConfirmScores(player.id);
          if (token) await reloadAll();
          return `${r.confirmed} score(s) confirmed`;
        }
        case 6: {
          if (!player) throw new Error("Not logged in");
          const r = await apiAdvanceToFinals(player.id);
          if (token) await reloadAll();
          return r.champMatchId ? "Advanced to finals" : "Not ready for finals";
        }
      }
    },
    [player, token, reloadAll],
  );

  return (
    <TestBar
      onLogin={handleTestLogin}
      onStep={handleTestStep}
      isLoggedIn={!!player}
      onReset={() => { if (token) reloadAll(); }}
    />
  );
}

/**
 * Store Bridge — connects store.ts (plain TypeScript) to RallyDataProvider (React).
 *
 * Problem: store.ts contains mutation functions (joinLobby, saveMatchScore, etc.)
 * that need to read/write state. But store.ts isn't a React component, so it can't
 * use hooks. Previously it used localStorage as the bridge — both store.ts and React
 * could read/write it.
 *
 * Solution: RallyDataProvider registers its state and setters here on mount.
 * store.ts reads/writes through this bridge instead of localStorage.
 *
 * This is intentionally simple — just getters and setters for each data type.
 * The RallyDataProvider calls `registerBridge()` on mount and `unregisterBridge()`
 * on unmount.
 */

import {
  Tournament, LobbyEntry, PlayerRating, AvailabilitySlot,
  Trophy, Badge, RatingSnapshot, MatchFeedback, EtiquetteScore,
  MatchBroadcast, MatchOffer, RallyNotification, DirectMessage,
  MatchReaction, ReliabilityScore,
} from './types'
import type { PendingVictory, PendingFeedback } from './context/RallyDataProvider'

// ── Bridge state (module-level singleton) ──

interface BridgeState {
  // Getters (return current state from React)
  getLobby: () => LobbyEntry[]
  getTournaments: () => Tournament[]
  getRatings: () => Record<string, PlayerRating>
  getAvailability: () => Record<string, AvailabilitySlot[]>
  getTrophies: () => Trophy[]
  getBadges: () => Badge[]
  getRatingHistory: () => Record<string, RatingSnapshot[]>
  getFeedback: () => MatchFeedback[]
  getEtiquetteScores: () => Record<string, EtiquetteScore>
  getBroadcasts: () => MatchBroadcast[]
  getMatchOffers: () => MatchOffer[]
  getNotifications: () => RallyNotification[]
  getMessages: () => DirectMessage[]
  getReactions: () => MatchReaction[]
  getReliabilityScores: () => Record<string, ReliabilityScore>
  getPendingVictories: () => PendingVictory[]
  getPendingFeedback: () => PendingFeedback | null

  // Setters (update React state)
  setLobby: React.Dispatch<React.SetStateAction<LobbyEntry[]>>
  setTournaments: React.Dispatch<React.SetStateAction<Tournament[]>>
  setRatings: React.Dispatch<React.SetStateAction<Record<string, PlayerRating>>>
  setAvailability: React.Dispatch<React.SetStateAction<Record<string, AvailabilitySlot[]>>>
  setTrophies: React.Dispatch<React.SetStateAction<Trophy[]>>
  setBadges: React.Dispatch<React.SetStateAction<Badge[]>>
  setRatingHistory: React.Dispatch<React.SetStateAction<Record<string, RatingSnapshot[]>>>
  setFeedback: React.Dispatch<React.SetStateAction<MatchFeedback[]>>
  setEtiquetteScores: React.Dispatch<React.SetStateAction<Record<string, EtiquetteScore>>>
  setBroadcasts: React.Dispatch<React.SetStateAction<MatchBroadcast[]>>
  setMatchOffers: React.Dispatch<React.SetStateAction<MatchOffer[]>>
  setNotifications: React.Dispatch<React.SetStateAction<RallyNotification[]>>
  setMessages: React.Dispatch<React.SetStateAction<DirectMessage[]>>
  setReactions: React.Dispatch<React.SetStateAction<MatchReaction[]>>
  setReliabilityScores: React.Dispatch<React.SetStateAction<Record<string, ReliabilityScore>>>
  setPendingVictories: React.Dispatch<React.SetStateAction<PendingVictory[]>>
  setPendingFeedback: React.Dispatch<React.SetStateAction<PendingFeedback | null>>

  // Full refresh
  refresh: () => Promise<void>

  // Toast callback for user-visible error messages from store.ts
  showError: (message: string) => void
  showSuccess: (message: string) => void
}

let bridge: BridgeState | null = null

export function registerBridge(b: BridgeState): void {
  bridge = b
}

export function unregisterBridge(): void {
  bridge = null
}

export function isBridgeReady(): boolean {
  return bridge !== null
}

// ── Typed accessors for store.ts ──

// Lobby
export function bridgeGetLobby(): LobbyEntry[] {
  return bridge?.getLobby() ?? []
}
export function bridgeSetLobby(updater: React.SetStateAction<LobbyEntry[]>): void {
  bridge?.setLobby(updater)
}

// Tournaments
export function bridgeGetTournaments(): Tournament[] {
  return bridge?.getTournaments() ?? []
}
export function bridgeSetTournaments(updater: React.SetStateAction<Tournament[]>): void {
  bridge?.setTournaments(updater)
}

// Ratings
export function bridgeGetRatings(): Record<string, PlayerRating> {
  return bridge?.getRatings() ?? {}
}
export function bridgeSetRatings(updater: React.SetStateAction<Record<string, PlayerRating>>): void {
  bridge?.setRatings(updater)
}

// Availability
export function bridgeGetAvailability(): Record<string, AvailabilitySlot[]> {
  return bridge?.getAvailability() ?? {}
}
export function bridgeSetAvailability(updater: React.SetStateAction<Record<string, AvailabilitySlot[]>>): void {
  bridge?.setAvailability(updater)
}

// Trophies
export function bridgeGetTrophies(): Trophy[] {
  return bridge?.getTrophies() ?? []
}
export function bridgeSetTrophies(updater: React.SetStateAction<Trophy[]>): void {
  bridge?.setTrophies(updater)
}

// Badges
export function bridgeGetBadges(): Badge[] {
  return bridge?.getBadges() ?? []
}
export function bridgeSetBadges(updater: React.SetStateAction<Badge[]>): void {
  bridge?.setBadges(updater)
}

// Rating History
export function bridgeGetRatingHistory(): Record<string, RatingSnapshot[]> {
  return bridge?.getRatingHistory() ?? {}
}
export function bridgeSetRatingHistory(updater: React.SetStateAction<Record<string, RatingSnapshot[]>>): void {
  bridge?.setRatingHistory(updater)
}

// Feedback
export function bridgeGetFeedback(): MatchFeedback[] {
  return bridge?.getFeedback() ?? []
}
export function bridgeSetFeedback(updater: React.SetStateAction<MatchFeedback[]>): void {
  bridge?.setFeedback(updater)
}

// Etiquette
export function bridgeGetEtiquetteScores(): Record<string, EtiquetteScore> {
  return bridge?.getEtiquetteScores() ?? {}
}
export function bridgeSetEtiquetteScores(updater: React.SetStateAction<Record<string, EtiquetteScore>>): void {
  bridge?.setEtiquetteScores(updater)
}

// Broadcasts
export function bridgeGetBroadcasts(): MatchBroadcast[] {
  return bridge?.getBroadcasts() ?? []
}
export function bridgeSetBroadcasts(updater: React.SetStateAction<MatchBroadcast[]>): void {
  bridge?.setBroadcasts(updater)
}

// Match Offers
export function bridgeGetMatchOffers(): MatchOffer[] {
  return bridge?.getMatchOffers() ?? []
}
export function bridgeSetMatchOffers(updater: React.SetStateAction<MatchOffer[]>): void {
  bridge?.setMatchOffers(updater)
}

// Notifications
export function bridgeGetNotifications(): RallyNotification[] {
  return bridge?.getNotifications() ?? []
}
export function bridgeSetNotifications(updater: React.SetStateAction<RallyNotification[]>): void {
  bridge?.setNotifications(updater)
}

// Messages
export function bridgeGetMessages(): DirectMessage[] {
  return bridge?.getMessages() ?? []
}
export function bridgeSetMessages(updater: React.SetStateAction<DirectMessage[]>): void {
  bridge?.setMessages(updater)
}

// Reactions
export function bridgeGetReactions(): MatchReaction[] {
  return bridge?.getReactions() ?? []
}
export function bridgeSetReactions(updater: React.SetStateAction<MatchReaction[]>): void {
  bridge?.setReactions(updater)
}

// Reliability
export function bridgeGetReliabilityScores(): Record<string, ReliabilityScore> {
  return bridge?.getReliabilityScores() ?? {}
}
export function bridgeSetReliabilityScores(updater: React.SetStateAction<Record<string, ReliabilityScore>>): void {
  bridge?.setReliabilityScores(updater)
}

// Pending Victories
export function bridgeGetPendingVictories(): PendingVictory[] {
  return bridge?.getPendingVictories() ?? []
}
export function bridgeSetPendingVictories(updater: React.SetStateAction<PendingVictory[]>): void {
  bridge?.setPendingVictories(updater)
}

// Pending Feedback
export function bridgeGetPendingFeedback(): PendingFeedback | null {
  return bridge?.getPendingFeedback() ?? null
}
export function bridgeSetPendingFeedback(updater: React.SetStateAction<PendingFeedback | null>): void {
  bridge?.setPendingFeedback(updater)
}

// Refresh
export function bridgeRefresh(): Promise<void> {
  return bridge?.refresh() ?? Promise.resolve()
}

// ── User-facing error/success messages ──

// ── Cross-tab sync ──

/** Notify other tabs that data changed so they re-fetch from Supabase */
export function bridgeNotifyOtherTabs(): void {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('rally-data-sync')
      bc.postMessage('refresh')
      bc.close()
    }
  } catch { /* BroadcastChannel not available */ }
}

// ── User-facing error/success messages ──

export function bridgeShowError(message: string): void {
  if (bridge) {
    bridge.showError(message)
  } else {
    console.error('[Rally]', message)
  }
}

export function bridgeShowSuccess(message: string): void {
  if (bridge) {
    bridge.showSuccess(message)
  } else {
    console.log('[Rally]', message)
  }
}

/**
 * Mock providers for /dev/screens routes — bypasses Supabase entirely.
 * Renders real Rally components against seeded in-memory data so design
 * fidelity work can iterate without a live login.
 *
 * Imported only by /dev/screens routes. Stripped from production via
 * the dev-only route guard in main.tsx.
 */

import { ReactNode, useState, useEffect } from 'react'
import { AuthContext } from '../context/AuthContext'
import { RallyDataContext } from '../context/RallyDataProvider'
import { registerBridge, unregisterBridge } from '../storeBridge'
import {
  MOCK_PROFILE, MOCK_TOURNAMENT, MOCK_NOTIFICATIONS, MOCK_MESSAGES, MOCK_TROPHIES,
} from './mockData'

export function MockProviders({ children }: { children: ReactNode }) {
  // Mutable mock state so screens that call set* don't crash.
  const [tournaments, setTournaments] = useState([MOCK_TOURNAMENT])
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS)
  const [messages, setMessages] = useState(MOCK_MESSAGES)
  const mockAvailability = {
    'mock-pr': [{ day: 'saturday' as const, startHour: 9, endHour: 12 }],
  }

  // Register a minimal store bridge so non-React code in store.ts (e.g.
  // getAvailability) returns seeded data instead of empty defaults.
  useEffect(() => {
    registerBridge({
      getLobby: () => [],
      getTournaments: () => tournaments,
      getRatings: () => ({}),
      getAvailability: () => mockAvailability,
      getTrophies: () => MOCK_TROPHIES,
      getBadges: () => [],
      getRatingHistory: () => ({}),
      getFeedback: () => [],
      getEtiquetteScores: () => ({}),
      getBroadcasts: () => [],
      getMatchOffers: () => [],
      getNotifications: () => notifications,
      getMessages: () => messages,
      getReactions: () => [],
      getReliabilityScores: () => ({}),
      getPendingVictories: () => [],
      getPendingFeedback: () => null,
      setLobby: (() => {}) as any,
      setTournaments: setTournaments as any,
      setRatings: (() => {}) as any,
      setAvailability: (() => {}) as any,
      setTrophies: (() => {}) as any,
      setBadges: (() => {}) as any,
      setRatingHistory: (() => {}) as any,
      setFeedback: (() => {}) as any,
      setEtiquetteScores: (() => {}) as any,
      setBroadcasts: (() => {}) as any,
      setMatchOffers: (() => {}) as any,
      setNotifications: setNotifications as any,
      setMessages: setMessages as any,
      setReactions: (() => {}) as any,
      setReliabilityScores: (() => {}) as any,
      setPendingVictories: (() => {}) as any,
      setPendingFeedback: (() => {}) as any,
      refresh: async () => {},
      showError: () => {},
      showSuccess: () => {},
    })
    return () => unregisterBridge()
  }, [tournaments, notifications, messages])

  const auth = {
    user: { id: 'mock-pr', email: 'pascal@example.com' } as any,
    profile: MOCK_PROFILE,
    loading: false,
    signOut: async () => {},
    setProfile: () => {},
  }

  const rally = {
    lobby: [],
    tournaments,
    ratings: { 'mock-pr': { name: 'Pascal R', rating: 1050, matchesPlayed: 8 } },
    availability: {
      'mock-pr': [{ day: 'saturday' as const, startHour: 9, endHour: 12 }],
    },
    trophies: MOCK_TROPHIES,
    badges: [],
    ratingHistory: {},
    feedback: [],
    etiquetteScores: {},
    broadcasts: [],
    matchOffers: [],
    notifications,
    messages,
    reactions: [],
    reliabilityScores: {},
    pendingVictories: [],
    pendingFeedback: null,
    loading: false,
    hydrated: true,
    hydrationFailed: false,
    setLobby: () => {},
    setTournaments,
    setRatings: () => {},
    setAvailability: () => {},
    setTrophies: () => {},
    setBadges: () => {},
    setRatingHistory: () => {},
    setFeedback: () => {},
    setEtiquetteScores: () => {},
    setBroadcasts: () => {},
    setMatchOffers: () => {},
    setNotifications,
    setMessages,
    setReactions: () => {},
    setReliabilityScores: () => {},
    setPendingVictories: () => {},
    setPendingFeedback: () => {},
    refresh: async () => {},
  } as any

  return (
    <AuthContext.Provider value={auth}>
      <RallyDataContext.Provider value={rally}>
        {children}
      </RallyDataContext.Provider>
    </AuthContext.Provider>
  )
}

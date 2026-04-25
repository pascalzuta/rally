/**
 * Seed an in-memory conversation between the mock profile and Taylor Kim
 * so the messages-list and thread previews aren't empty. Idempotent.
 */

import { sendMessage, getConversation } from '../store'
import { registerBridge, isBridgeReady } from '../storeBridge'
import { MOCK_PROFILE } from './mockData'
import { DirectMessage } from '../types'

export const MOCK_OTHER_PLAYER_ID = 'taylor'
export const MOCK_OTHER_PLAYER_NAME = 'Taylor Kim'

let seeded = false
let standaloneMessages: DirectMessage[] = []

/**
 * If MockProviders hasn't registered a real bridge (or for isolated previews),
 * install a minimal in-memory bridge so message read/write helpers work.
 */
function ensureBridge(): void {
  if (isBridgeReady()) return
  registerBridge({
    getLobby: () => [],
    setLobby: () => {},
    getTournaments: () => [],
    setTournaments: () => {},
    getRatings: () => ({}),
    setRatings: () => {},
    getAvailability: () => ({}),
    setAvailability: () => {},
    getTrophies: () => [],
    setTrophies: () => {},
    getBadges: () => [],
    setBadges: () => {},
    getRatingHistory: () => ({}),
    setRatingHistory: () => {},
    getFeedback: () => [],
    setFeedback: () => {},
    getEtiquetteScores: () => ({}),
    setEtiquetteScores: () => {},
    getBroadcasts: () => [],
    setBroadcasts: () => {},
    getMatchOffers: () => [],
    setMatchOffers: () => {},
    getNotifications: () => [],
    setNotifications: () => {},
    getMessages: () => standaloneMessages,
    setMessages: (updater: any) => {
      standaloneMessages =
        typeof updater === 'function'
          ? (updater as (m: DirectMessage[]) => DirectMessage[])(standaloneMessages)
          : updater
    },
    getReactions: () => [],
    setReactions: () => {},
    getReliabilityScores: () => ({}),
    setReliabilityScores: () => {},
    getPendingVictories: () => [],
    setPendingVictories: () => {},
    getPendingFeedback: () => null,
    setPendingFeedback: () => {},
    showError: () => {},
    showSuccess: () => {},
  } as any)
}

export function seedMockConversation(): void {
  ensureBridge()
  if (seeded) return
  const existing = getConversation(MOCK_PROFILE.id, MOCK_OTHER_PLAYER_ID)
  if (existing.length === 0) {
    sendMessage(
      MOCK_PROFILE.id,
      MOCK_PROFILE.name,
      MOCK_OTHER_PLAYER_ID,
      MOCK_OTHER_PLAYER_NAME,
      'Hi Taylor',
    )
  }
  seeded = true
}

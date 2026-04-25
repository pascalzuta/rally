/**
 * Seeded mock data for /dev/screens — the design preview routes.
 * Stable, hardcoded shapes that satisfy each screen's render needs.
 * Not for production. Imported only by /dev/screens routes.
 */

import {
  PlayerProfile, Tournament, Match, MatchSchedule,
  RallyNotification, DirectMessage, Trophy,
} from '../types'

export const MOCK_PROFILE: PlayerProfile = {
  id: 'mock-pr',
  authId: 'mock-pr',
  email: 'pascal@example.com',
  name: 'Pascal R',
  county: 'mineral county, co',
  skillLevel: 'intermediate',
  gender: 'male',
  weeklyCap: 2,
  createdAt: '2026-04-01T00:00:00.000Z',
}

const PLAYERS = [
  { id: 'mock-pr', name: 'Pascal R' },
  { id: 'casey', name: 'Casey Brooks' },
  { id: 'taylor', name: 'Taylor Kim' },
  { id: 'alex', name: 'Alex Rivera' },
  { id: 'jordan', name: 'Jordan Chen' },
  { id: 'sam', name: 'Sam Patel' },
]

function mkSchedule(status: MatchSchedule['status'], slot?: { day: any; startHour: number; endHour: number }): MatchSchedule {
  return {
    status,
    proposals: [],
    confirmedSlot: slot ?? null,
    createdAt: '2026-04-20T00:00:00.000Z',
    escalationDay: 0,
    lastEscalation: '2026-04-20T00:00:00.000Z',
  }
}

function mkMatch(id: string, p1: string, p2: string, opts: Partial<Match> = {}): Match {
  return {
    id,
    round: 1,
    position: 0,
    player1Id: p1,
    player2Id: p2,
    score1: [],
    score2: [],
    winnerId: null,
    completed: false,
    ...opts,
  }
}

function generateRoundRobinMatches(): Match[] {
  const out: Match[] = []
  let n = 1
  for (let i = 0; i < PLAYERS.length; i++) {
    for (let j = i + 1; j < PLAYERS.length; j++) {
      out.push(
        mkMatch(`m${n++}`, PLAYERS[i].id, PLAYERS[j].id, {
          schedule: mkSchedule('unscheduled'),
        })
      )
    }
  }
  return out
}

export const MOCK_TOURNAMENT: Tournament = {
  id: 't-mock-1',
  name: 'Mineral County, CO Open #2',
  date: '2026-04-20',
  county: 'mineral county, co',
  format: 'round-robin',
  status: 'in-progress',
  createdAt: '2026-04-15T00:00:00.000Z',
  startsAt: '2026-04-20',
  players: PLAYERS,
  matches: generateRoundRobinMatches(),
}

export const MOCK_NOTIFICATIONS: RallyNotification[] = [
  { id: 'n1', recipientId: 'mock-pr', type: 'match_offer' as any, message: 'Ready to score', detail: 'vs Alex Rivera · Mineral County, CO Open #2', read: false, createdAt: '2026-04-24T10:00:00.000Z' },
  { id: 'n2', recipientId: 'mock-pr', type: 'match_offer' as any, message: 'Ready to score', detail: 'vs Jordan Chen · Mineral County, CO Open #2', read: false, createdAt: '2026-04-24T09:00:00.000Z' },
  { id: 'n3', recipientId: 'mock-pr', type: 'match_offer' as any, message: 'Ready to score', detail: 'vs Sam Patel · Mineral County, CO Open #2', read: false, createdAt: '2026-04-24T08:00:00.000Z' },
  { id: 'n4', recipientId: 'mock-pr', type: 'match_offer' as any, message: 'Ready to score', detail: 'vs Taylor Kim · Mineral County, CO Open #2', read: false, createdAt: '2026-04-24T07:00:00.000Z' },
  { id: 'n5', recipientId: 'mock-pr', type: 'offer_accepted' as any, message: 'Casey Brooks proposed a time', detail: 'vs Casey Brooks', read: false, createdAt: '2026-04-24T06:00:00.000Z' },
]

export const MOCK_MESSAGES: DirectMessage[] = [
  { id: 'msg1', senderId: 'mock-pr', senderName: 'Pascal R', recipientId: 'taylor', recipientName: 'Taylor Kim', text: 'Hi Taylor', createdAt: '2026-04-24T18:35:00.000Z', read: true },
]

export const MOCK_TROPHIES: Trophy[] = []

export const MOCK_RATING_HISTORY = [
  { rating: 1000, date: '2026-04-01' },
  { rating: 1015, date: '2026-04-10' },
  { rating: 1030, date: '2026-04-18' },
  { rating: 1050, date: '2026-04-24' },
]

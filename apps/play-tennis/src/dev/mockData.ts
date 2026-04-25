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
  matches: [
    mkMatch('m1', 'mock-pr', 'casey', { schedule: mkSchedule('confirmed', { day: 'saturday', startHour: 9, endHour: 11 }) }),
    mkMatch('m2', 'mock-pr', 'taylor', { schedule: mkSchedule('proposed') }),
    mkMatch('m3', 'mock-pr', 'alex', { schedule: mkSchedule('unscheduled') }),
    mkMatch('m4', 'casey', 'taylor', { schedule: mkSchedule('confirmed', { day: 'sunday', startHour: 10, endHour: 12 }) }),
    mkMatch('m5', 'casey', 'alex', { schedule: mkSchedule('unscheduled') }),
    mkMatch('m6', 'taylor', 'alex', { schedule: mkSchedule('escalated') }),
    mkMatch('m7', 'mock-pr', 'jordan', { schedule: mkSchedule('confirmed', { day: 'monday', startHour: 18, endHour: 20 }), completed: true, score1: [6,6], score2: [4,4], winnerId: 'mock-pr' }),
    mkMatch('m8', 'mock-pr', 'sam', { schedule: mkSchedule('confirmed', { day: 'tuesday', startHour: 18, endHour: 20 }), completed: true, score1: [6,6], score2: [3,2], winnerId: 'mock-pr' }),
  ],
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

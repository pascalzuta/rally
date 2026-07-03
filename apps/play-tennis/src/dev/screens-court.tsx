/**
 * /dev/screens — court negotiation batch (40–47).
 *
 * Renders the real CourtPanel against a mock Marin tournament in every
 * captain/venue/secured state, so design iteration doesn't require
 * seeding live matches. Picker opens live (local state) — click "Choose".
 *
 * Merged into MockScreens via `COURT_SCREENS`.
 */

import { ReactNode } from 'react'
import CourtPanel from '../components/CourtPanel'
import MatchActionCard from '../components/MatchActionCard'
import { MockProviders } from './MockProviders'
import type { Tournament, Match, MatchCourt } from '../types'

export interface ScreenDef {
  id: string
  label: string
  number: string
  render: () => JSX.Element
}

const ME = 'mock-pr'
const OPP = 'm-dana'

function marinMatch(court?: MatchCourt, overrides: Partial<Match> = {}): Match {
  return {
    id: 'm-court-1',
    round: 1,
    position: 0,
    player1Id: ME,
    player2Id: OPP,
    score1: [],
    score2: [],
    winnerId: null,
    completed: false,
    schedule: {
      status: 'confirmed',
      proposals: [],
      confirmedSlot: { day: 'saturday', startHour: 9, endHour: 11 },
      createdAt: '2026-06-20T00:00:00Z',
      escalationDay: 0,
      lastEscalation: '2026-06-20T00:00:00Z',
      court,
    },
    ...overrides,
  } as Match
}

function marinTournament(match: Match): Tournament {
  return {
    id: 't-court-mock',
    name: 'Marin County, CA Open #1',
    county: 'Marin County, CA',
    status: 'in-progress',
    players: [
      { id: ME, name: 'Pascal R' },
      { id: OPP, name: 'Dana Keller' },
    ],
    matches: [match],
    createdAt: '2026-06-15T00:00:00Z',
  } as unknown as Tournament
}

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div style={{
      width: 375, minHeight: 320, margin: '0 auto',
      background: 'var(--color-bg, #F6F7F9)', border: '1px solid var(--color-divider, #E5E7EB)',
      borderRadius: 24, overflow: 'hidden', padding: 16,
      boxShadow: '0 8px 32px rgba(11,13,16,0.10)',
    }}>
      {children}
    </div>
  )
}

/** Mimics the confirmed match card context the CourtPanel really renders in. */
function ConfirmedCardFrame({ court, overrides }: { court?: MatchCourt; overrides?: Partial<Match> }) {
  const match = marinMatch(court, overrides)
  const tournament = marinTournament(match)
  return (
    <PhoneFrame>
      <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.06))' }}>
        <div className="confirmed-slot">
          <span className="confirmed-day">Saturday</span>
          <span className="confirmed-time">9–11am</span>
        </div>
        <CourtPanel
          tournament={tournament}
          match={match}
          currentPlayerId={ME}
          onUpdated={() => {}}
        />
      </div>
    </PhoneFrame>
  )
}

const now = '2026-06-25T10:00:00Z'

export const COURT_SCREENS: ScreenDef[] = [
  {
    id: 'court-captain-walkon',
    number: '40',
    label: 'Court — captain, walk-on, unsecured',
    render: () => (
      <ConfirmedCardFrame court={{ venueId: 'boyle-park', captainId: ME, status: 'assigned', assignedBy: ME, assignedAt: now }} />
    ),
  },
  {
    id: 'court-captain-secured',
    number: '41',
    label: 'Court — captain, secured ✓',
    render: () => (
      <ConfirmedCardFrame court={{ venueId: 'boyle-park', captainId: ME, status: 'secured', assignedBy: ME, assignedAt: now, securedAt: now }} />
    ),
  },
  {
    id: 'court-noncaptain',
    number: '42',
    label: 'Court — opponent is captain',
    render: () => (
      <ConfirmedCardFrame court={{ venueId: 'albert-park', captainId: OPP, status: 'assigned', assignedBy: OPP, assignedAt: now }} />
    ),
  },
  {
    id: 'court-delegation-to-me',
    number: '43',
    label: 'Court — asked to take captain duty',
    render: () => (
      <ConfirmedCardFrame court={{
        venueId: 'larkspur-courts', captainId: OPP, status: 'assigned', assignedBy: OPP, assignedAt: now,
        negotiation: { id: 'neg1', kind: 'delegate', requestedBy: OPP, requestedTo: ME, requestedAt: now, status: 'pending' },
      }} />
    ),
  },
  {
    id: 'court-delegation-waiting',
    number: '44',
    label: 'Court — waiting on hand-off answer',
    render: () => (
      <ConfirmedCardFrame court={{
        venueId: 'larkspur-courts', captainId: ME, status: 'assigned', assignedBy: ME, assignedAt: now,
        negotiation: { id: 'neg2', kind: 'delegate', requestedBy: ME, requestedTo: OPP, requestedAt: now, status: 'pending' },
      }} />
    ),
  },
  {
    id: 'court-captain-paid',
    number: '45',
    label: 'Court — paid reserve-online (McInnis)',
    render: () => (
      <ConfirmedCardFrame court={{ venueId: 'mcinnis-park', captainId: ME, status: 'assigned', assignedBy: ME, assignedAt: now }} />
    ),
  },
  {
    id: 'court-no-venue',
    number: '46',
    label: 'Court — captain, no venue yet (opens picker)',
    render: () => (
      <ConfirmedCardFrame court={{ venueId: null, captainId: ME, status: 'assigned', assignedBy: ME, assignedAt: now }} />
    ),
  },
  {
    id: 'court-legacy-empty',
    number: '47',
    label: 'Court — legacy match, no captain',
    render: () => <ConfirmedCardFrame court={undefined} />,
  },
  {
    id: 'court-card-pick-court',
    number: '48',
    label: 'Collapsed card — "Pick a court" primary (variant A)',
    render: () => {
      const match = marinMatch(undefined)
      const tournament = marinTournament(match)
      return (
        <MockProviders>
          <PhoneFrame>
            <MatchActionCard
              tournament={tournament}
              match={match}
              currentPlayerId={ME}
              currentPlayerName="Pascal R"
              isExpanded={false}
              isMessaging={false}
              className="upnext-card"
              onToggleExpanded={() => {}}
              onToggleMessaging={() => {}}
              onUpdated={() => {}}
            />
          </PhoneFrame>
        </MockProviders>
      )
    },
  },
  {
    id: 'court-card-court-set',
    number: '49',
    label: 'Collapsed card — court set (summary line back)',
    render: () => {
      const match = marinMatch({ venueId: 'boyle-park', captainId: ME, status: 'secured', assignedBy: ME, assignedAt: now, securedAt: now })
      const tournament = marinTournament(match)
      return (
        <MockProviders>
          <PhoneFrame>
            <MatchActionCard
              tournament={tournament}
              match={match}
              currentPlayerId={ME}
              currentPlayerName="Pascal R"
              isExpanded={false}
              isMessaging={false}
              className="upnext-card"
              onToggleExpanded={() => {}}
              onToggleMessaging={() => {}}
              onUpdated={() => {}}
            />
          </PhoneFrame>
        </MockProviders>
      )
    },
  },
]

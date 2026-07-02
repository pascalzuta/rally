import { describe, it, expect } from 'vitest'
import './setup'
import { bridgeGetTournaments, bridgeSetTournaments } from '../storeBridge'
import {
  claimCaptain,
  requestCaptainDelegation,
  respondCaptainDelegation,
  setCourtSecured,
  setCourtVenue,
} from '../store'
import type { Tournament, MatchCourt } from '../types'

const P1 = 'p1'
const P2 = 'p2'

function seed(courtOverrides: Partial<MatchCourt> = {}): void {
  const court: MatchCourt = {
    venueId: null,
    captainId: P1,
    status: 'assigned',
    assignedBy: P1,
    assignedAt: '2026-01-01T00:00:00Z',
    ...courtOverrides,
  }
  const t = {
    id: 't1',
    name: 'Cup',
    county: 'Marin County, CA',
    status: 'in-progress',
    players: [{ id: P1, name: 'Pat One' }, { id: P2, name: 'Sam Two' }],
    matches: [{
      id: 'm1',
      round: 1,
      position: 0,
      player1Id: P1,
      player2Id: P2,
      score1: [],
      score2: [],
      winnerId: null,
      completed: false,
      schedule: {
        status: 'confirmed',
        proposals: [],
        confirmedSlot: { day: 'monday', startHour: 18, endHour: 20 },
        createdAt: '2026-01-01T00:00:00Z',
        escalationDay: 0,
        lastEscalation: '2026-01-01T00:00:00Z',
        court,
      },
    }],
    createdAt: '2026-01-01T00:00:00Z',
  } as unknown as Tournament
  bridgeSetTournaments([t])
}

function court(): MatchCourt {
  return bridgeGetTournaments()[0].matches[0].schedule!.court!
}

describe('court captain negotiation (store)', () => {
  it('T1 claim: the opponent volunteers and becomes captain immediately', async () => {
    seed()
    const res = await claimCaptain('t1', 'm1', P2)
    expect(res.ok).toBe(true)
    expect(court().captainId).toBe(P2)
  })

  it('T2 + T3 delegate then accept transfers captaincy and clears the negotiation', async () => {
    seed() // captain = P1
    await requestCaptainDelegation('t1', 'm1', P1)
    expect(court().negotiation?.status).toBe('pending')
    expect(court().negotiation?.requestedTo).toBe(P2)

    await respondCaptainDelegation('t1', 'm1', P2, 'accept')
    expect(court().captainId).toBe(P2)
    expect(court().negotiation).toBeUndefined()
    expect(court().handedOffAt).toBeTruthy()
  })

  it('T4 decline keeps the original captain and clears the negotiation', async () => {
    seed()
    await requestCaptainDelegation('t1', 'm1', P1)
    await respondCaptainDelegation('t1', 'm1', P2, 'decline')
    expect(court().captainId).toBe(P1)
    expect(court().negotiation).toBeUndefined()
  })

  it('T2 guard: a non-captain cannot delegate', async () => {
    seed() // captain = P1
    const res = await requestCaptainDelegation('t1', 'm1', P2)
    expect(res.ok).toBe(false)
    expect(court().negotiation).toBeUndefined()
  })

  it('T6 secure sets the flag; T8 venue change on a secured court resets it to assigned', async () => {
    seed()
    await setCourtSecured('t1', 'm1', P1, true)
    expect(court().status).toBe('secured')
    expect(court().securedAt).toBeTruthy()

    await setCourtVenue('t1', 'm1', P2, 'boyle-park')
    expect(court().venueId).toBe('boyle-park')
    expect(court().status).toBe('assigned') // must re-secure after venue change
    expect(court().securedAt).toBeUndefined()
  })

  it('T6 guard: only the captain can secure the court', async () => {
    seed() // captain = P1
    await setCourtSecured('t1', 'm1', P2, true)
    expect(court().status).toBe('assigned')
  })
})

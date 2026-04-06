import { useState, useCallback, useRef, useEffect } from 'react'
import { titleCase } from '../dateUtils'
import {
  seedLobby,
  getProfile,
  getTestProfiles,
  switchProfile,
  simulateRoundScores,
  autoConfirmAllSchedules,
  forceStartTournament,
  getSetupTournamentForCounty,
  escalateMatch,
  getTournament,
  simulateToFinal,
} from '../store'
import { PlayerProfile } from '../types'

interface Props {
  onProfileSwitch: (profile: PlayerProfile) => void
  activeTournamentId?: string | null
  onTournamentUpdated?: () => void
  onTournamentCreated?: (id: string) => void
}

type Status = { text: string; type: 'info' | 'success' | 'error' } | null

export default function DevTools({ onProfileSwitch, activeTournamentId, onTournamentUpdated, onTournamentCreated }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const [busy, setBusy] = useState(false)
  const statusTimer = useRef<ReturnType<typeof setTimeout>>()
  const panelRef = useRef<HTMLDivElement>(null)

  const profile = getProfile()
  const county = profile?.county ?? ''
  const testProfiles = county ? getTestProfiles(county) : []
  const setupTournament = county ? getSetupTournamentForCounty(county) : undefined

  function flash(text: string, type: 'info' | 'success' | 'error' = 'success') {
    clearTimeout(statusTimer.current)
    setStatus({ text, type })
    statusTimer.current = setTimeout(() => setStatus(null), 2500)
  }

  // Close panel on outside click
  useEffect(() => {
    if (!expanded) return
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setExpanded(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [expanded])

  const run = useCallback(async (fn: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    try {
      await fn()
    } catch {
      flash('Something went wrong', 'error')
    } finally {
      setBusy(false)
    }
  }, [busy])

  async function seed(count: number) {
    if (!county) { flash('Register first', 'error'); return }
    flash('Seeding...', 'info')
    const entries = await seedLobby(county, count)
    flash(`${entries.length} players in lobby`)
  }

  async function doForceStart() {
    if (!setupTournament) return
    const result = await forceStartTournament(setupTournament.id)
    if (result && result.status === 'in-progress') {
      flash(`Started with ${result.players.length} players`)
      onTournamentCreated?.(result.id)
    } else {
      flash('Could not start', 'error')
    }
  }

  async function doSimToFinal() {
    if (!profile) { flash('Register first', 'error'); return }
    const result = await simulateToFinal(profile.id, county)
    if (result) {
      flash('Ready — score the final!')
      onTournamentCreated?.(result.tournamentId)
      onTournamentUpdated?.()
    } else {
      flash('Could not simulate', 'error')
    }
  }

  async function doScoreRound() {
    if (!activeTournamentId) { flash('No tournament', 'error'); return }
    const result = await simulateRoundScores(activeTournamentId)
    if (!result) {
      flash('Could not simulate', 'error')
    } else if (result.status === 'completed') {
      flash('Tournament complete!')
    } else {
      const remaining = result.matches.filter(m => !m.completed && m.player1Id && m.player2Id).length
      flash(remaining > 0 ? `Scored! ${remaining} left` : 'All scored!')
    }
    onTournamentUpdated?.()
  }

  async function doConfirmAll() {
    if (!activeTournamentId) return
    const result = await autoConfirmAllSchedules(activeTournamentId)
    if (result) {
      const n = result.matches.filter(m => m.schedule?.status === 'confirmed').length
      flash(`${n} confirmed`)
    } else {
      flash('Nothing to confirm', 'info')
    }
    onTournamentUpdated?.()
  }

  async function doEscalateAll() {
    if (!activeTournamentId) return
    const t = getTournament(activeTournamentId)
    if (!t) { flash('No tournament', 'error'); return }
    const pending = t.matches.filter(
      m => m.schedule && m.schedule.status !== 'confirmed' && m.schedule.status !== 'resolved' && !m.completed
    )
    if (pending.length === 0) { flash('Nothing to escalate', 'info'); return }

    const counts = { escalated: 0, confirmed: 0, resolved: 0 }
    for (const match of pending) {
      const result = await escalateMatch(activeTournamentId, match.id)
      if (result) {
        const s = result.matches.find(m => m.id === match.id)?.schedule?.status
        if (s === 'confirmed') counts.confirmed++
        else if (s === 'resolved') counts.resolved++
        else counts.escalated++
      }
    }
    const parts: string[] = []
    if (counts.confirmed) parts.push(`${counts.confirmed} confirmed`)
    if (counts.escalated) parts.push(`${counts.escalated} escalated`)
    if (counts.resolved) parts.push(`${counts.resolved} resolved`)
    flash(parts.join(', ') || 'Done')
    onTournamentUpdated?.()
  }

  function doSwitch(tp: PlayerProfile) {
    switchProfile(tp)
    onProfileSwitch(tp)
    flash(`Now: ${tp.name}`)
  }

  // Collapsed: small floating pill
  if (!expanded) {
    return (
      <button
        className="devbar-pill"
        onClick={() => setExpanded(true)}
        aria-label="Open dev tools"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M5.5 3L2 8l3.5 5M10.5 3L14 8l-3.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    )
  }

  return (
    <div className="devbar" ref={panelRef}>
      {/* Header */}
      <div className="devbar-head">
        <span className="devbar-title">Dev</span>
        {profile && <span className="devbar-user">{profile.name.split(' ')[0]}</span>}
        <button className="devbar-close" onClick={() => setExpanded(false)} aria-label="Close">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Status toast */}
      {status && (
        <div className={`devbar-toast devbar-toast--${status.type}`}>{status.text}</div>
      )}

      {/* Actions grid */}
      <div className="devbar-grid">
        {/* Seed lobby */}
        <div className="devbar-group">
          <span className="devbar-group-label">Lobby {county && `· ${titleCase(county)}`}</span>
          <div className="devbar-row">
            <button className="devbar-btn" onClick={() => run(() => seed(1))} disabled={busy}>+1</button>
            <button className="devbar-btn" onClick={() => run(() => seed(3))} disabled={busy}>+3</button>
            <button className="devbar-btn" onClick={() => run(() => seed(5))} disabled={busy}>+5</button>
          </div>
        </div>

        {/* Tournament setup */}
        {setupTournament && (
          <div className="devbar-group">
            <span className="devbar-group-label">Setup · {setupTournament.players.length}p</span>
            <div className="devbar-row">
              <button className="devbar-btn devbar-btn--accent" onClick={() => run(doForceStart)} disabled={busy}>
                Start Now
              </button>
            </div>
          </div>
        )}

        {/* Quick sim */}
        <div className="devbar-group">
          <span className="devbar-group-label">Quick</span>
          <div className="devbar-row">
            <button className="devbar-btn devbar-btn--accent" onClick={() => run(doSimToFinal)} disabled={busy}>
              Sim to Final
            </button>
          </div>
        </div>

        {/* Active tournament actions */}
        {activeTournamentId && (
          <div className="devbar-group">
            <span className="devbar-group-label">Tournament</span>
            <div className="devbar-row">
              <button className="devbar-btn" onClick={() => run(doScoreRound)} disabled={busy}>Score</button>
              <button className="devbar-btn" onClick={() => run(doConfirmAll)} disabled={busy}>Confirm</button>
              <button className="devbar-btn" onClick={() => run(doEscalateAll)} disabled={busy}>Escalate</button>
            </div>
          </div>
        )}

        {/* Profile switcher */}
        {profile && testProfiles.length > 0 && (
          <div className="devbar-group">
            <span className="devbar-group-label">Profile</span>
            <div className="devbar-row devbar-row--wrap">
              {testProfiles.map(tp => (
                <button
                  key={tp.id}
                  className={`devbar-btn ${tp.id === profile.id ? 'devbar-btn--active' : ''}`}
                  onClick={() => doSwitch(tp)}
                >
                  {tp.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { titleCase } from '../dateUtils'
import { checkPushPermission, requestPushPermission, registerDeviceToken, hasActiveToken } from '../pushRegistration'
import {
  seedLobby,
  getProfile,
  getTestProfiles,
  switchProfile,
  simulateRoundScores,
  autoConfirmAllSchedules,
  forceStartTournament,
  getSetupTournamentForCounty,
  getAnySetupTournamentForCounty,
  getCountdownRemaining,
  escalateMatch,
  getTournament,
  simulateToFinal,
  TEST_COUNTY,
  tournamentStatusRank,
} from '../store'
import { getClient } from '../supabase'
import { PlayerProfile } from '../types'

// The test bar is pinned to TEST_COUNTY (Marin), but the signed-in user may be
// registered in a different county — so their local cache won't contain Marin's
// data and getTestProfiles() returns placeholder IDs. Resolve the real IDs
// straight from Supabase so switching into a test player always lands on the
// real Marin account, whether signed in or out.
//
// Tournament membership is the source of truth: App.tsx decides who's "in" a
// tournament by the id stored inside it, so we prefer the active tournament's
// id (in-progress > scheduling > setup > completed) and fall back to the lobby
// only for players not yet promoted into any tournament. A lobby placeholder id
// must never win over a real tournament member id.
async function fetchTestPlayerIds(county: string): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  if (!county) return result
  const client = getClient()
  if (!client) return result
  const normalized = county.toLowerCase()
  try {
    // Lobby = lowest priority (pre-tournament / setup phase).
    const { data: lobbyRows } = await client
      .from('lobby')
      .select('player_id, player_name')
      .eq('county', normalized)
    for (const row of lobbyRows ?? []) {
      if (row.player_id && row.player_name) {
        result.set(String(row.player_name).toLowerCase(), String(row.player_id))
      }
    }

    // Tournaments override the lobby. Apply worst-status first so the active
    // tournament is written last and wins (set() overwrites).
    const { data: tournRows } = await client
      .from('tournaments')
      .select('data')
      .eq('county', normalized)
    const tournaments = (tournRows ?? [])
      .map(r => r.data as { status?: string; players?: Array<{ id?: string; name?: string }> } | null)
      .filter((d): d is { status?: string; players?: Array<{ id?: string; name?: string }> } => !!d)
      .sort((a, b) => tournamentStatusRank(b.status ?? '') - tournamentStatusRank(a.status ?? ''))
    for (const t of tournaments) {
      for (const p of t.players ?? []) {
        if (p?.id && p?.name) result.set(String(p.name).toLowerCase(), String(p.id))
      }
    }
  } catch { /* ignore */ }
  return result
}

interface Props {
  onProfileSwitch: (profile: PlayerProfile) => void
  activeTournamentId?: string | null
  onTournamentUpdated?: () => void
  onTournamentCreated?: (id: string) => void
}

type Status = { text: string; type: 'info' | 'success' | 'error' } | null

function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export default function DevTools({ onProfileSwitch, activeTournamentId, onTournamentUpdated, onTournamentCreated }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const [busy, setBusy] = useState(false)
  const [, setTick] = useState(0)
  const statusTimer = useRef<ReturnType<typeof setTimeout>>()
  const panelRef = useRef<HTMLDivElement>(null)

  const profile = getProfile()
  // The test bar is pinned to a single canonical tournament (TEST_COUNTY) so
  // every seeded player and profile-switch target lives in the same place,
  // regardless of which county your real account is registered in.
  const county = TEST_COUNTY
  const [remotePlayerIds, setRemotePlayerIds] = useState<Map<string, string>>(new Map())

  // Always pull the Marin player IDs from Supabase while the panel is open —
  // even when signed in — so the switcher resolves real Marin accounts no
  // matter which county the current user belongs to.
  useEffect(() => {
    if (!county || !expanded) return
    let cancelled = false
    fetchTestPlayerIds(county).then(ids => { if (!cancelled) setRemotePlayerIds(ids) })
    return () => { cancelled = true }
  }, [profile?.id, county, expanded])

  const testProfiles = useMemo<PlayerProfile[]>(() => {
    if (!county) return []
    const base = getTestProfiles(county)
    // Prefer the real Supabase id (tournament-membership aware). Fall back to a
    // local-cache id, then drop players that resolve to neither — a placeholder
    // id would land on an account that's in no tournament.
    return base
      .map(p => {
        const realId = remotePlayerIds.get(p.name.toLowerCase())
        if (realId) return { ...p, id: realId }
        if (p.id.startsWith('test-')) return null
        return p
      })
      .filter((p): p is PlayerProfile => p !== null)
  }, [county, profile?.id, remotePlayerIds])

  // Prefer the user's own partition tournament so Skip-countdown starts a
  // tournament the user is a member of (Bracket tab filters by membership).
  // Fall back to any setup tournament in the county when the user isn't a
  // member — useful for testing on accounts that haven't joined.
  const setupTournament = county && profile
    ? (getSetupTournamentForCounty(county, profile.gender, profile.skillLevel)
       ?? getAnySetupTournamentForCounty(county))
    : undefined
  const setupIsMine = !!(profile && setupTournament?.players.some(p => p.id === profile.id))

  function flash(text: string, type: 'info' | 'success' | 'error' = 'success') {
    clearTimeout(statusTimer.current)
    setStatus({ text, type })
    statusTimer.current = setTimeout(() => setStatus(null), 2500)
  }

  // Live-tick the countdown label while panel is open
  useEffect(() => {
    if (!expanded || !setupTournament?.countdownStartedAt) return
    const id = setInterval(() => setTick(x => x + 1), 1000)
    return () => clearInterval(id)
  }, [expanded, setupTournament?.countdownStartedAt])

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
    // If the tournament we're about to start doesn't include the current
    // user, they'd land on an empty bracket (App.tsx filters activeTournament
    // by membership). Switch into a tournament player first so the bracket
    // is actually viewable.
    if (!setupIsMine) {
      const switchTarget = testProfiles.find(tp =>
        setupTournament.players.some(p => p.id === tp.id)
      )
      if (switchTarget) {
        switchProfile(switchTarget)
        onProfileSwitch(switchTarget)
      }
    }
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
        <span className="devbar-user">{profile ? profile.name.split(' ')[0] : 'Guest'}</span>
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

        {/* Diagnostic snapshot — shows profile id + tournament/players state */}
        <div className="devbar-group">
          <span className="devbar-group-label">Diag</span>
          <div className="devbar-row">
            <button className="devbar-btn" onClick={() => {
              const diag = (window as unknown as { __rallyDiag?: unknown }).__rallyDiag
              alert(JSON.stringify(diag, null, 2))
            }}>Show snapshot</button>
          </div>
        </div>

        {/* Tournament setup */}
        {setupTournament && (() => {
          const remaining = getCountdownRemaining(setupTournament)
          return (
            <div className="devbar-group">
              <span className="devbar-group-label">
                Setup · {setupTournament.players.length}p
                {remaining != null ? ` · ${formatCountdown(remaining)}` : ''}
                {!setupIsMine ? ' · not yours' : ''}
              </span>
              <div className="devbar-row">
                <button className="devbar-btn devbar-btn--accent" onClick={() => run(doForceStart)} disabled={busy}>
                  Skip countdown
                </button>
              </div>
            </div>
          )
        })()}

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

        {/* Push notifications */}
        {profile && (
          <div className="devbar-group">
            <span className="devbar-group-label">Push</span>
            <div className="devbar-row">
              <button className="devbar-btn" onClick={() => run(async () => {
                const perm = await checkPushPermission()
                const tokenOk = await hasActiveToken(profile.id)
                flash(`Permission: ${perm}, Token: ${tokenOk ? 'yes' : 'no'}`)
              })} disabled={busy}>Status</button>
              <button className="devbar-btn devbar-btn--accent" onClick={() => run(async () => {
                const result = await requestPushPermission()
                if (result === 'granted') {
                  const ok = await registerDeviceToken(profile.id)
                  flash(ok ? 'Token registered!' : 'Permission granted, token failed', ok ? 'success' : 'error')
                } else {
                  flash(`Permission: ${result}`, 'error')
                }
              })} disabled={busy}>Register</button>
            </div>
          </div>
        )}

        {/* Profile switcher — works signed-in AND signed-out (so you can
            re-enter as a seeded test player after signing out of your real account) */}
        {testProfiles.length > 0 && (
          <div className="devbar-group">
            <span className="devbar-group-label">
              Profile {!profile && county && `· ${titleCase(county)}`}
            </span>
            <div className="devbar-row devbar-row--wrap">
              {testProfiles.map(tp => (
                <button
                  key={tp.id}
                  className={`devbar-btn ${profile && tp.id === profile.id ? 'devbar-btn--active' : ''}`}
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

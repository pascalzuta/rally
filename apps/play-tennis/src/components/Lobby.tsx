import { useState, useEffect, useRef } from 'react'
import { getLobbyByCounty, joinLobby, leaveLobby, isInLobby, startTournamentFromLobby, getSetupTournamentForCounty, getCountdownRemaining, checkCountdownExpired, getSchedulingConfidence, createDoublesTournament } from '../store'
import { SYNC_EVENT } from '../sync'
import { PlayerProfile, LobbyEntry, Tournament } from '../types'

interface Props {
  profile: PlayerProfile
  autoJoin?: boolean
  onAutoJoinConsumed?: () => void
  onTournamentCreated: (id: string) => void
}

function getInviteLink(county: string): string {
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('join', county)
  return url.toString()
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`
}

export default function Lobby({ profile, autoJoin, onAutoJoinConsumed, onTournamentCreated }: Props) {
  const [entries, setEntries] = useState<LobbyEntry[]>([])
  const [joined, setJoined] = useState(false)
  const [setupTournament, setSetupTournament] = useState<Tournament | null>(null)
  const [countdown, setCountdown] = useState<string | null>(null)
  const [showShareSheet, setShowShareSheet] = useState(false)
  const [copied, setCopied] = useState(false)
  const [lobbyMode, setLobbyMode] = useState<'singles' | 'doubles'>('singles')
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoJoinedRef = useRef(false)
  const joiningRef = useRef(false)

  const isInSetupTournament = setupTournament?.players.some(p => p.id === profile.id) ?? false

  function refreshState() {
    setEntries(getLobbyByCounty(profile.county))
    setJoined(isInLobby(profile.id))
    checkForSetupTournament()
  }

  useEffect(() => {
    refreshState()
  }, [profile])

  // Listen for Supabase realtime sync updates
  useEffect(() => {
    function handleSync() {
      // Skip refresh while a join is in progress to prevent realtime from
      // overwriting the optimistic state set by handleJoin
      if (joiningRef.current) return
      refreshState()
    }
    window.addEventListener(SYNC_EVENT, handleSync)
    return () => window.removeEventListener(SYNC_EVENT, handleSync)
  }, [profile])

  // Auto-join when coming from "Start Tournament"
  useEffect(() => {
    if (autoJoin && !autoJoinedRef.current && !joined && !isInSetupTournament) {
      autoJoinedRef.current = true
      handleJoin()
      onAutoJoinConsumed?.()
    }
  }, [autoJoin, joined])

  // Countdown timer tick
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)

    if (!setupTournament) {
      setCountdown(null)
      return
    }

    function tick() {
      if (!setupTournament) return
      const remaining = getCountdownRemaining(setupTournament)
      if (remaining === null) {
        setCountdown(null)
        return
      }
      if (remaining <= 0) {
        checkCountdownExpired(setupTournament.id).then(started => {
          if (started && started.status === 'in-progress') {
            onTournamentCreated(started.id)
          }
        })
        setCountdown(null)
        if (timerRef.current) clearInterval(timerRef.current)
        return
      }
      setCountdown(formatCountdown(remaining))
    }

    tick()
    timerRef.current = setInterval(tick, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [setupTournament])

  function checkForSetupTournament() {
    const t = getSetupTournamentForCounty(profile.county)
    setSetupTournament(t ?? null)
  }

  async function handleJoin() {
    joiningRef.current = true
    try {
      const updated = await joinLobby(profile)
      setEntries(updated)
      setJoined(true)

      if (updated.length >= 6 || getSetupTournamentForCounty(profile.county)) {
        const tournament = await startTournamentFromLobby(profile.county)
        if (tournament) {
          if (tournament.status === 'in-progress') {
            onTournamentCreated(tournament.id)
            return
          }
          setSetupTournament(tournament)
          setEntries(getLobbyByCounty(profile.county))
          return
        }
      }
    } catch {
      // On error, re-read state from storage to stay in sync
      refreshState()
    } finally {
      joiningRef.current = false
      // Do one final refresh to pick up any remote changes that arrived during join
      refreshState()
    }
  }

  async function handleLeave() {
    await leaveLobby(profile.id)
    setEntries(getLobbyByCounty(profile.county))
    setJoined(false)
  }

  function handleShareInvite() {
    const link = getInviteLink(profile.county)
    const message = `I just started a Rally tennis tournament in ${profile.county}.\nJoin and compete: ${link}`
    if (navigator.share) {
      navigator.share({ title: 'Rally Tennis', text: message, url: link }).catch(() => {
        setShowShareSheet(true)
      })
    } else {
      setShowShareSheet(true)
    }
  }

  function handleCopyLink() {
    const link = getInviteLink(profile.county)
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleSMS() {
    const link = getInviteLink(profile.county)
    const message = `I just started a Rally tennis tournament in ${profile.county}.\nJoin and compete: ${link}`
    window.open(`sms:?body=${encodeURIComponent(message)}`, '_self')
    setShowShareSheet(false)
  }

  function handleWhatsApp() {
    const link = getInviteLink(profile.county)
    const message = `I just started a Rally tennis tournament in ${profile.county}.\nJoin and compete: ${link}`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
    setShowShareSheet(false)
  }

  // Doubles: available partners are other lobby entries (not self)
  const availablePartners = entries.filter(e => e.playerId !== profile.id)

  async function handleCreateDoubles() {
    if (!selectedPartnerId) return
    const partner = entries.find(e => e.playerId === selectedPartnerId)
    if (!partner) return
    const myEntry: LobbyEntry = { playerId: profile.id, playerName: profile.name, county: profile.county, joinedAt: new Date().toISOString() }
    const tournament = await createDoublesTournament(profile.county, [
      { player1: myEntry, player2: partner },
    ])
    if (tournament) {
      onTournamentCreated(tournament.id)
    }
  }

  const setupPlayers = setupTournament?.players ?? []
  const totalJoined = setupPlayers.length + entries.length
  const targetPlayers = 6
  const maxPlayers = 8
  const spotsLeft = setupTournament ? maxPlayers - setupPlayers.length : 0
  const isUserInvolved = joined || isInSetupTournament

  // Tournament ready state (6+ players in setup)
  const tournamentReady = setupTournament && setupPlayers.length >= targetPlayers

  // Progress bar color: gray (0), blue (1-5), green (6+)
  const progressPct = tournamentReady
    ? (setupPlayers.length / maxPlayers) * 100
    : Math.min((totalJoined / targetPlayers) * 100, 100)
  const progressColor = totalJoined === 0
    ? 'var(--color-text-muted)'
    : totalJoined >= targetPlayers
      ? 'var(--color-positive-primary)'
      : 'var(--color-accent-primary)'

  return (
    <div className="lobby-section">
      {/* Singles / Doubles Toggle */}
      <div className="lobby-mode-toggle">
        <button
          className={`lobby-mode-btn ${lobbyMode === 'singles' ? 'active' : ''}`}
          onClick={() => setLobbyMode('singles')}
        >
          Singles
        </button>
        <button
          className={`lobby-mode-btn ${lobbyMode === 'doubles' ? 'active' : ''}`}
          onClick={() => setLobbyMode('doubles')}
        >
          Doubles
        </button>
      </div>

      {/* Doubles Partner Selection */}
      {lobbyMode === 'doubles' && (
        <div className="card doubles-partner-card">
          <h3 className="doubles-partner-title">Choose Your Partner</h3>
          <p className="doubles-partner-desc">Select a player from the lobby to form a doubles team.</p>
          {availablePartners.length === 0 ? (
            <p className="doubles-partner-empty">No other players in lobby yet. Invite players to form a doubles team.</p>
          ) : (
            <div className="doubles-partner-list">
              {availablePartners.map(p => (
                <button
                  key={p.playerId}
                  className={`doubles-partner-item ${selectedPartnerId === p.playerId ? 'selected' : ''}`}
                  onClick={() => setSelectedPartnerId(selectedPartnerId === p.playerId ? null : p.playerId)}
                >
                  <span className="doubles-partner-avatar">{p.playerName[0]?.toUpperCase()}</span>
                  <span className="doubles-partner-name">{p.playerName}</span>
                  {selectedPartnerId === p.playerId && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="8" fill="var(--color-positive-primary)" />
                      <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
          {selectedPartnerId && (
            <button className="btn btn-primary doubles-confirm-btn" onClick={handleCreateDoubles}>
              Create Doubles Team
            </button>
          )}
        </div>
      )}

      {/* Tournament Formation Card (Singles mode) */}
      {lobbyMode === 'singles' && (
        <div className="card formation-hero">
          {tournamentReady ? (
            <>
              <h2 className="formation-title">{profile.county} Tournament<br />Starting</h2>
              <p className="formation-desc">Bracket is filling up. Tournament begins when the countdown ends.</p>
              {countdown && (
                <div className="formation-countdown">
                  <div className="formation-countdown-label">Starts in</div>
                  <div className="formation-countdown-timer">{countdown}</div>
                </div>
              )}
              <div className="formation-player-count">
                <span className="formation-count-mono">{setupPlayers.length}</span>
                <span className="formation-count-sep">/</span>
                <span className="formation-count-mono">{maxPlayers}</span>
                <span className="formation-count-label">players joined</span>
              </div>
              <div className="formation-progress-bar formation-progress-animated">
                <div className="formation-progress-fill" style={{ width: `${progressPct}%`, background: progressColor }} />
              </div>
              {spotsLeft > 0 && (
                <p className="formation-logic">{spotsLeft} spot{spotsLeft === 1 ? '' : 's'} remaining before bracket is full</p>
              )}
              <div className="formation-actions">
                <button className="btn btn-primary btn-large formation-cta-primary" onClick={!isUserInvolved ? handleJoin : handleShareInvite}>
                  {!isUserInvolved ? 'Join Tournament' : 'Invite Players'}
                </button>
                {isUserInvolved && spotsLeft > 0 && (
                  <button className="btn btn-large formation-cta-secondary" onClick={handleCopyLink}>
                    {copied ? 'Copied!' : 'Copy Invite Link'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <h2 className="formation-title">{profile.county} Tournament<br />Forming</h2>
              <p className="formation-desc">6-8 players compete in a local elimination tournament</p>
              <div className="formation-player-count">
                <span className="formation-count-mono">{totalJoined}</span>
                <span className="formation-count-sep">/</span>
                <span className="formation-count-mono">{targetPlayers}</span>
                <span className="formation-count-label">players joined</span>
              </div>
              <div className="formation-progress-bar formation-progress-animated">
                <div className="formation-progress-fill" style={{ width: `${progressPct}%`, background: progressColor }} />
              </div>
              <p className="formation-logic">When {targetPlayers} players join, a 48-hour countdown begins. Tournament starts when it ends or {maxPlayers} join.</p>
              <div className="formation-actions">
                {!isUserInvolved ? (
                  <button className="btn btn-primary btn-large formation-cta-primary" onClick={handleJoin}>Join Tournament</button>
                ) : (
                  <button className="btn btn-primary btn-large formation-cta-primary" onClick={handleShareInvite}>Invite Players</button>
                )}
                <button className="btn btn-large formation-cta-secondary" onClick={handleCopyLink}>
                  {copied ? 'Copied!' : 'Copy Invite Link'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Scheduling confidence preview */}
      {lobbyMode === 'singles' && isUserInvolved && totalJoined >= 4 && (() => {
        const confidence = getSchedulingConfidence(profile.county)
        if (confidence.playersWithAvailability < 2) return null
        return (
          <div className="scheduling-confidence">
            <div className="confidence-header">Scheduling confidence</div>
            <div className="confidence-bar">
              <div
                className={`confidence-fill confidence-fill--${confidence.label}`}
                style={{ width: `${confidence.score}%` }}
              />
            </div>
            <div className="confidence-value" style={{
              color: confidence.label === 'high' ? 'var(--color-positive-primary)' :
                     confidence.label === 'medium' ? 'var(--color-accent-primary, #2563EB)' :
                     'var(--color-warning-primary, #F59E0B)'
            }}>
              {confidence.score}%
            </div>
            <div className="confidence-label">
              {confidence.label === 'high' ? 'High -- most matches can be auto-scheduled' :
               confidence.label === 'medium' ? 'Medium -- some matches may need manual scheduling' :
               'Low -- many matches will need manual scheduling'}
            </div>
            <div className="confidence-footnote">
              Based on {confidence.playersWithAvailability} players' availability
            </div>
          </div>
        )
      })()}

      {/* Leave option for joined users */}
      {lobbyMode === 'singles' && isUserInvolved && !isInSetupTournament && (
        <div className="formation-leave">
          <button className="btn-link" onClick={handleLeave}>Leave tournament</button>
        </div>
      )}

      {/* Share Sheet Modal */}
      {showShareSheet && (
        <div className="modal-overlay" onClick={() => setShowShareSheet(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Invite Players</h2>
            <div className="share-options">
              <button className="btn btn-large" onClick={handleSMS}>
                Text Message
              </button>
              <button className="btn btn-large" onClick={handleWhatsApp}>
                WhatsApp
              </button>
              <button className="btn btn-large" onClick={() => { handleCopyLink(); setShowShareSheet(false) }}>
                {copied ? 'Copied!' : 'Copy Invite Link'}
              </button>
            </div>
            <div className="share-close">
              <button className="btn-link" onClick={() => setShowShareSheet(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

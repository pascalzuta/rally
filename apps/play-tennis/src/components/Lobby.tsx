import { useState, useEffect, useRef } from 'react'
import { titleCase } from '../dateUtils'
import { getLobbyByCounty, joinLobby, leaveLobby, isInLobby, startTournamentFromLobby, getSetupTournamentForCounty, getCountdownRemaining, checkCountdownExpired, getSchedulingConfidence } from '../store'
import { useRallyData } from '../context/RallyDataProvider'
import { PlayerProfile, LobbyEntry, Tournament } from '../types'
import { analytics } from '../analytics'

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
  // Lobby data comes from RallyDataProvider (Supabase-backed, realtime-updated)
  const { lobby: providerLobby, tournaments: providerTournaments } = useRallyData()
  const [entries, setEntries] = useState<LobbyEntry[]>([])
  const [joined, setJoined] = useState(false)
  const [setupTournament, setSetupTournament] = useState<Tournament | null>(null)
  const [countdown, setCountdown] = useState<string | null>(null)
  const [showShareSheet, setShowShareSheet] = useState(false)
  const [copied, setCopied] = useState(false)
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

  // React to Supabase realtime updates via provider (replaces SYNC_EVENT listener)
  useEffect(() => {
    if (joiningRef.current) return
    refreshState()
  }, [providerLobby, providerTournaments])

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
      analytics.track('LobbyJoined', { userId: profile.id, properties: { county: profile.county } })

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
    const message = `I just started a Rally tennis tournament in ${titleCase(profile.county)}.\nJoin and compete: ${link}`
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
    const message = `I just started a Rally tennis tournament in ${titleCase(profile.county)}.\nJoin and compete: ${link}`
    window.open(`sms:?body=${encodeURIComponent(message)}`, '_self')
    setShowShareSheet(false)
  }

  function handleWhatsApp() {
    const link = getInviteLink(profile.county)
    const message = `I just started a Rally tennis tournament in ${titleCase(profile.county)}.\nJoin and compete: ${link}`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
    setShowShareSheet(false)
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
      {/* Tournament Formation Card */}
      {(
        <div className="card formation-hero">
          <div className="card-status-row">
            <div className={`card-status-label ${tournamentReady ? 'card-status-label--green' : 'card-status-label--blue'}`}>
              {tournamentReady ? 'Starting Soon' : 'Tournament Forming'}
            </div>
            <div className="card-meta-chip">{tournamentReady ? `${setupPlayers.length}/${maxPlayers}` : `${totalJoined}/${targetPlayers}`}</div>
          </div>
          <div className="card-summary-main">
            <div className="card-title">{titleCase(profile.county)} Tournament {tournamentReady ? 'Starting' : 'Forming'}</div>
            <div className="card-supporting">
              {tournamentReady
                ? 'Bracket is filling up. Tournament begins when the countdown ends.'
                : '6–8 local players. Round-robin format. Rally handles the scheduling.'}
            </div>
          </div>
          {tournamentReady ? (
            <>
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
                  <div className="formation-choice-options">
                    <button className="btn btn-primary btn-large formation-cta-primary" onClick={handleJoin}>
                      <span className="formation-choice-label">Join Tournament</span>
                      <span className="formation-choice-desc">Get matched by location and rating</span>
                    </button>
                    <button className="btn btn-large formation-cta-secondary" onClick={handleShareInvite}>
                      <span className="formation-choice-label">Create Free Tournament</span>
                      <span className="formation-choice-desc">Invite 5+ friends and play together</span>
                    </button>
                  </div>
                ) : (
                  <button className="btn btn-primary btn-large formation-cta-primary" onClick={handleShareInvite}>Invite Players</button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Scheduling confidence preview */}
      {isUserInvolved && totalJoined >= 4 && (() => {
        const confidence = getSchedulingConfidence(profile.county)
        if (confidence.playersWithAvailability < 2) return null
        return (
          <div className="card scheduling-confidence">
            <div className="card-status-row">
              <div className="card-status-label card-status-label--slate">Scheduling Confidence</div>
              <div className="card-meta-chip">{confidence.score}%</div>
            </div>
            <div className="card-summary-main">
              <div className="card-title">How likely matches are to auto-schedule</div>
              <div className="card-supporting">Based on {confidence.playersWithAvailability} players&apos; saved availability.</div>
            </div>
            <div className="confidence-bar">
              <div
                className={`confidence-fill confidence-fill--${confidence.label}`}
                style={{ width: `${confidence.score}%` }}
              />
            </div>
            <div className="confidence-value" style={{
              color: confidence.label === 'high' ? 'var(--color-positive-primary)' :
                     confidence.label === 'medium' ? 'var(--color-accent-primary)' :
                     'var(--color-warning-primary)'
            }}>
              {confidence.score}%
            </div>
            <div className="confidence-label">
              {confidence.label === 'high' ? 'High -- most matches can be auto-scheduled' :
               confidence.label === 'medium' ? 'Medium -- some matches may need manual scheduling' :
               'Low -- many matches will need manual scheduling'}
            </div>
          </div>
        )
      })()}

      {/* Leave option for joined users */}
      {isUserInvolved && !isInSetupTournament && (
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

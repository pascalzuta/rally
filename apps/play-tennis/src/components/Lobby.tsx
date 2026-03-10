import { useState, useEffect, useRef } from 'react'
import { getLobbyByCounty, joinLobby, leaveLobby, isInLobby, startTournamentFromLobby, getPlayerRating, getSetupTournamentForCounty, getCountdownRemaining, checkCountdownExpired } from '../store'
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoJoinedRef = useRef(false)

  const isInSetupTournament = setupTournament?.players.some(p => p.id === profile.id) ?? false

  useEffect(() => {
    setEntries(getLobbyByCounty(profile.county))
    setJoined(isInLobby(profile.id))
    checkForSetupTournament()
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
        const started = checkCountdownExpired(setupTournament.id)
        if (started && started.status === 'in-progress') {
          onTournamentCreated(started.id)
        }
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

  function handleJoin() {
    const updated = joinLobby(profile)
    setEntries(updated)
    setJoined(true)

    if (updated.length >= 6 || getSetupTournamentForCounty(profile.county)) {
      const tournament = startTournamentFromLobby(profile.county)
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
  }

  function handleLeave() {
    leaveLobby(profile.id)
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

  const setupPlayers = setupTournament?.players ?? []
  const totalJoined = setupPlayers.length + entries.length
  const targetPlayers = 6
  const maxPlayers = 8
  const spotsLeft = setupTournament ? maxPlayers - setupPlayers.length : 0
  const isUserInvolved = joined || isInSetupTournament

  // Build combined player list for display
  const allPlayers: { id: string; name: string; isYou: boolean }[] = []
  for (const p of setupPlayers) {
    allPlayers.push({ id: p.id, name: p.name, isYou: p.id === profile.id })
  }
  for (const e of entries) {
    if (!allPlayers.some(p => p.id === e.playerId)) {
      allPlayers.push({ id: e.playerId, name: e.playerName, isYou: e.playerId === profile.id })
    }
  }

  // Tournament ready state (6+ players in setup)
  const tournamentReady = setupTournament && setupPlayers.length >= targetPlayers

  return (
    <div className="lobby-section">
      {/* Tournament Formation Hero Card */}
      <div className="card formation-hero">
        {tournamentReady ? (
          <>
            <h2 className="formation-hero-title">{profile.county} Tournament Ready</h2>
            <p className="formation-hero-subtitle">
              Bracket created. The tournament starts soon.
            </p>
            {countdown && (
              <div className="formation-countdown">
                <div className="formation-countdown-label">Starts in</div>
                <div className="formation-countdown-timer">{countdown}</div>
              </div>
            )}
            <div className="formation-progress-row">
              <span className="formation-progress-text">{setupPlayers.length} of {maxPlayers} players</span>
              {spotsLeft > 0 && <span className="formation-spots">{spotsLeft} spot{spotsLeft === 1 ? '' : 's'} left</span>}
            </div>
            <div className="formation-progress-bar">
              <div className="formation-progress-fill" style={{ width: `${(setupPlayers.length / maxPlayers) * 100}%` }} />
            </div>
            <div className="formation-actions">
              {spotsLeft > 0 && (
                <button className="btn btn-primary btn-large" onClick={handleShareInvite}>Invite Players</button>
              )}
            </div>
          </>
        ) : (
          <>
            <h2 className="formation-hero-title">{profile.county} Tournament Forming</h2>
            <p className="formation-hero-subtitle">
              {isUserInvolved
                ? `You started a tournament in ${profile.county}. Invite players to begin competing.`
                : `A tournament is forming in ${profile.county}. Join and invite players.`
              }
            </p>
            <div className="formation-progress-row">
              <span className="formation-progress-text">{totalJoined} of {targetPlayers} players joined</span>
            </div>
            <div className="formation-progress-bar">
              <div className="formation-progress-fill" style={{ width: `${Math.min((totalJoined / targetPlayers) * 100, 100)}%` }} />
            </div>
            <p className="formation-explainer">When {targetPlayers} players join, the tournament bracket is created automatically.</p>
            <div className="formation-actions">
              {!isUserInvolved && (
                <button className="btn btn-primary btn-large" onClick={handleJoin}>Join Tournament</button>
              )}
              {isUserInvolved && (
                <button className="btn btn-primary btn-large" onClick={handleShareInvite}>Invite Players</button>
              )}
              <button className="btn btn-large" onClick={handleCopyLink}>
                {copied ? 'Copied!' : 'Copy Invite Link'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Players Joining */}
      {allPlayers.length > 0 && (
        <div className="card formation-players">
          <h3 className="formation-players-title">Players Joining</h3>
          <ul className="player-list">
            {allPlayers.map((p, i) => {
              const r = getPlayerRating(p.name)
              return (
                <li key={p.id} className={p.isYou ? 'is-you' : ''}>
                  <span className="player-number">{i + 1}</span>
                  <span className="player-name">
                    {p.name}
                    {p.isYou && <span className="you-badge">You</span>}
                  </span>
                  <span className="player-rating">{Math.round(r.rating)}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

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

import { useState, useEffect, useRef } from 'react'
import { getLobbyByCounty, joinLobby, leaveLobby, isInLobby, startTournamentFromLobby, getPlayerRating, getSetupTournamentForCounty, getCountdownRemaining, checkCountdownExpired } from '../store'
import { PlayerProfile, LobbyEntry, Tournament } from '../types'

interface Props {
  profile: PlayerProfile
  onTournamentCreated: (id: string) => void
}

function getInviteLink(county: string): string {
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('join', county)
  return url.toString()
}

function handleInvite(county: string, playerName: string) {
  const link = getInviteLink(county)
  const message = `Join me for tennis in ${county}! ${link}`
  window.open(`sms:?body=${encodeURIComponent(message)}`, '_self')
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`
}

export default function Lobby({ profile, onTournamentCreated }: Props) {
  const [entries, setEntries] = useState<LobbyEntry[]>([])
  const [joined, setJoined] = useState(false)
  const [setupTournament, setSetupTournament] = useState<Tournament | null>(null)
  const [countdown, setCountdown] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setEntries(getLobbyByCounty(profile.county))
    setJoined(isInLobby(profile.id))
    checkForSetupTournament()
  }, [profile])

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
        // Timer expired — start the tournament
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

    // Try to create or join a tournament
    if (updated.length >= 6 || getSetupTournamentForCounty(profile.county)) {
      const tournament = startTournamentFromLobby(profile.county)
      if (tournament) {
        if (tournament.status === 'in-progress') {
          // 8 players reached — bracket generated, go to tournament
          onTournamentCreated(tournament.id)
          return
        }
        // Setup with countdown — show it
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

  const isInSetupTournament = setupTournament?.players.some(p => p.id === profile.id) ?? false
  const totalWaiting = entries.length + (setupTournament?.players.length ?? 0)
  const playersNeeded = Math.max(0, 6 - totalWaiting)
  const spotsLeft = setupTournament ? 8 - setupTournament.players.length : 0

  return (
    <div className="lobby-section">
      <div className="lobby-header">
        <h2>{profile.county}</h2>
        <span className="lobby-count">{totalWaiting} waiting</span>
      </div>

      {/* Countdown banner when tournament is in setup */}
      {setupTournament && countdown && (
        <div className="card countdown-banner">
          <div className="countdown-label">Tournament starts in</div>
          <div className="countdown-timer">{countdown}</div>
          <div className="countdown-detail">
            {setupTournament.players.length}/{8} players
            {spotsLeft > 0 && ` — ${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`}
          </div>
        </div>
      )}

      {/* Player lists in card */}
      {((setupTournament?.players.length ?? 0) > 0 || entries.length > 0) && (
        <div className="card">
          {setupTournament && setupTournament.players.length > 0 && (
            <ul className="player-list">
              {setupTournament.players.map(p => {
                const r = getPlayerRating(p.name)
                return (
                  <li key={p.id} className={p.id === profile.id ? 'is-you' : ''}>
                    <span className="player-name">{p.name}{p.id === profile.id && <span className="you-badge">You</span>}</span>
                    <span className="player-rating">{Math.round(r.rating)}</span>
                  </li>
                )
              })}
            </ul>
          )}
          {entries.length > 0 && (
            <ul className="player-list">
              {entries.map(e => {
                const r = getPlayerRating(e.playerName)
                return (
                  <li key={e.playerId} className={e.playerId === profile.id ? 'is-you' : ''}>
                    <span className="player-name">{e.playerName}{e.playerId === profile.id && <span className="you-badge">You</span>}</span>
                    <span className="player-rating">{Math.round(r.rating)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {/* Empty + hint */}
      {entries.length === 0 && !setupTournament && (
        <div className="card"><p className="subtle">No players waiting. Be the first to join!</p></div>
      )}

      {!setupTournament && playersNeeded > 0 && entries.length > 0 && (
        <p className="subtle lobby-hint">{playersNeeded} more {playersNeeded === 1 ? 'player' : 'players'} needed to start</p>
      )}

      {/* Actions */}
      <div className="lobby-action">
        {!joined && !isInSetupTournament ? (
          <button className="btn btn-primary btn-large" onClick={handleJoin}>
            Join Lobby
          </button>
        ) : !isInSetupTournament ? (
          <>
            <button className="btn btn-large" onClick={handleLeave}>
              Leave Lobby
            </button>
            {!setupTournament && playersNeeded > 0 && (
              <button
                className="btn btn-primary btn-large invite-btn"
                onClick={() => handleInvite(profile.county, profile.name)}
              >
                Invite Friends
              </button>
            )}
          </>
        ) : (
          <>
            {spotsLeft > 0 && (
              <button
                className="btn btn-primary btn-large invite-btn"
                onClick={() => handleInvite(profile.county, profile.name)}
              >
                Invite Friends ({spotsLeft} spot{spotsLeft === 1 ? '' : 's'} left)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

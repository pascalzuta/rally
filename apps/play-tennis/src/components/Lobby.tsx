import { useState, useEffect } from 'react'
import { getLobbyByCounty, joinLobby, leaveLobby, isInLobby, startTournamentFromLobby, getPlayerRating } from '../store'
import { PlayerProfile, LobbyEntry } from '../types'

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

export default function Lobby({ profile, onTournamentCreated }: Props) {
  const [entries, setEntries] = useState<LobbyEntry[]>([])
  const [joined, setJoined] = useState(false)

  useEffect(() => {
    setEntries(getLobbyByCounty(profile.county))
    setJoined(isInLobby(profile.id))
  }, [profile])

  function handleJoin() {
    const updated = joinLobby(profile)
    setEntries(updated)
    setJoined(true)

    // Auto-start if we have enough players
    if (updated.length >= 4) {
      const tournament = startTournamentFromLobby(profile.county)
      if (tournament) {
        onTournamentCreated(tournament.id)
        return
      }
    }
  }

  function handleLeave() {
    leaveLobby(profile.id)
    setEntries(getLobbyByCounty(profile.county))
    setJoined(false)
  }

  const playersNeeded = Math.max(0, 4 - entries.length)

  return (
    <div className="lobby-section">
      <div className="lobby-header">
        <h2>{profile.county}</h2>
        <span className="lobby-count">{entries.length} waiting</span>
      </div>

      {entries.length > 0 ? (
        <ul className="player-list">
          {entries.map(e => {
            const r = getPlayerRating(e.playerName)
            return (
              <li key={e.playerId} className={e.playerId === profile.id ? 'is-you' : ''}>
                <span className="player-name">
                  {e.playerName}
                  {e.playerId === profile.id && <span className="you-badge">You</span>}
                </span>
                <span className="player-rating">{Math.round(r.rating)}</span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="subtle">No players waiting. Be the first to join!</p>
      )}

      {playersNeeded > 0 && entries.length > 0 && (
        <p className="subtle lobby-hint">
          {playersNeeded} more {playersNeeded === 1 ? 'player' : 'players'} needed to start
        </p>
      )}

      <div className="lobby-action">
        {!joined ? (
          <button className="btn btn-primary btn-large" onClick={handleJoin}>
            Join Lobby
          </button>
        ) : (
          <>
            <button className="btn btn-large" onClick={handleLeave}>
              Leave Lobby
            </button>
            {playersNeeded > 0 && (
              <button
                className="btn btn-primary btn-large invite-btn"
                onClick={() => handleInvite(profile.county, profile.name)}
              >
                Invite Friends
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { seedLobby, getProfile, getTestProfiles, switchProfile, simulateRoundScores, autoConfirmAllSchedules } from '../store'
import { PlayerProfile } from '../types'

interface Props {
  onProfileSwitch: (profile: PlayerProfile) => void
  activeTournamentId?: string | null
  onTournamentUpdated?: () => void
}

export default function DevTools({ onProfileSwitch, activeTournamentId, onTournamentUpdated }: Props) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')

  const profile = getProfile()
  const county = profile?.county ?? ''
  const testProfiles = county ? getTestProfiles(county) : []

  function handleSeed(count: number) {
    if (!county) {
      setMessage('Register first to seed your county')
      return
    }
    const entries = seedLobby(county, count)
    setMessage(`Lobby now has ${entries.length} players in ${county}`)
    setTimeout(() => setMessage(''), 2000)
  }

  function handleSwitch(tp: PlayerProfile) {
    switchProfile(tp)
    onProfileSwitch(tp)
    setMessage(`Switched to ${tp.name}`)
    setTimeout(() => setMessage(''), 2000)
  }

  function handleAutoConfirm() {
    if (!activeTournamentId) return
    const result = autoConfirmAllSchedules(activeTournamentId)
    if (result) {
      const confirmed = result.matches.filter(m => m.schedule?.status === 'confirmed').length
      setMessage(`${confirmed} matches confirmed`)
    } else {
      setMessage('No matches to confirm')
    }
    onTournamentUpdated?.()
    setTimeout(() => setMessage(''), 2000)
  }

  function handleSimulate() {
    if (!activeTournamentId) {
      setMessage('No active tournament')
      return
    }
    const result = simulateRoundScores(activeTournamentId)
    if (!result) {
      setMessage('Could not simulate scores')
    } else if (result.status === 'completed') {
      setMessage('Tournament complete!')
    } else {
      const incomplete = result.matches.filter(m => !m.completed && m.player1Id && m.player2Id)
      setMessage(incomplete.length > 0 ? `Round scored! ${incomplete.length} matches remaining` : 'All matches scored!')
    }
    onTournamentUpdated?.()
    setTimeout(() => setMessage(''), 2000)
  }

  if (!open) {
    return (
      <button className="dev-toggle" onClick={() => setOpen(true)}>
        DEV
      </button>
    )
  }

  return (
    <div className="dev-panel">
      <div className="dev-header">
        <strong>Dev Tools</strong>
        <button className="btn-icon" onClick={() => setOpen(false)}>✕</button>
      </div>

      {message && <div className="dev-message">{message}</div>}

      <div className="dev-section">
        <div className="dev-label">Seed Lobby ({county || 'no county'})</div>
        <div className="dev-buttons">
          <button className="btn dev-btn" onClick={() => handleSeed(1)}>+1</button>
          <button className="btn dev-btn" onClick={() => handleSeed(3)}>+3</button>
          <button className="btn dev-btn" onClick={() => handleSeed(5)}>+5</button>
        </div>
      </div>

      {activeTournamentId && (
        <div className="dev-section">
          <div className="dev-label">Simulate</div>
          <div className="dev-buttons">
            <button className="btn dev-btn" onClick={handleSimulate}>Score Round</button>
            <button className="btn dev-btn" onClick={handleAutoConfirm}>Confirm All</button>
          </div>
        </div>
      )}

      {profile && (
        <div className="dev-section">
          <div className="dev-label">Switch Profile</div>
          <div className="dev-profiles">
            {testProfiles.map(tp => (
              <button
                key={tp.id}
                className={`btn dev-btn ${tp.name === profile.name ? 'active' : ''}`}
                onClick={() => handleSwitch(tp)}
              >
                {tp.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

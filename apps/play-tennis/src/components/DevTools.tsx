import { useState } from 'react'
import { seedLobby, getProfile, getTestProfiles, switchProfile } from '../store'
import { PlayerProfile } from '../types'

interface Props {
  onProfileSwitch: (profile: PlayerProfile) => void
}

export default function DevTools({ onProfileSwitch }: Props) {
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

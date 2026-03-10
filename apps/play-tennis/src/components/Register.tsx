import { useState } from 'react'
import { createProfile } from '../store'
import { PlayerProfile } from '../types'

interface Props {
  onRegistered: (profile: PlayerProfile) => void
  inviteCounty?: string | null
}

export default function Register({ onRegistered, inviteCounty }: Props) {
  const [name, setName] = useState('')
  const [county, setCounty] = useState(inviteCounty ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !county) return
    const profile = createProfile(name, county)
    onRegistered(profile)
  }

  return (
    <div className="screen">
      <header className="header">
        <h1>Play Tennis</h1>
      </header>

      <main className="content">
        <div className="register-hero">
          <div className="empty-icon">🎾</div>
          {inviteCounty ? (
            <p>You've been invited to play in {inviteCounty}!</p>
          ) : (
            <p>Join your local tennis community</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="form">
          <label className="field">
            <span className="field-label">Your Name</span>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. John Smith"
              autoFocus
            />
          </label>

          <label className="field">
            <span className="field-label">County</span>
            <input
              type="text"
              value={county}
              onChange={e => setCounty(e.target.value)}
              placeholder="e.g. Los Angeles County, CA"
              readOnly={!!inviteCounty}
            />
          </label>

          <button
            type="submit"
            className="btn btn-primary btn-large"
            disabled={!name.trim() || !county}
          >
            {inviteCounty ? 'Join & Play' : 'Join'}
          </button>
        </form>
      </main>
    </div>
  )
}

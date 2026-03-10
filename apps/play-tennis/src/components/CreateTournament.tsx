import { useState } from 'react'
import { createTournament } from '../store'
import { Tournament } from '../types'

interface Props {
  onBack: () => void
  onCreated: (id: string) => void
}

export default function CreateTournament({ onBack, onCreated }: Props) {
  const [name, setName] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [format, setFormat] = useState<Tournament['format']>('single-elimination')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const t = createTournament(name.trim(), date, format)
    onCreated(t.id)
  }

  return (
    <div className="screen">
      <header className="header">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <h1>New Tournament</h1>
      </header>

      <main className="content">
        <form onSubmit={handleSubmit} className="form">
          <label className="field">
            <span className="field-label">Tournament Name</span>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Summer Open 2026"
              autoFocus
            />
          </label>

          <label className="field">
            <span className="field-label">Date</span>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </label>

          <fieldset className="field">
            <span className="field-label">Format</span>
            <div className="radio-group">
              <label className={`radio-card ${format === 'single-elimination' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="format"
                  checked={format === 'single-elimination'}
                  onChange={() => setFormat('single-elimination')}
                />
                <strong>Knockout</strong>
                <span>Single elimination bracket</span>
              </label>
              <label className={`radio-card ${format === 'round-robin' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="format"
                  checked={format === 'round-robin'}
                  onChange={() => setFormat('round-robin')}
                />
                <strong>Round Robin</strong>
                <span>Everyone plays everyone</span>
              </label>
            </div>
          </fieldset>

          <button type="submit" className="btn btn-primary btn-large" disabled={!name.trim()}>
            Create Tournament
          </button>
        </form>
      </main>
    </div>
  )
}

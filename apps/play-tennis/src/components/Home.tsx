import { useState, useEffect } from 'react'
import { getTournaments, deleteTournament } from '../store'
import { Tournament } from '../types'

interface Props {
  onCreate: () => void
  onOpen: (id: string) => void
}

export default function Home({ onCreate, onOpen }: Props) {
  const [tournaments, setTournaments] = useState<Tournament[]>([])

  useEffect(() => {
    setTournaments(getTournaments())
  }, [])

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (confirm('Delete this tournament?')) {
      deleteTournament(id)
      setTournaments(getTournaments())
    }
  }

  const statusLabel = (s: Tournament['status']) =>
    s === 'setup' ? 'Setting up' : s === 'in-progress' ? 'In progress' : 'Completed'

  const statusClass = (s: Tournament['status']) =>
    s === 'setup' ? 'badge-setup' : s === 'in-progress' ? 'badge-live' : 'badge-done'

  return (
    <div className="screen">
      <header className="header">
        <h1>Play Tennis</h1>
      </header>

      <main className="content">
        {tournaments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎾</div>
            <p>No tournaments yet</p>
            <p className="subtle">Create your first tournament to get started</p>
          </div>
        ) : (
          <div className="card-list">
            {tournaments.map(t => (
              <div key={t.id} className="card" onClick={() => onOpen(t.id)}>
                <div className="card-top">
                  <h3>{t.name}</h3>
                  <span className={`badge ${statusClass(t.status)}`}>{statusLabel(t.status)}</span>
                </div>
                <div className="card-meta">
                  <span>{t.date}</span>
                  <span>{t.players.length} players</span>
                  <span>{t.format === 'single-elimination' ? 'Knockout' : 'Round Robin'}</span>
                </div>
                <button className="btn-icon delete-btn" onClick={(e) => handleDelete(e, t.id)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </main>

      <div className="bottom-action">
        <button className="btn btn-primary btn-large" onClick={onCreate}>
          + New Tournament
        </button>
      </div>
    </div>
  )
}

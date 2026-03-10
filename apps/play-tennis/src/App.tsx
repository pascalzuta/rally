import { useState, useEffect } from 'react'
import { getProfile, getTournamentsByCounty, getPlayerTournaments, deleteTournament, joinLobby } from './store'
import { PlayerProfile, Tournament } from './types'
import Register from './components/Register'
import Lobby from './components/Lobby'
import Profile from './components/Profile'
import TournamentView from './components/TournamentView'
import DevTools from './components/DevTools'
import './styles.css'

type Tab = 'play' | 'tournaments' | 'profile'

function getInviteCounty(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('join')
}

function clearInviteParam() {
  const url = new URL(window.location.href)
  url.searchParams.delete('join')
  window.history.replaceState({}, '', url.pathname)
}

export default function App() {
  const [profile, setProfile] = useState<PlayerProfile | null>(getProfile())
  const [activeTab, setActiveTab] = useState<Tab>('play')
  const [viewingTournamentId, setViewingTournamentId] = useState<string | null>(null)
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [inviteCounty] = useState<string | null>(getInviteCounty)
  const [tournamentRefresh, setTournamentRefresh] = useState(0)

  // Auto-join lobby when an existing user opens an invite link
  useEffect(() => {
    if (profile && inviteCounty) {
      joinLobby({ ...profile, county: inviteCounty })
      clearInviteParam()
      setActiveTab('play')
    }
  }, [profile, inviteCounty])

  useEffect(() => {
    if (profile) {
      refreshTournaments()
    }
  }, [profile, activeTab])

  function refreshTournaments() {
    if (!profile) return
    const county = getTournamentsByCounty(profile.county)
    const mine = getPlayerTournaments(profile.id)
    const map = new Map<string, Tournament>()
    for (const t of [...mine, ...county]) map.set(t.id, t)
    setTournaments(Array.from(map.values()).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ))
  }

  function handleRegistered(p: PlayerProfile) {
    if (inviteCounty) {
      // After registering via invite, auto-join the invite county's lobby
      joinLobby({ ...p, county: inviteCounty })
      clearInviteParam()
    }
    setProfile(p)
  }

  if (!profile) {
    return (
      <div className="app">
        <Register onRegistered={handleRegistered} inviteCounty={inviteCounty} />
        <DevTools onProfileSwitch={p => setProfile(p)} />
      </div>
    )
  }

  if (viewingTournamentId) {
    return (
      <div className="app">
        <TournamentView
          tournamentId={viewingTournamentId}
          currentPlayerId={profile.id}
          onBack={() => {
            setViewingTournamentId(null)
            refreshTournaments()
          }}
          key={tournamentRefresh}
        />
        <DevTools
          onProfileSwitch={p => { setProfile(p); setActiveTab('play') }}
          activeTournamentId={viewingTournamentId}
          onTournamentUpdated={() => setTournamentRefresh(r => r + 1)}
        />
      </div>
    )
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (confirm('Delete this tournament?')) {
      deleteTournament(id)
      refreshTournaments()
    }
  }

  const statusLabel = (s: Tournament['status']) =>
    s === 'setup' ? 'Setting up' : s === 'in-progress' ? 'In progress' : 'Completed'

  const statusClass = (s: Tournament['status']) =>
    s === 'setup' ? 'badge-setup' : s === 'in-progress' ? 'badge-live' : 'badge-done'

  return (
    <div className="app">
      <div className="screen">
        <header className="header">
          <h1>Play Tennis</h1>
        </header>

        <main className="content tab-content">
          {activeTab === 'play' && (
            <Lobby
              profile={profile}
              onTournamentCreated={id => setViewingTournamentId(id)}
            />
          )}

          {activeTab === 'tournaments' && (
            <>
              {tournaments.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🏆</div>
                  <p>No tournaments yet</p>
                  <p className="subtle">Join the lobby to start playing</p>
                </div>
              ) : (
                <div className="card-list">
                  {tournaments.map(t => (
                    <div key={t.id} className="card" onClick={() => setViewingTournamentId(t.id)}>
                      <div className="card-top">
                        <h3>{t.name}</h3>
                        <span className={`badge ${statusClass(t.status)}`}>{statusLabel(t.status)}</span>
                      </div>
                      <div className="card-meta">
                        <span>{t.date}</span>
                        <span>{t.players.length} players</span>
                        <span>{t.format === 'single-elimination' ? 'Knockout' : 'Round Robin'}</span>
                      </div>
                      {t.status === 'completed' && t.players.some(p => p.id === profile!.id) && (
                        <button className="btn-icon delete-btn" onClick={(e) => handleDelete(e, t.id)}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'profile' && (
            <Profile
              profile={profile}
              onLogout={() => setProfile(null)}
            />
          )}
        </main>

        <nav className="bottom-tabs">
          <button
            className={`bottom-tab ${activeTab === 'play' ? 'active' : ''}`}
            onClick={() => setActiveTab('play')}
          >
            <span className="tab-icon">🎾</span>
            <span className="tab-text">Play</span>
          </button>
          <button
            className={`bottom-tab ${activeTab === 'tournaments' ? 'active' : ''}`}
            onClick={() => setActiveTab('tournaments')}
          >
            <span className="tab-icon">🏆</span>
            <span className="tab-text">Tournaments</span>
          </button>
          <button
            className={`bottom-tab ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <span className="tab-icon">👤</span>
            <span className="tab-text">Profile</span>
          </button>
        </nav>
      </div>
      <DevTools onProfileSwitch={p => { setProfile(p); setActiveTab('play') }} />
    </div>
  )
}

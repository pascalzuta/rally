import { useState, useEffect } from 'react'
import { getProfile, getTournamentsByCounty, getPlayerTournaments, joinLobby, getTournament } from './store'
import { PlayerProfile, Tournament } from './types'
import Register from './components/Register'
import Home from './components/Home'
import BracketTab from './components/BracketTab'
import PlayNowTab from './components/PlayNowTab'
import Profile from './components/Profile'
import DevTools from './components/DevTools'
import './styles.css'

type Tab = 'home' | 'bracket' | 'playnow' | 'profile'

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
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [inviteCounty] = useState<string | null>(getInviteCounty)
  const [refreshKey, setRefreshKey] = useState(0)

  // Find the user's active tournament (prefer in-progress, then setup)
  const activeTournament = tournaments.find(t =>
    t.status === 'in-progress' && t.players.some(p => p.id === profile?.id)
  ) ?? tournaments.find(t =>
    t.status === 'setup' && t.players.some(p => p.id === profile?.id)
  ) ?? null

  // Auto-join lobby when an existing user opens an invite link
  useEffect(() => {
    if (profile && inviteCounty) {
      joinLobby({ ...profile, county: inviteCounty })
      clearInviteParam()
      setActiveTab('home')
    }
  }, [profile, inviteCounty])

  useEffect(() => {
    if (profile) refreshTournaments()
  }, [profile, activeTab, refreshKey])

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
        <DevTools
          onProfileSwitch={p => setProfile(p)}
          activeTournamentId={null}
          onTournamentUpdated={() => setRefreshKey(r => r + 1)}
          onTournamentCreated={id => {
            refreshTournaments()
            setActiveTab('bracket')
          }}
        />
      </div>
    )
  }

  return (
    <div className="app">
      <div className="screen">
        <header className="header">
          <h1>Play Tennis</h1>
        </header>

        <main className="content tab-content">
          {activeTab === 'home' && (
            <Home
              profile={profile}
              tournaments={tournaments}
              onTournamentCreated={id => {
                refreshTournaments()
                setActiveTab('bracket')
              }}
              onViewTournament={() => setActiveTab('bracket')}
              onViewMatch={(tournamentId, matchId) => {
                setActiveTab('bracket')
              }}
            />
          )}

          {activeTab === 'bracket' && (
            <BracketTab
              tournament={activeTournament}
              currentPlayerId={profile.id}
              onTournamentUpdated={() => setRefreshKey(r => r + 1)}
            />
          )}

          {activeTab === 'playnow' && (
            <PlayNowTab
              tournament={activeTournament}
              currentPlayerId={profile.id}
              currentPlayerName={profile.name}
              onMatchConfirmed={() => setRefreshKey(r => r + 1)}
            />
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
            className={`bottom-tab ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            <span className="tab-icon">🏠</span>
            <span className="tab-text">Home</span>
          </button>
          <button
            className={`bottom-tab ${activeTab === 'bracket' ? 'active' : ''}`}
            onClick={() => setActiveTab('bracket')}
          >
            <span className="tab-icon">🏆</span>
            <span className="tab-text">Bracket</span>
          </button>
          <button
            className={`bottom-tab ${activeTab === 'playnow' ? 'active' : ''}`}
            onClick={() => setActiveTab('playnow')}
          >
            <span className="tab-icon">⚡</span>
            <span className="tab-text">Play Now</span>
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
      <DevTools
        onProfileSwitch={p => { setProfile(p); setActiveTab('home') }}
        activeTournamentId={activeTournament?.id ?? null}
        onTournamentUpdated={() => setRefreshKey(r => r + 1)}
        onTournamentCreated={id => {
          refreshTournaments()
          setActiveTab('bracket')
        }}
      />
    </div>
  )
}

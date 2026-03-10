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
        <nav className="top-nav">
          <div className="top-nav-logo">RALLY</div>
        </nav>
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
        <nav className="top-nav">
          <div className="top-nav-logo" onClick={() => setActiveTab('home')} style={{ cursor: 'pointer' }}>RALLY</div>
          <div className="top-nav-actions">
            <button className="top-nav-icon" aria-label="Notifications">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </button>
            <button className="top-nav-icon" onClick={() => setActiveTab('profile')}>
              <div className="nav-avatar">{profile.name[0].toUpperCase()}</div>
            </button>
          </div>
        </nav>

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
          <button className={`bottom-tab ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
            <svg className="tab-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span className="tab-text">Home</span>
          </button>
          <button className={`bottom-tab ${activeTab === 'bracket' ? 'active' : ''}`} onClick={() => setActiveTab('bracket')}>
            <svg className="tab-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="7"/>
              <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
            </svg>
            <span className="tab-text">Bracket</span>
          </button>
          <button className={`bottom-tab ${activeTab === 'playnow' ? 'active' : ''}`} onClick={() => setActiveTab('playnow')}>
            <svg className="tab-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            <span className="tab-text">Play Now</span>
          </button>
          <button className={`bottom-tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
            <svg className="tab-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
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

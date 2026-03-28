import { useState, useEffect, useCallback, useRef } from 'react'
import { getProfile, getTournamentsByCounty, getPlayerTournaments, joinLobby, joinFriendTournament, getInviteTournamentCounty, getTournament, retroactivelyAwardTrophies, getPendingVictory, clearPendingVictory, getIncomingOffers, getNotifications, markNotificationsRead, getUnreadNotificationCount, getUnreadMessageCount, getMatchOffer, sendWelcomeMessage } from './store'
import Inbox from './components/Inbox'
import { PlayerProfile, Tournament, TrophyTier } from './types'
import { initSync, SYNC_EVENT } from './sync'
import { flushQueue } from './offline-queue'
import { analytics } from './analytics'
import { initSupabase, getSession, onAuthStateChange, fetchPlayerProfile } from './supabase'
import Register from './components/Register'
import DesktopGuestHomepage from './components/DesktopGuestHomepage'
import Home from './components/Home'
import BracketTab from './components/BracketTab'
import PlayNowTab from './components/PlayNowTab'
import Profile from './components/Profile'
import RatingPanel from './components/RatingPanel'
import Leaderboard from './components/Leaderboard'
import VictoryAnimation from './components/VictoryAnimation'
import Help from './components/Help'
import AnalyticsDashboard from './components/AnalyticsDashboard'
import DevTools from './components/DevTools'
import { ToastProvider } from './components/Toast'
import './styles.css'

type Tab = 'home' | 'bracket' | 'playnow' | 'profile' | 'leaderboard' | 'help' | 'analytics'

const VALID_TABS: Tab[] = ['home', 'bracket', 'playnow', 'profile', 'leaderboard', 'help', 'analytics']

function getTabFromHash(): Tab {
  const hash = window.location.hash.replace('#', '')
  return VALID_TABS.includes(hash as Tab) ? (hash as Tab) : 'home'
}

function getInviteCounty(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('join')
}

function getInviteTournamentCode(): string | null {
  // Check URL first, then sessionStorage (survives auth redirects)
  const params = new URLSearchParams(window.location.search)
  const fromUrl = params.get('tournament')
  if (fromUrl) {
    sessionStorage.setItem('rally-invite-tournament', fromUrl)
    return fromUrl
  }
  return sessionStorage.getItem('rally-invite-tournament')
}

function clearInviteParam() {
  const url = new URL(window.location.href)
  url.searchParams.delete('join')
  url.searchParams.delete('tournament')
  sessionStorage.removeItem('rally-invite-tournament')
  window.history.replaceState({}, '', url.pathname)
}

export default function App() {
  const [profile, setProfile] = useState<PlayerProfile | null>(getProfile())
  const [authLoading, setAuthLoading] = useState(!getProfile()) // only loading if no localStorage profile
  const [forceSignup, setForceSignup] = useState(false)
  const [activeTab, setActiveTabRaw] = useState<Tab>(getTabFromHash)
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [inviteCounty] = useState<string | null>(getInviteCounty)
  const [inviteTournamentCode] = useState<string | null>(getInviteTournamentCode)
  const [inviteTournamentCounty, setInviteTournamentCounty] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [autoJoinLobby, setAutoJoinLobby] = useState(false)
  const [victoryAnim, setVictoryAnim] = useState<{ tier: TrophyTier; name: string } | null>(null)
  const [focusMatchId, setFocusMatchId] = useState<string | null>(null)
  const [showNotifications, setShowNotifications] = useState(false)

  // Capture UTM attribution on mount
  useEffect(() => {
    analytics.captureAttribution()
  }, [])

  // Fire ViewContent when unauthenticated landing page is shown
  // Identify returning user when profile exists from localStorage
  useEffect(() => {
    if (!authLoading && !profile) {
      analytics.track('ViewContent')
    }
    if (profile) {
      sessionStorage.setItem('rally-analytics-uid', profile.id)
      analytics.track('PageView', { userId: profile.id, skipMeta: true })
    }
  }, [authLoading, profile])

  // Resolve tournament invite county for pre-filling registration
  useEffect(() => {
    if (inviteTournamentCode && !inviteTournamentCounty) {
      getInviteTournamentCounty(inviteTournamentCode).then(county => {
        if (county) setInviteTournamentCounty(county)
      })
    }
  }, [inviteTournamentCode])

  // On mount: if no localStorage profile, check for existing Supabase session
  // and try to restore profile from server (returning user on new device/cleared cache)
  useEffect(() => {
    if (profile) return // already have a profile, no need to check
    let cancelled = false

    async function tryRestoreSession() {
      try {
        initSupabase()
        const session = await getSession()
        if (!session || cancelled) { setAuthLoading(false); return }

        // Session exists — try to fetch profile from Supabase
        const existing = await fetchPlayerProfile(session.userId)
        if (cancelled) return

        if (existing) {
          // Returning user! Restore profile to localStorage
          const restored: PlayerProfile = {
            id: session.userId,
            authId: session.userId,
            email: session.email,
            name: existing.name,
            county: existing.county,
            skillLevel: (existing.skillLevel as PlayerProfile['skillLevel']) ?? undefined,
            gender: (existing.gender as PlayerProfile['gender']) ?? undefined,
            weeklyCap: (existing.weeklyCap as PlayerProfile['weeklyCap']) ?? 2,
            createdAt: existing.createdAt ?? new Date().toISOString(),
          }
          localStorage.setItem('play-tennis-profile', JSON.stringify(restored))
          analytics.identify(restored.id, { county: restored.county })
          analytics.track('ReturnVisit', { userId: restored.id })
          setProfile(restored)
        }
      } catch {
        // Network error — fall through to Register
      }
      if (!cancelled) setAuthLoading(false)
    }

    tryRestoreSession()
    return () => { cancelled = true }
  }, [])
  const [showInbox, setShowInbox] = useState(false)
  const [showRatingPanel, setShowRatingPanel] = useState(false)
  const notifWrapperRef = useRef<HTMLDivElement>(null)
  const inboxWrapperRef = useRef<HTMLDivElement>(null)

  // Navigate tabs via hash so browser back/forward buttons work
  const setActiveTab = useCallback((tab: Tab) => {
    setActiveTabRaw(tab)
    const currentHash = window.location.hash.replace('#', '')
    if (currentHash !== tab) {
      window.history.pushState({ tab }, '', `#${tab}`)
    }
  }, [])

  useEffect(() => {
    // Set initial hash if not present
    if (!window.location.hash) {
      window.history.replaceState({ tab: 'home' }, '', '#home')
    }
    const onHashChange = () => {
      setActiveTabRaw(getTabFromHash())
    }
    window.addEventListener('popstate', onHashChange)
    window.addEventListener('hashchange', onHashChange)
    return () => {
      window.removeEventListener('popstate', onHashChange)
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [])

  // Dismiss notification panel / inbox on outside click or Escape key
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (
        showNotifications &&
        notifWrapperRef.current &&
        !notifWrapperRef.current.contains(e.target as Node)
      ) {
        setShowNotifications(false)
      }
      if (
        showInbox &&
        inboxWrapperRef.current &&
        !inboxWrapperRef.current.contains(e.target as Node)
      ) {
        setShowInbox(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowNotifications(false)
        setShowInbox(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showNotifications, showInbox])

  // Count pending actions for notification badge
  const matchActionCount = tournaments.reduce((count, t) => {
    if (t.status !== 'in-progress') return count
    return count + t.matches.filter(m =>
      !m.completed &&
      (m.player1Id === profile?.id || m.player2Id === profile?.id) &&
      m.player1Id && m.player2Id &&
      (
        !m.schedule ||
        m.schedule.status === 'unscheduled' ||
        m.schedule.status === 'escalated' ||
        (m.schedule.activeRescheduleRequest && m.schedule.activeRescheduleRequest.requestedBy !== profile?.id) ||
        (m.schedule.status === 'confirmed' && m.schedule.confirmedSlot) ||
        (m.schedule.status === 'proposed' && m.schedule.proposals.some(
          p => p.status === 'pending' && p.proposedBy !== profile?.id
        ))
      )
    ).length
  }, 0)

  // Include incoming match offers and unread notifications in badge
  const incomingOfferCount = profile ? getIncomingOffers(profile.id).length : 0
  const unreadNotifCount = profile ? getUnreadNotificationCount(profile.id) : 0
  const unreadMsgCount = profile ? getUnreadMessageCount(profile.id) : 0
  const pendingActionCount = matchActionCount + incomingOfferCount + unreadNotifCount

  // Find the user's active tournament (prefer in-progress, then setup)
  const activeTournament = tournaments.find(t =>
    t.status === 'in-progress' && t.players.some(p => p.id === profile?.id)
  ) ?? tournaments.find(t =>
    t.status === 'setup' && t.players.some(p => p.id === profile?.id)
  ) ?? null

  // Auto-redirect to bracket when tournament starts (setup -> in-progress)
  const [lastTournamentStatus, setLastTournamentStatus] = useState<string | null>(null)
  const currentStatus = activeTournament?.status ?? null
  if (currentStatus && currentStatus !== lastTournamentStatus) {
    if (lastTournamentStatus === 'setup' && currentStatus === 'in-progress') {
      setActiveTab('bracket')
    }
    setLastTournamentStatus(currentStatus)
  }

  // Award trophies for any previously completed tournaments
  useEffect(() => {
    retroactivelyAwardTrophies()
  }, [])

  // Initialize Supabase sync when profile is available
  useEffect(() => {
    if (!profile) return
    getSession().then(() => initSync(profile.county))
    const handler = () => setRefreshKey(r => r + 1)
    window.addEventListener(SYNC_EVENT, handler)
    const onlineHandler = () => { flushQueue() }
    window.addEventListener('online', onlineHandler)
    return () => {
      window.removeEventListener(SYNC_EVENT, handler)
      window.removeEventListener('online', onlineHandler)
    }
  }, [profile?.id])

  // Auto-join when an existing user opens an invite link (county or tournament)
  useEffect(() => {
    if (profile && inviteTournamentCode) {
      joinFriendTournament(inviteTournamentCode, profile).then(() => {
        clearInviteParam()
        setActiveTab('home')
        setRefreshKey(r => r + 1)
      })
    } else if (profile && inviteCounty) {
      joinLobby({ ...profile, county: inviteCounty })
      clearInviteParam()
      setActiveTab('home')
    }
  }, [profile, inviteCounty, inviteTournamentCode])

  useEffect(() => {
    if (profile) refreshTournaments()
  }, [profile, activeTab, refreshKey])

  function refreshTournaments() {
    if (!profile) return
    const county = getTournamentsByCounty(profile.county)
    const mine = getPlayerTournaments(profile.id)
    const map = new Map<string, Tournament>()
    for (const t of [...mine, ...county]) map.set(t.id, t)
    const sorted = Array.from(map.values()).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    // Check for pending victory animation
    const pending = getPendingVictory(profile.id)
    if (pending) {
      setVictoryAnim({ tier: pending.tier, name: pending.tournamentName })
      clearPendingVictory(profile.id)
    }

    setTournaments(sorted)
  }

  async function handleRegistered(p: PlayerProfile) {
    if (inviteTournamentCode) {
      // After registering via tournament invite, auto-join the friend tournament
      await joinFriendTournament(inviteTournamentCode, p)
      clearInviteParam()
    } else if (inviteCounty) {
      // After registering via invite, auto-join the invite county's lobby
      await joinLobby({ ...p, county: inviteCounty })
      clearInviteParam()
    }
    sendWelcomeMessage(p.id)
    setProfile(p)
    setActiveTab('home')
  }

  // Show a brief loading state while checking for existing session
  if (authLoading) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', opacity: 0.6 }}>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>Loading...</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    if (!forceSignup) {
      return (
        <div className="app app-desktop-guest">
          <DesktopGuestHomepage onGetStarted={() => setForceSignup(true)} />
          <DevTools
            onProfileSwitch={p => setProfile(p)}
            activeTournamentId={null}
            onTournamentUpdated={() => setRefreshKey(r => r + 1)}
            onTournamentCreated={id => {
              refreshTournaments()
              setActiveTab('home')
            }}
          />
        </div>
      )
    }

    return (
      <div className="app">
        <nav className="top-nav top-nav-register">
          <div className="top-nav-logo top-nav-logo-large">
              <img className="rally-logo" height="45" src="/rally-logo.svg" alt="Rally" />
            </div>
        </nav>
        <Register onRegistered={handleRegistered} inviteCounty={inviteCounty ?? inviteTournamentCounty} />
        <DevTools
          onProfileSwitch={p => setProfile(p)}
          activeTournamentId={null}
          onTournamentUpdated={() => setRefreshKey(r => r + 1)}
          onTournamentCreated={id => {
            refreshTournaments()
            setActiveTab('home')
          }}
        />
      </div>
    )
  }

  return (
    <ToastProvider>
    <div className="app">
      <div className="screen">
        <nav className="top-nav">
          <div className="top-nav-logo" onClick={() => setActiveTab('home')} style={{ cursor: 'pointer' }}>
              <img className="rally-logo" height="34" src="/rally-logo.svg" alt="Rally" style={{ position: 'relative', left: 4, top: 1 }} />
            </div>
          <div className="top-nav-actions">
            <button className="top-nav-icon" aria-label="Rating & Trophies" onClick={() => { setShowRatingPanel(!showRatingPanel); setShowInbox(false); setShowNotifications(false) }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9H3V4h3"/>
                <path d="M18 9h3V4h-3"/>
                <path d="M6 4h12v6c0 3.31-2.69 6-6 6s-6-2.69-6-6V4z"/>
                <path d="M12 16v2"/>
                <path d="M8 22h8"/>
                <path d="M8 22v-4"/>
                <path d="M16 22v-4"/>
              </svg>
            </button>
            <button className="top-nav-icon inbox-icon-btn" aria-label="Messages" onClick={() => { setShowInbox(!showInbox); setShowNotifications(false); setShowRatingPanel(false) }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M22 7l-10 7L2 7" />
              </svg>
              {unreadMsgCount > 0 && <span className="inbox-unread-badge">{unreadMsgCount > 9 ? '9+' : unreadMsgCount}</span>}
            </button>
            <div className="notif-wrapper" ref={notifWrapperRef}>
              <button className="top-nav-icon" aria-label="Notifications" onClick={() => { setShowNotifications(!showNotifications); setShowInbox(false); setShowRatingPanel(false) }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {pendingActionCount > 0 && (
                  <span className="notif-badge">{pendingActionCount}</span>
                )}
              </button>
              {showNotifications && (() => {
                const rallyNotifs = profile ? getNotifications(profile.id).slice(0, 10) : []
                if (profile) markNotificationsRead(profile.id)
                return (
                  <div className="notif-dropdown">
                    <div className="notif-header">Notifications</div>
                    {pendingActionCount === 0 && rallyNotifs.length === 0 ? (
                      <div className="notif-empty">All caught up!</div>
                    ) : (
                      <div className="notif-list">
                        {/* Rally notifications (offers, acceptances, etc.) */}
                        {rallyNotifs.map(n => {
                          const icon = n.type === 'match_offer' ? '📩'
                            : n.type === 'offer_accepted' ? '✅'
                            : n.type === 'offer_declined' ? '✗'
                            : n.type === 'offer_expired' ? '⏱'
                            : '🎾'
                          return (
                            <button
                              key={n.id}
                              className={`notif-item ${!n.read ? 'notif-unread' : ''}`}
                              onClick={() => {
                                if (n.type === 'match_offer') {
                                  setActiveTab('playnow')
                                } else if (n.type === 'offer_accepted') {
                                  if (n.relatedOfferId) {
                                    const offer = getMatchOffer(n.relatedOfferId)
                                    if (offer?.matchId) {
                                      setFocusMatchId(offer.matchId)
                                    }
                                  }
                                  setActiveTab('bracket')
                                }
                                setShowNotifications(false)
                              }}
                            >
                              <span className="notif-icon">{icon}</span>
                              <div className="notif-content">
                                <div className="notif-action">{n.message}</div>
                                {n.detail && <div className="notif-opponent">{n.detail}</div>}
                              </div>
                            </button>
                          )
                        })}
                        {/* Match action notifications */}
                        {tournaments.filter(t => t.status === 'in-progress').flatMap(t =>
                          t.matches.filter(m =>
                            !m.completed &&
                            (m.player1Id === profile?.id || m.player2Id === profile?.id) &&
                            m.player1Id && m.player2Id
                          ).map(m => {
                            const opponentId = m.player1Id === profile?.id ? m.player2Id : m.player1Id
                            const opponentName = t.players.find(p => p.id === opponentId)?.name ?? 'Opponent'
                            let action = ''
                            let icon = ''
                            let urgency = ''
                            if (m.schedule?.status === 'escalated') { action = 'Escalated — respond now'; icon = '⚠️'; urgency = 'notif-urgent' }
                            else if (m.schedule?.status === 'confirmed') { action = 'Ready to score'; icon = '🎾'; urgency = 'notif-ready' }
                            else if (m.schedule?.status === 'proposed' && m.schedule.proposals.some(p => p.status === 'pending' && p.proposedBy !== profile?.id)) { action = `${opponentName} proposed a time — tap to confirm`; icon = '📩'; urgency = 'notif-pending' }
                            else { action = 'Needs scheduling'; icon = '📅'; urgency = '' }
                            return (
                              <button
                                key={`${t.id}-${m.id}`}
                                className={`notif-item ${urgency}`}
                                onClick={() => {
                                  setFocusMatchId(m.id)
                                  setActiveTab('bracket')
                                  setShowNotifications(false)
                                }}
                              >
                                <span className="notif-icon">{icon}</span>
                                <div className="notif-content">
                                  <div className="notif-action">{action}</div>
                                  <div className="notif-opponent">vs {opponentName}</div>
                                  <div className="notif-time">{t.name}</div>
                                </div>
                              </button>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </nav>

        <main className="content tab-content">
          {activeTab === 'home' && (
            <Home
              profile={profile}
              tournaments={tournaments}
              autoJoin={autoJoinLobby}
              onAutoJoinConsumed={() => setAutoJoinLobby(false)}
              onTournamentCreated={id => {
                refreshTournaments()
                setActiveTab('bracket')
              }}
              onViewTournament={() => setActiveTab('bracket')}
              onViewMatch={(tournamentId, matchId) => {
                setFocusMatchId(matchId)
                setActiveTab('bracket')
              }}
              onViewLeaderboard={() => setActiveTab('leaderboard')}
              onViewOffers={() => setActiveTab('playnow')}
              onDataChanged={() => setRefreshKey(r => r + 1)}
              onJoinLobby={() => setAutoJoinLobby(true)}
              onSetAvailability={() => setActiveTab('profile')}
              onFindMatch={() => setActiveTab('bracket')}
              onLogout={() => setProfile(null)}
            />
          )}

          {activeTab === 'bracket' && (
            <BracketTab
              tournament={activeTournament}
              currentPlayerId={profile.id}
              currentPlayerName={profile.name}
              onTournamentUpdated={() => setRefreshKey(r => r + 1)}
              focusMatchId={focusMatchId}
              onFocusConsumed={() => setFocusMatchId(null)}
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

          {activeTab === 'leaderboard' && (
            <Leaderboard
              county={profile.county}
              currentPlayerId={profile.id}
              currentPlayerName={profile.name}
              onBack={() => setActiveTab('home')}
            />
          )}

          {activeTab === 'profile' && (
            <Profile
              profile={profile}
              onLogout={() => setProfile(null)}
              onNavigate={(tab) => {
                if (tab === 'home') setAutoJoinLobby(true)
                setActiveTab(tab)
              }}
              onViewHelp={() => setActiveTab('help')}
            />
          )}

          {activeTab === 'help' && (
            <Help onBack={() => setActiveTab('profile')} />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsDashboard onBack={() => setActiveTab('home')} />
          )}
        </main>
      </div>

        <nav className="bottom-tabs">
          <button className={`bottom-tab ${activeTab === 'home' || activeTab === 'leaderboard' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
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
            <span className="tab-text">Tournament</span>
          </button>
          <button className={`bottom-tab ${activeTab === 'playnow' ? 'active' : ''}`} onClick={() => setActiveTab('playnow')}>
            <svg className="tab-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            <span className="tab-text">Quick Play</span>
          </button>
          <button className={`bottom-tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
            <svg className="tab-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span className="tab-text">Availability</span>
          </button>
        </nav>
      {showInbox && (
        <div ref={inboxWrapperRef}>
        <Inbox
          currentPlayerId={profile.id}
          currentPlayerName={profile.name}
          county={profile.county}
          tournaments={tournaments}
          onClose={() => setShowInbox(false)}
        />
        </div>
      )}
      {showRatingPanel && (
        <RatingPanel
          profile={profile}
          onClose={() => setShowRatingPanel(false)}
          onViewLeaderboard={() => { setShowRatingPanel(false); setActiveTab('leaderboard') }}
        />
      )}
      <DevTools
        onProfileSwitch={p => { setProfile(p); setActiveTab('home') }}
        activeTournamentId={activeTournament?.id ?? null}
        onTournamentUpdated={() => setRefreshKey(r => r + 1)}
        onTournamentCreated={id => {
          refreshTournaments()
          setActiveTab('bracket')
        }}
      />
      {victoryAnim && (
        <VictoryAnimation
          tier={victoryAnim.tier}
          tournamentName={victoryAnim.name}
          onDismiss={() => setVictoryAnim(null)}
        />
      )}
    </div>
    </ToastProvider>
  )
}

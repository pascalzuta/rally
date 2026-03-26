import { useState, useEffect, useCallback, useRef } from 'react'
import { getProfile, getTournamentsByCounty, getPlayerTournaments, joinLobby, getTournament, retroactivelyAwardTrophies, getPendingVictory, clearPendingVictory, getIncomingOffers, getNotifications, markNotificationsRead, getUnreadNotificationCount, getUnreadMessageCount, getMatchOffer, sendWelcomeMessage } from './store'
import Inbox from './components/Inbox'
import { PlayerProfile, Tournament, TrophyTier } from './types'
import { initSync, SYNC_EVENT } from './sync'
import { flushQueue } from './offline-queue'
import { initSupabase, getSession, onAuthStateChange, fetchPlayerProfile } from './supabase'
import Register from './components/Register'
import Home from './components/Home'
import BracketTab from './components/BracketTab'
import PlayNowTab from './components/PlayNowTab'
import Profile from './components/Profile'
import RatingPanel from './components/RatingPanel'
import Leaderboard from './components/Leaderboard'
import VictoryAnimation from './components/VictoryAnimation'
import Help from './components/Help'
import DevTools from './components/DevTools'
import { ToastProvider } from './components/Toast'
import './styles.css'

type Tab = 'home' | 'bracket' | 'playnow' | 'profile' | 'leaderboard' | 'help'

const VALID_TABS: Tab[] = ['home', 'bracket', 'playnow', 'profile', 'leaderboard', 'help']

function getTabFromHash(): Tab {
  const hash = window.location.hash.replace('#', '')
  return VALID_TABS.includes(hash as Tab) ? (hash as Tab) : 'home'
}

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
  const [authLoading, setAuthLoading] = useState(!getProfile()) // only loading if no localStorage profile
  const [activeTab, setActiveTabRaw] = useState<Tab>(getTabFromHash)
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [inviteCounty] = useState<string | null>(getInviteCounty)
  const [refreshKey, setRefreshKey] = useState(0)
  const [autoJoinLobby, setAutoJoinLobby] = useState(false)
  const [victoryAnim, setVictoryAnim] = useState<{ tier: TrophyTier; name: string } | null>(null)
  const [focusMatchId, setFocusMatchId] = useState<string | null>(null)
  const [showNotifications, setShowNotifications] = useState(false)

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
    const onPopState = () => {
      setActiveTabRaw(getTabFromHash())
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
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
    if (inviteCounty) {
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
    return (
      <div className="app">
        <nav className="top-nav top-nav-register">
          <div className="top-nav-logo top-nav-logo-large">
              <svg className="rally-logo" height="44" viewBox="0 0 579 151" xmlns="http://www.w3.org/2000/svg">
                <path d="M 488 41 L 489 42 L 489 43 L 490 44 L 490 45 L 490 46 L 491 47 L 491 48 L 492 49 L 492 50 L 492 51 L 493 52 L 493 53 L 494 54 L 494 55 L 495 56 L 495 57 L 495 58 L 496 59 L 496 60 L 497 61 L 497 62 L 498 63 L 498 64 L 498 65 L 499 66 L 499 67 L 500 68 L 500 69 L 501 70 L 501 71 L 501 72 L 502 73 L 502 74 L 503 75 L 503 76 L 504 77 L 504 78 L 505 79 L 505 80 L 505 81 L 506 82 L 506 83 L 507 84 L 507 85 L 507 86 L 508 87 L 508 88 L 509 89 L 509 90 L 510 91 L 510 92 L 510 93 L 511 94 L 511 95 L 512 96 L 512 97 L 513 98 L 513 99 L 513 100 L 514 101 L 514 102 L 515 103 L 515 104 L 516 105 L 516 106 L 516 107 L 517 108 L 517 109 L 518 110 L 518 111 L 518 112 L 517 113 L 517 114 L 517 115 L 516 116 L 516 117 L 516 118 L 515 119 L 514 120 L 513 121 L 512 122 L 511 122 L 510 123 L 509 123 L 508 123 L 507 123 L 506 123 L 505 123 L 504 124 L 503 123 L 502 123 L 501 123 L 500 123 L 499 123 L 498 123 L 497 122 L 496 122 L 495 122 L 494 123 L 494 124 L 494 125 L 494 126 L 494 127 L 494 128 L 493 129 L 493 130 L 493 131 L 493 132 L 492 133 L 492 134 L 492 135 L 492 136 L 491 137 L 491 138 L 492 138 L 493 139 L 494 139 L 495 139 L 496 140 L 497 140 L 498 140 L 499 140 L 500 140 L 501 140 L 502 140 L 503 140 L 504 140 L 505 140 L 506 140 L 507 140 L 508 140 L 509 140 L 510 140 L 511 140 L 512 140 L 513 140 L 514 140 L 515 140 L 516 140 L 517 139 L 518 139 L 519 139 L 520 138 L 521 138 L 522 137 L 523 137 L 524 136 L 525 136 L 526 135 L 527 134 L 528 133 L 529 132 L 530 131 L 531 130 L 532 129 L 533 128 L 533 127 L 534 126 L 534 125 L 535 124 L 535 123 L 536 122 L 536 121 L 537 120 L 537 119 L 538 118 L 538 117 L 538 116 L 539 115 L 539 114 L 540 113 L 540 112 L 540 111 L 541 110 L 541 109 L 541 108 L 542 107 L 542 106 L 543 105 L 543 104 L 543 103 L 544 102 L 544 101 L 545 100 L 545 99 L 545 98 L 546 97 L 546 96 L 547 95 L 547 94 L 547 93 L 548 92 L 548 91 L 549 90 L 549 89 L 549 88 L 550 87 L 550 86 L 551 85 L 551 84 L 551 83 L 552 82 L 552 81 L 552 80 L 553 79 L 553 78 L 554 77 L 554 76 L 554 75 L 555 74 L 555 73 L 555 72 L 556 71 L 556 70 L 557 69 L 557 68 L 557 67 L 558 66 L 558 65 L 559 64 L 559 63 L 560 62 L 560 61 L 560 60 L 561 59 L 561 58 L 562 57 L 562 56 L 562 55 L 563 54 L 563 53 L 564 52 L 564 51 L 564 50 L 565 49 L 565 48 L 565 47 L 566 46 L 566 45 L 567 44 L 567 43 L 567 42 L 568 41 L 567 41 L 566 41 L 565 41 L 564 41 L 563 41 L 562 41 L 561 41 L 560 41 L 559 41 L 558 41 L 557 41 L 556 41 L 555 41 L 554 41 L 553 41 L 552 41 L 551 41 L 550 41 L 549 41 L 548 41 L 547 41 L 546 41 L 545 42 L 545 43 L 545 44 L 544 45 L 544 46 L 544 47 L 543 48 L 543 49 L 543 50 L 542 51 L 542 52 L 542 53 L 541 54 L 541 55 L 541 56 L 540 57 L 540 58 L 540 59 L 539 60 L 539 61 L 539 62 L 538 63 L 538 64 L 538 65 L 537 66 L 537 67 L 537 68 L 536 69 L 536 70 L 536 71 L 535 72 L 535 73 L 535 74 L 534 75 L 534 76 L 534 77 L 533 78 L 533 79 L 533 80 L 532 81 L 532 82 L 532 83 L 531 84 L 531 85 L 531 86 L 531 87 L 530 88 L 529 87 L 528 86 L 528 85 L 527 84 L 527 83 L 527 82 L 526 81 L 526 80 L 526 79 L 525 78 L 525 77 L 524 76 L 524 75 L 524 74 L 523 73 L 523 72 L 523 71 L 522 70 L 522 69 L 522 68 L 521 67 L 521 66 L 521 65 L 520 64 L 520 63 L 520 62 L 519 61 L 519 60 L 519 59 L 518 58 L 518 57 L 517 56 L 517 55 L 517 54 L 516 53 L 516 52 L 516 51 L 515 50 L 515 49 L 515 48 L 514 47 L 514 46 L 514 45 L 513 44 L 513 43 L 513 42 L 512 41 L 511 41 L 510 41 L 509 41 L 508 41 L 507 41 L 506 41 L 505 41 L 504 41 L 503 41 L 502 41 L 501 41 L 500 41 L 499 41 L 498 41 L 497 41 L 496 41 L 495 41 L 494 41 L 493 41 L 492 41 L 491 41 L 490 41 L 489 41 Z" fill="#1a1a1a" fillRule="evenodd"/>
                <path d="M 359 39 L 358 40 L 357 40 L 356 40 L 355 40 L 354 40 L 353 41 L 352 41 L 351 41 L 350 41 L 349 42 L 348 42 L 347 43 L 346 43 L 345 44 L 344 44 L 343 45 L 342 45 L 341 46 L 340 46 L 339 47 L 338 48 L 339 49 L 339 50 L 339 51 L 340 52 L 340 53 L 341 54 L 341 55 L 342 56 L 342 57 L 343 58 L 343 59 L 343 60 L 343 61 L 344 61 L 345 61 L 346 60 L 347 59 L 348 59 L 349 58 L 350 58 L 351 57 L 352 57 L 353 56 L 354 56 L 355 56 L 356 55 L 357 55 L 358 55 L 359 55 L 360 55 L 361 54 L 362 54 L 363 54 L 364 54 L 365 54 L 366 54 L 367 54 L 368 54 L 369 54 L 370 54 L 371 54 L 372 54 L 373 55 L 374 55 L 375 55 L 376 56 L 377 56 L 378 57 L 379 57 L 380 58 L 381 59 L 381 60 L 382 61 L 382 62 L 383 63 L 383 64 L 383 65 L 383 66 L 382 67 L 381 68 L 380 68 L 379 67 L 378 67 L 377 67 L 376 67 L 375 67 L 374 67 L 373 67 L 372 67 L 371 66 L 370 66 L 369 66 L 368 66 L 367 66 L 366 66 L 365 66 L 364 66 L 363 66 L 362 66 L 361 67 L 360 67 L 359 67 L 358 67 L 357 67 L 356 67 L 355 67 L 354 67 L 353 68 L 352 68 L 351 68 L 350 69 L 349 69 L 348 69 L 347 70 L 346 70 L 345 71 L 344 71 L 343 72 L 342 73 L 341 73 L 340 74 L 339 75 L 338 76 L 338 77 L 337 78 L 337 79 L 336 80 L 336 81 L 335 82 L 335 83 L 335 84 L 335 85 L 334 86 L 334 87 L 334 88 L 334 89 L 334 90 L 334 91 L 334 92 L 335 93 L 335 94 L 335 95 L 335 96 L 336 97 L 336 98 L 337 99 L 337 100 L 338 101 L 339 102 L 340 103 L 341 104 L 342 105 L 343 106 L 344 106 L 345 107 L 346 107 L 347 108 L 348 108 L 349 108 L 350 109 L 351 109 L 352 109 L 353 109 L 354 109 L 355 110 L 356 110 L 357 110 L 358 110 L 359 110 L 360 110 L 361 110 L 362 110 L 363 110 L 364 110 L 365 109 L 366 109 L 367 109 L 368 109 L 369 109 L 370 108 L 371 108 L 372 108 L 373 107 L 374 107 L 375 107 L 376 106 L 377 106 L 378 105 L 379 104 L 380 104 L 381 103 L 382 102 L 383 101 L 384 100 L 385 99 L 386 100 L 386 101 L 386 102 L 387 103 L 387 104 L 387 105 L 387 106 L 387 107 L 388 108 L 389 108 L 390 108 L 391 108 L 392 108 L 393 108 L 394 108 L 395 108 L 396 108 L 397 108 L 398 108 L 399 108 L 400 108 L 401 108 L 402 108 L 403 108 L 404 108 L 405 108 L 405 107 L 405 106 L 405 105 L 405 104 L 405 103 L 405 102 L 405 101 L 404 100 L 404 99 L 404 98 L 404 97 L 404 96 L 404 95 L 404 94 L 404 93 L 404 92 L 404 91 L 404 90 L 404 89 L 404 88 L 404 87 L 404 86 L 404 85 L 404 84 L 404 83 L 404 82 L 404 81 L 404 80 L 404 79 L 404 78 L 404 77 L 404 76 L 404 75 L 404 74 L 404 73 L 404 72 L 404 71 L 404 70 L 404 69 L 404 68 L 404 67 L 404 66 L 404 65 L 404 64 L 404 63 L 404 62 L 404 61 L 403 60 L 403 59 L 403 58 L 402 57 L 402 56 L 402 55 L 401 54 L 401 53 L 400 52 L 400 51 L 399 50 L 398 49 L 398 48 L 397 47 L 396 46 L 395 46 L 394 45 L 393 44 L 392 43 L 391 43 L 390 42 L 389 42 L 388 42 L 387 41 L 386 41 L 385 41 L 384 40 L 383 40 L 382 40 L 381 40 L 380 40 L 379 39 L 378 39 L 377 39 L 376 39 L 375 39 L 374 39 L 373 39 L 372 39 L 371 39 L 370 39 L 369 39 L 368 39 L 367 39 L 366 39 L 365 39 L 364 39 L 363 39 L 362 39 L 361 39 L 360 39 Z M 364 79 L 365 78 L 366 78 L 367 78 L 368 78 L 369 78 L 370 78 L 371 78 L 372 78 L 373 78 L 374 78 L 375 78 L 376 78 L 377 78 L 378 78 L 379 78 L 380 79 L 381 79 L 382 79 L 383 79 L 384 80 L 384 81 L 384 82 L 384 83 L 383 84 L 383 85 L 383 86 L 382 87 L 382 88 L 381 89 L 380 90 L 379 91 L 378 92 L 377 92 L 376 93 L 375 94 L 374 94 L 373 94 L 372 95 L 371 95 L 370 95 L 369 95 L 368 96 L 367 96 L 366 96 L 365 96 L 364 96 L 363 95 L 362 95 L 361 95 L 360 95 L 359 94 L 358 94 L 357 93 L 356 92 L 355 91 L 355 90 L 355 89 L 355 88 L 355 87 L 355 86 L 355 85 L 355 84 L 356 83 L 357 82 L 358 81 L 359 80 L 360 80 L 361 79 L 362 79 L 363 79 Z" fill="#1a1a1a" fillRule="evenodd"/>
                <path d="M 12 21 L 13 21 L 14 21 L 15 21 L 16 21 L 17 21 L 18 22 L 19 22 L 20 22 L 21 22 L 22 22 L 23 23 L 24 23 L 25 23 L 26 23 L 27 23 L 28 23 L 29 24 L 30 24 L 31 24 L 32 24 L 33 24 L 34 25 L 35 25 L 36 25 L 37 25 L 38 25 L 39 26 L 40 26 L 41 26 L 42 26 L 43 26 L 44 27 L 45 27 L 46 27 L 47 27 L 48 27 L 49 28 L 50 28 L 51 28 L 52 28 L 53 28 L 54 29 L 55 29 L 56 29 L 57 29 L 58 29 L 59 30 L 60 30 L 61 30 L 62 30 L 63 31 L 64 31 L 65 31 L 66 31 L 67 31 L 68 32 L 69 32 L 70 32 L 71 32 L 72 33 L 73 33 L 74 33 L 75 34 L 76 34 L 77 34 L 78 35 L 79 35 L 80 35 L 81 36 L 82 36 L 83 37 L 84 38 L 85 38 L 86 39 L 87 39 L 88 40 L 89 41 L 90 41 L 91 42 L 92 43 L 93 43 L 94 44 L 95 45 L 96 45 L 97 46 L 98 47 L 99 47 L 100 48 L 101 49 L 102 49 L 103 49 L 104 50 L 105 51 L 106 51 L 107 51 L 108 52 L 109 52 L 110 53 L 111 53 L 112 54 L 113 54 L 114 54 L 115 55 L 116 55 L 117 55 L 118 56 L 119 56 L 120 56 L 121 57 L 122 57 L 123 57 L 124 57 L 125 58 L 126 58 L 127 58 L 128 58 L 129 58 L 130 59 L 131 59 L 132 59 L 133 59 L 134 59 L 135 59 L 136 60 L 137 60 L 138 60 L 139 60 L 140 60 L 141 60 L 142 60 L 143 61 L 144 61 L 145 61 L 146 61 L 147 61 L 148 62 L 149 62 L 150 62 L 151 62 L 152 62 L 153 62 L 154 62 L 155 62 L 156 63 L 155 64 L 154 64 L 153 64 L 152 64 L 151 64 L 150 64 L 149 65 L 148 65 L 147 65 L 146 65 L 145 65 L 144 65 L 143 66 L 142 66 L 141 66 L 140 66 L 139 66 L 138 66 L 137 67 L 136 67 L 135 67 L 134 67 L 133 68 L 132 68 L 131 68 L 130 68 L 129 69 L 128 69 L 127 69 L 126 69 L 125 70 L 124 70 L 123 70 L 122 71 L 121 71 L 120 71 L 119 72 L 118 72 L 117 72 L 116 73 L 115 73 L 114 74 L 113 74 L 112 74 L 111 75 L 110 75 L 109 76 L 108 76 L 107 77 L 106 77 L 105 78 L 104 79 L 103 80 L 102 80 L 101 81 L 100 82 L 99 82 L 98 83 L 97 84 L 96 84 L 95 85 L 94 86 L 93 87 L 92 87 L 91 88 L 90 89 L 89 90 L 88 90 L 87 91 L 86 92 L 85 92 L 84 93 L 83 94 L 82 94 L 81 95 L 80 95 L 79 96 L 78 96 L 77 97 L 76 97 L 75 98 L 74 98 L 73 98 L 72 99 L 71 99 L 70 99 L 69 100 L 68 100 L 67 100 L 66 101 L 65 101 L 64 101 L 63 101 L 62 101 L 61 102 L 60 102 L 59 102 L 58 102 L 57 102 L 56 103 L 55 103 L 54 103 L 53 103 L 52 104 L 51 104 L 50 104 L 49 104 L 48 104 L 47 105 L 46 105 L 45 105 L 44 105 L 43 106 L 42 106 L 41 106 L 40 106 L 39 107 L 38 107 L 37 107 L 36 107 L 35 107 L 34 108 L 33 108 L 32 108 L 31 108 L 30 108 L 29 109 L 28 109 L 27 109 L 26 109 L 25 109 L 24 110 L 23 110 L 22 110 L 21 110 L 20 110 L 19 111 L 18 111 L 17 111 L 16 111 L 15 111 L 14 112 L 13 112 L 12 112 L 11 112 L 10 112 L 11 112 L 12 112 L 13 112 L 14 112 L 15 112 L 16 112 L 17 112 L 18 112 L 19 112 L 20 112 L 21 112 L 22 112 L 23 112 L 24 112 L 25 112 L 26 112 L 27 112 L 28 112 L 29 112 L 30 112 L 31 112 L 32 112 L 33 112 L 34 112 L 35 112 L 36 112 L 37 112 L 38 112 L 39 112 L 40 111 L 41 111 L 42 111 L 43 111 L 44 111 L 45 111 L 46 111 L 47 111 L 48 111 L 49 111 L 50 111 L 51 111 L 52 111 L 53 111 L 54 111 L 55 111 L 56 111 L 57 111 L 58 111 L 59 111 L 60 111 L 61 111 L 62 111 L 63 111 L 64 111 L 65 111 L 66 111 L 67 111 L 68 111 L 69 110 L 70 110 L 71 110 L 72 110 L 73 110 L 74 110 L 75 110 L 76 110 L 77 110 L 78 110 L 79 110 L 80 110 L 81 110 L 82 110 L 83 109 L 84 109 L 85 109 L 86 109 L 87 109 L 88 109 L 89 108 L 90 108 L 91 107 L 92 107 L 93 107 L 94 106 L 95 105 L 96 105 L 97 104 L 98 104 L 99 103 L 100 102 L 101 101 L 102 101 L 103 100 L 104 99 L 105 98 L 106 98 L 107 97 L 108 96 L 109 95 L 110 94 L 111 93 L 112 92 L 113 91 L 114 91 L 115 90 L 116 89 L 117 88 L 118 87 L 119 86 L 120 85 L 121 85 L 122 84 L 123 83 L 124 82 L 125 82 L 126 81 L 127 80 L 128 80 L 129 79 L 130 78 L 131 78 L 132 77 L 133 77 L 134 76 L 135 76 L 136 75 L 137 75 L 138 74 L 139 74 L 140 73 L 141 73 L 142 72 L 143 72 L 144 72 L 145 71 L 146 71 L 147 71 L 148 70 L 149 70 L 150 70 L 151 69 L 152 69 L 153 69 L 154 69 L 155 68 L 156 68 L 157 68 L 158 68 L 159 68 L 160 68 L 161 68 L 162 68 L 163 69 L 164 69 L 165 69 L 166 69 L 167 69 L 168 69 L 169 69 L 170 70 L 171 70 L 172 70 L 173 70 L 174 70 L 175 70 L 176 70 L 177 70 L 178 71 L 179 71 L 180 71 L 181 71 L 182 71 L 183 71 L 184 71 L 185 72 L 186 72 L 187 72 L 188 72 L 189 72 L 190 72 L 191 72 L 192 72 L 193 72 L 194 73 L 195 73 L 196 73 L 197 73 L 198 73 L 199 73 L 200 73 L 201 73 L 202 74 L 203 74 L 204 74 L 205 74 L 206 74 L 207 74 L 208 74 L 209 74 L 210 74 L 211 75 L 212 74 L 213 74 L 213 73 L 214 72 L 214 71 L 214 70 L 214 69 L 214 68 L 214 67 L 214 66 L 214 65 L 214 64 L 214 63 L 214 62 L 214 61 L 214 60 L 214 59 L 214 58 L 214 57 L 213 56 L 213 55 L 212 55 L 211 55 L 210 56 L 209 56 L 208 56 L 207 56 L 206 56 L 205 56 L 204 56 L 203 56 L 202 57 L 201 57 L 200 57 L 199 57 L 198 57 L 197 57 L 196 57 L 195 57 L 194 57 L 193 57 L 192 57 L 191 58 L 190 58 L 189 58 L 188 58 L 187 58 L 186 58 L 185 58 L 184 59 L 183 59 L 182 59 L 181 59 L 180 59 L 179 59 L 178 59 L 177 59 L 176 59 L 175 59 L 174 60 L 173 60 L 172 60 L 171 60 L 170 60 L 169 60 L 168 61 L 167 61 L 166 61 L 165 61 L 164 61 L 163 61 L 162 61 L 161 61 L 160 61 L 159 60 L 158 61 L 157 60 L 156 60 L 155 60 L 154 60 L 153 60 L 152 59 L 151 59 L 150 59 L 149 58 L 148 58 L 147 58 L 146 57 L 145 57 L 144 57 L 143 56 L 142 56 L 141 55 L 140 55 L 139 55 L 138 54 L 137 54 L 136 53 L 135 53 L 134 52 L 133 52 L 132 51 L 131 51 L 130 50 L 129 50 L 128 49 L 127 48 L 126 48 L 125 47 L 124 47 L 123 46 L 122 45 L 121 45 L 120 44 L 119 43 L 118 43 L 117 42 L 116 41 L 115 40 L 114 39 L 113 39 L 112 38 L 111 37 L 110 37 L 109 36 L 108 35 L 107 34 L 106 33 L 105 33 L 104 32 L 103 31 L 102 30 L 101 30 L 100 29 L 99 29 L 98 28 L 97 27 L 96 27 L 95 26 L 94 26 L 93 25 L 92 25 L 91 25 L 90 24 L 89 24 L 88 24 L 87 24 L 86 24 L 85 23 L 84 23 L 83 23 L 82 23 L 81 23 L 80 23 L 79 23 L 78 23 L 77 23 L 76 23 L 75 23 L 74 23 L 73 23 L 72 23 L 71 23 L 70 23 L 69 23 L 68 22 L 67 22 L 66 22 L 65 22 L 64 22 L 63 22 L 62 22 L 61 22 L 60 22 L 59 22 L 58 22 L 57 22 L 56 22 L 55 22 L 54 22 L 53 22 L 52 22 L 51 22 L 50 22 L 49 22 L 48 22 L 47 22 L 46 22 L 45 22 L 44 22 L 43 22 L 42 22 L 41 21 L 40 21 L 39 21 L 38 21 L 37 21 L 36 21 L 35 21 L 34 21 L 33 21 L 32 21 L 31 21 L 30 21 L 29 21 L 28 21 L 27 21 L 26 21 L 25 21 L 24 21 L 23 21 L 22 21 L 21 21 L 20 21 L 19 21 L 18 21 L 17 21 L 16 21 L 15 21 L 14 21 L 13 21 Z" fill="#1a1a1a" fillRule="evenodd"/>
                <path d="M 419 11 L 419 12 L 419 13 L 419 14 L 419 15 L 419 16 L 419 17 L 419 18 L 419 19 L 419 20 L 419 21 L 419 22 L 419 23 L 419 24 L 419 25 L 419 26 L 419 27 L 419 28 L 419 29 L 419 30 L 419 31 L 419 32 L 419 33 L 419 34 L 419 35 L 419 36 L 419 37 L 419 38 L 419 39 L 419 40 L 419 41 L 419 42 L 419 43 L 419 44 L 419 45 L 419 46 L 419 47 L 419 48 L 419 49 L 419 50 L 419 51 L 419 52 L 419 53 L 419 54 L 419 55 L 419 56 L 419 57 L 419 58 L 419 59 L 419 60 L 419 61 L 419 62 L 419 63 L 419 64 L 419 65 L 419 66 L 419 67 L 419 68 L 419 69 L 419 70 L 419 71 L 419 72 L 419 73 L 419 74 L 419 75 L 419 76 L 419 77 L 419 78 L 419 79 L 419 80 L 419 81 L 419 82 L 419 83 L 419 84 L 419 85 L 419 86 L 419 87 L 419 88 L 419 89 L 419 90 L 419 91 L 419 92 L 419 93 L 419 94 L 419 95 L 419 96 L 419 97 L 419 98 L 419 99 L 419 100 L 419 101 L 419 102 L 419 103 L 419 104 L 419 105 L 419 106 L 419 107 L 419 108 L 420 108 L 421 108 L 422 108 L 423 108 L 424 108 L 425 108 L 426 108 L 427 108 L 428 108 L 429 108 L 430 108 L 431 108 L 432 108 L 433 108 L 434 108 L 435 108 L 436 108 L 437 108 L 438 108 L 439 108 L 440 108 L 441 108 L 441 107 L 441 106 L 441 105 L 441 104 L 441 103 L 441 102 L 441 101 L 441 100 L 441 99 L 441 98 L 441 97 L 441 96 L 441 95 L 441 94 L 441 93 L 441 92 L 441 91 L 441 90 L 441 89 L 441 88 L 441 87 L 441 86 L 441 85 L 441 84 L 441 83 L 441 82 L 441 81 L 441 80 L 441 79 L 441 78 L 441 77 L 441 76 L 441 75 L 441 74 L 441 73 L 441 72 L 441 71 L 441 70 L 441 69 L 441 68 L 441 67 L 441 66 L 441 65 L 441 64 L 441 63 L 441 62 L 441 61 L 441 60 L 441 59 L 441 58 L 441 57 L 441 56 L 441 55 L 441 54 L 441 53 L 441 52 L 441 51 L 441 50 L 441 49 L 441 48 L 441 47 L 441 46 L 441 45 L 441 44 L 441 43 L 441 42 L 441 41 L 441 40 L 441 39 L 441 38 L 441 37 L 441 36 L 441 35 L 441 34 L 441 33 L 441 32 L 441 31 L 441 30 L 441 29 L 441 28 L 441 27 L 441 26 L 441 25 L 441 24 L 441 23 L 441 22 L 441 21 L 441 20 L 441 19 L 441 18 L 441 17 L 441 16 L 441 15 L 441 14 L 441 13 L 441 12 L 441 11 L 440 11 L 439 11 L 438 11 L 437 11 L 436 11 L 435 11 L 434 11 L 433 11 L 432 11 L 431 11 L 430 11 L 429 11 L 428 11 L 427 11 L 426 11 L 425 11 L 424 11 L 423 11 L 422 11 L 421 11 L 420 11 Z" fill="#1a1a1a" fillRule="evenodd"/>
                <path d="M 243 11 L 243 12 L 243 13 L 243 14 L 243 15 L 243 16 L 243 17 L 243 18 L 243 19 L 243 20 L 243 21 L 243 22 L 243 23 L 243 24 L 243 25 L 243 26 L 243 27 L 243 28 L 243 29 L 243 30 L 243 31 L 243 32 L 243 33 L 243 34 L 243 35 L 243 36 L 243 37 L 243 38 L 243 39 L 243 40 L 243 41 L 243 42 L 243 43 L 243 44 L 243 45 L 243 46 L 243 47 L 243 48 L 243 49 L 243 50 L 243 51 L 243 52 L 243 53 L 243 54 L 243 55 L 243 56 L 243 57 L 243 58 L 243 59 L 243 60 L 243 61 L 243 62 L 243 63 L 243 64 L 243 65 L 243 66 L 243 67 L 243 68 L 243 69 L 243 70 L 243 71 L 243 72 L 243 73 L 243 74 L 243 75 L 243 76 L 243 77 L 243 78 L 243 79 L 243 80 L 243 81 L 243 82 L 243 83 L 243 84 L 243 85 L 243 86 L 243 87 L 243 88 L 243 89 L 243 90 L 243 91 L 243 92 L 243 93 L 243 94 L 243 95 L 243 96 L 243 97 L 243 98 L 243 99 L 243 100 L 243 101 L 243 102 L 243 103 L 243 104 L 243 105 L 243 106 L 243 107 L 243 108 L 244 108 L 245 108 L 246 108 L 247 108 L 248 108 L 249 108 L 250 108 L 251 108 L 252 108 L 253 108 L 254 108 L 255 108 L 256 108 L 257 108 L 258 108 L 259 108 L 260 108 L 261 108 L 262 108 L 263 108 L 264 108 L 265 108 L 265 107 L 265 106 L 265 105 L 265 104 L 265 103 L 265 102 L 265 101 L 265 100 L 265 99 L 265 98 L 265 97 L 265 96 L 265 95 L 265 94 L 265 93 L 265 92 L 265 91 L 265 90 L 265 89 L 265 88 L 265 87 L 265 86 L 265 85 L 265 84 L 265 83 L 265 82 L 265 81 L 265 80 L 265 79 L 265 78 L 265 77 L 265 76 L 265 75 L 266 74 L 267 74 L 268 74 L 269 74 L 270 74 L 271 74 L 272 74 L 273 74 L 274 74 L 275 74 L 276 74 L 277 74 L 278 74 L 279 74 L 280 74 L 281 75 L 282 76 L 283 77 L 284 78 L 284 79 L 285 80 L 286 81 L 286 82 L 287 83 L 288 84 L 288 85 L 289 86 L 289 87 L 290 88 L 291 89 L 291 90 L 292 91 L 293 92 L 293 93 L 294 94 L 295 95 L 295 96 L 296 97 L 297 98 L 297 99 L 298 100 L 298 101 L 299 102 L 300 103 L 300 104 L 301 105 L 301 106 L 302 107 L 303 108 L 304 108 L 305 108 L 306 108 L 307 108 L 308 108 L 309 108 L 310 108 L 311 108 L 312 108 L 313 108 L 314 108 L 315 108 L 316 108 L 317 108 L 318 108 L 319 108 L 320 108 L 321 108 L 322 108 L 323 108 L 324 108 L 325 108 L 326 108 L 327 108 L 328 108 L 329 108 L 328 107 L 327 106 L 327 105 L 326 104 L 325 103 L 325 102 L 324 101 L 323 100 L 323 99 L 322 98 L 321 97 L 321 96 L 320 95 L 319 94 L 318 93 L 318 92 L 317 91 L 316 90 L 316 89 L 315 88 L 314 87 L 314 86 L 313 85 L 312 84 L 312 83 L 311 82 L 310 81 L 309 80 L 309 79 L 308 78 L 307 77 L 307 76 L 306 75 L 305 74 L 305 73 L 304 72 L 305 71 L 306 71 L 307 70 L 308 70 L 309 69 L 310 69 L 311 68 L 312 68 L 313 67 L 314 66 L 315 66 L 316 65 L 317 64 L 318 63 L 319 62 L 319 61 L 320 60 L 321 59 L 322 58 L 322 57 L 323 56 L 323 55 L 323 54 L 324 53 L 324 52 L 324 51 L 325 50 L 325 49 L 325 48 L 325 47 L 325 46 L 325 45 L 325 44 L 326 43 L 326 42 L 325 41 L 325 40 L 325 39 L 325 38 L 325 37 L 325 36 L 325 35 L 324 34 L 324 33 L 324 32 L 324 31 L 323 30 L 323 29 L 322 28 L 322 27 L 321 26 L 321 25 L 320 24 L 319 23 L 318 22 L 317 21 L 316 20 L 315 19 L 314 18 L 313 18 L 312 17 L 311 16 L 310 16 L 309 15 L 308 15 L 307 15 L 306 14 L 305 14 L 304 14 L 303 13 L 302 13 L 301 13 L 300 13 L 299 12 L 298 12 L 297 12 L 296 12 L 295 12 L 294 12 L 293 12 L 292 12 L 291 12 L 290 12 L 289 12 L 288 12 L 287 12 L 286 12 L 285 12 L 284 12 L 283 12 L 282 12 L 281 12 L 280 12 L 279 12 L 278 11 L 277 12 L 276 11 L 275 11 L 274 11 L 273 11 L 272 11 L 271 11 L 270 11 L 269 11 L 268 11 L 267 11 L 266 11 L 265 11 L 264 11 L 263 11 L 262 11 L 261 11 L 260 11 L 259 11 L 258 11 L 257 11 L 256 11 L 255 11 L 254 11 L 253 11 L 252 11 L 251 11 L 250 11 L 249 11 L 248 11 L 247 11 L 246 11 L 245 11 L 244 11 Z M 265 29 L 266 28 L 267 28 L 268 28 L 269 28 L 270 28 L 271 28 L 272 28 L 273 28 L 274 28 L 275 28 L 276 28 L 277 28 L 278 28 L 279 28 L 280 28 L 281 28 L 282 28 L 283 28 L 284 28 L 285 28 L 286 28 L 287 28 L 288 29 L 289 29 L 290 29 L 291 29 L 292 29 L 293 30 L 294 30 L 295 31 L 296 31 L 297 32 L 298 33 L 299 34 L 300 35 L 300 36 L 301 37 L 301 38 L 301 39 L 302 40 L 302 41 L 302 42 L 302 43 L 302 44 L 302 45 L 302 46 L 301 47 L 301 48 L 301 49 L 301 50 L 300 51 L 300 52 L 299 53 L 298 54 L 297 55 L 296 56 L 295 56 L 294 57 L 293 57 L 292 58 L 291 58 L 290 58 L 289 58 L 288 58 L 287 59 L 286 59 L 285 59 L 284 59 L 283 59 L 282 59 L 281 59 L 280 59 L 279 59 L 278 59 L 277 59 L 276 59 L 275 59 L 274 59 L 273 59 L 272 59 L 271 59 L 270 59 L 269 59 L 268 59 L 267 59 L 266 59 L 265 58 L 265 57 L 265 56 L 265 55 L 265 54 L 265 53 L 265 52 L 265 51 L 265 50 L 265 49 L 265 48 L 265 47 L 265 46 L 265 45 L 265 44 L 265 43 L 265 42 L 265 41 L 265 40 L 265 39 L 265 38 L 265 37 L 265 36 L 265 35 L 265 34 L 265 33 L 265 32 L 265 31 L 265 30 Z" fill="#1a1a1a" fillRule="evenodd"/>
                <path d="M 458 10 L 457 11 L 457 12 L 457 13 L 457 14 L 457 15 L 457 16 L 457 17 L 457 18 L 457 19 L 457 20 L 457 21 L 457 22 L 457 23 L 457 24 L 457 25 L 457 26 L 457 27 L 457 28 L 457 29 L 457 30 L 457 31 L 457 32 L 457 33 L 457 34 L 457 35 L 457 36 L 457 37 L 457 38 L 457 39 L 457 40 L 457 41 L 457 42 L 457 43 L 457 44 L 457 45 L 457 46 L 457 47 L 457 48 L 457 49 L 457 50 L 457 51 L 457 52 L 457 53 L 457 54 L 457 55 L 457 56 L 457 57 L 457 58 L 457 59 L 457 60 L 457 61 L 457 62 L 457 63 L 457 64 L 457 65 L 457 66 L 457 67 L 457 68 L 457 69 L 457 70 L 457 71 L 457 72 L 457 73 L 457 74 L 457 75 L 457 76 L 457 77 L 457 78 L 457 79 L 457 80 L 457 81 L 457 82 L 457 83 L 457 84 L 457 85 L 457 86 L 457 87 L 457 88 L 457 89 L 457 90 L 457 91 L 457 92 L 457 93 L 457 94 L 457 95 L 457 96 L 457 97 L 457 98 L 457 99 L 457 100 L 457 101 L 457 102 L 457 103 L 457 104 L 457 105 L 457 106 L 457 107 L 457 108 L 458 108 L 459 108 L 460 108 L 461 108 L 462 108 L 463 108 L 464 108 L 465 108 L 466 108 L 467 108 L 468 108 L 469 108 L 470 108 L 471 108 L 472 108 L 473 108 L 474 108 L 475 108 L 476 108 L 477 108 L 478 108 L 479 108 L 479 107 L 479 106 L 479 105 L 479 104 L 479 103 L 479 102 L 479 101 L 479 100 L 479 99 L 479 98 L 479 97 L 479 96 L 479 95 L 479 94 L 479 93 L 479 92 L 479 91 L 479 90 L 479 89 L 479 88 L 479 87 L 479 86 L 479 85 L 479 84 L 479 83 L 479 82 L 479 81 L 479 80 L 479 79 L 479 78 L 479 77 L 479 76 L 479 75 L 479 74 L 479 73 L 479 72 L 479 71 L 479 70 L 479 69 L 479 68 L 479 67 L 479 66 L 479 65 L 479 64 L 479 63 L 479 62 L 479 61 L 479 60 L 479 59 L 479 58 L 479 57 L 479 56 L 479 55 L 479 54 L 479 53 L 479 52 L 479 51 L 479 50 L 479 49 L 479 48 L 479 47 L 479 46 L 479 45 L 479 44 L 479 43 L 479 42 L 479 41 L 479 40 L 479 39 L 479 38 L 479 37 L 479 36 L 479 35 L 479 34 L 479 33 L 479 32 L 479 31 L 479 30 L 479 29 L 479 28 L 479 27 L 479 26 L 479 25 L 479 24 L 479 23 L 479 22 L 479 21 L 479 20 L 479 19 L 479 18 L 479 17 L 479 16 L 479 15 L 479 14 L 479 13 L 479 12 L 479 11 L 478 11 L 477 11 L 476 11 L 475 11 L 474 11 L 473 11 L 472 11 L 471 11 L 470 11 L 469 11 L 468 11 L 467 11 L 466 11 L 465 11 L 464 11 L 463 11 L 462 11 L 461 11 L 460 11 L 459 11 Z" fill="#1a1a1a" fillRule="evenodd"/>
              </svg>
            </div>
        </nav>
        <Register onRegistered={handleRegistered} inviteCounty={inviteCounty} />
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
              <svg className="rally-logo" height="28" viewBox="0 0 579 151" xmlns="http://www.w3.org/2000/svg">
                <path d="M 488 41 L 489 42 L 489 43 L 490 44 L 490 45 L 490 46 L 491 47 L 491 48 L 492 49 L 492 50 L 492 51 L 493 52 L 493 53 L 494 54 L 494 55 L 495 56 L 495 57 L 495 58 L 496 59 L 496 60 L 497 61 L 497 62 L 498 63 L 498 64 L 498 65 L 499 66 L 499 67 L 500 68 L 500 69 L 501 70 L 501 71 L 501 72 L 502 73 L 502 74 L 503 75 L 503 76 L 504 77 L 504 78 L 505 79 L 505 80 L 505 81 L 506 82 L 506 83 L 507 84 L 507 85 L 507 86 L 508 87 L 508 88 L 509 89 L 509 90 L 510 91 L 510 92 L 510 93 L 511 94 L 511 95 L 512 96 L 512 97 L 513 98 L 513 99 L 513 100 L 514 101 L 514 102 L 515 103 L 515 104 L 516 105 L 516 106 L 516 107 L 517 108 L 517 109 L 518 110 L 518 111 L 518 112 L 517 113 L 517 114 L 517 115 L 516 116 L 516 117 L 516 118 L 515 119 L 514 120 L 513 121 L 512 122 L 511 122 L 510 123 L 509 123 L 508 123 L 507 123 L 506 123 L 505 123 L 504 124 L 503 123 L 502 123 L 501 123 L 500 123 L 499 123 L 498 123 L 497 122 L 496 122 L 495 122 L 494 123 L 494 124 L 494 125 L 494 126 L 494 127 L 494 128 L 493 129 L 493 130 L 493 131 L 493 132 L 492 133 L 492 134 L 492 135 L 492 136 L 491 137 L 491 138 L 492 138 L 493 139 L 494 139 L 495 139 L 496 140 L 497 140 L 498 140 L 499 140 L 500 140 L 501 140 L 502 140 L 503 140 L 504 140 L 505 140 L 506 140 L 507 140 L 508 140 L 509 140 L 510 140 L 511 140 L 512 140 L 513 140 L 514 140 L 515 140 L 516 140 L 517 139 L 518 139 L 519 139 L 520 138 L 521 138 L 522 137 L 523 137 L 524 136 L 525 136 L 526 135 L 527 134 L 528 133 L 529 132 L 530 131 L 531 130 L 532 129 L 533 128 L 533 127 L 534 126 L 534 125 L 535 124 L 535 123 L 536 122 L 536 121 L 537 120 L 537 119 L 538 118 L 538 117 L 538 116 L 539 115 L 539 114 L 540 113 L 540 112 L 540 111 L 541 110 L 541 109 L 541 108 L 542 107 L 542 106 L 543 105 L 543 104 L 543 103 L 544 102 L 544 101 L 545 100 L 545 99 L 545 98 L 546 97 L 546 96 L 547 95 L 547 94 L 547 93 L 548 92 L 548 91 L 549 90 L 549 89 L 549 88 L 550 87 L 550 86 L 551 85 L 551 84 L 551 83 L 552 82 L 552 81 L 552 80 L 553 79 L 553 78 L 554 77 L 554 76 L 554 75 L 555 74 L 555 73 L 555 72 L 556 71 L 556 70 L 557 69 L 557 68 L 557 67 L 558 66 L 558 65 L 559 64 L 559 63 L 560 62 L 560 61 L 560 60 L 561 59 L 561 58 L 562 57 L 562 56 L 562 55 L 563 54 L 563 53 L 564 52 L 564 51 L 564 50 L 565 49 L 565 48 L 565 47 L 566 46 L 566 45 L 567 44 L 567 43 L 567 42 L 568 41 L 567 41 L 566 41 L 565 41 L 564 41 L 563 41 L 562 41 L 561 41 L 560 41 L 559 41 L 558 41 L 557 41 L 556 41 L 555 41 L 554 41 L 553 41 L 552 41 L 551 41 L 550 41 L 549 41 L 548 41 L 547 41 L 546 41 L 545 42 L 545 43 L 545 44 L 544 45 L 544 46 L 544 47 L 543 48 L 543 49 L 543 50 L 542 51 L 542 52 L 542 53 L 541 54 L 541 55 L 541 56 L 540 57 L 540 58 L 540 59 L 539 60 L 539 61 L 539 62 L 538 63 L 538 64 L 538 65 L 537 66 L 537 67 L 537 68 L 536 69 L 536 70 L 536 71 L 535 72 L 535 73 L 535 74 L 534 75 L 534 76 L 534 77 L 533 78 L 533 79 L 533 80 L 532 81 L 532 82 L 532 83 L 531 84 L 531 85 L 531 86 L 531 87 L 530 88 L 529 87 L 528 86 L 528 85 L 527 84 L 527 83 L 527 82 L 526 81 L 526 80 L 526 79 L 525 78 L 525 77 L 524 76 L 524 75 L 524 74 L 523 73 L 523 72 L 523 71 L 522 70 L 522 69 L 522 68 L 521 67 L 521 66 L 521 65 L 520 64 L 520 63 L 520 62 L 519 61 L 519 60 L 519 59 L 518 58 L 518 57 L 517 56 L 517 55 L 517 54 L 516 53 L 516 52 L 516 51 L 515 50 L 515 49 L 515 48 L 514 47 L 514 46 L 514 45 L 513 44 L 513 43 L 513 42 L 512 41 L 511 41 L 510 41 L 509 41 L 508 41 L 507 41 L 506 41 L 505 41 L 504 41 L 503 41 L 502 41 L 501 41 L 500 41 L 499 41 L 498 41 L 497 41 L 496 41 L 495 41 L 494 41 L 493 41 L 492 41 L 491 41 L 490 41 L 489 41 Z" fill="#1a1a1a" fillRule="evenodd"/>
                <path d="M 359 39 L 358 40 L 357 40 L 356 40 L 355 40 L 354 40 L 353 41 L 352 41 L 351 41 L 350 41 L 349 42 L 348 42 L 347 43 L 346 43 L 345 44 L 344 44 L 343 45 L 342 45 L 341 46 L 340 46 L 339 47 L 338 48 L 339 49 L 339 50 L 339 51 L 340 52 L 340 53 L 341 54 L 341 55 L 342 56 L 342 57 L 343 58 L 343 59 L 343 60 L 343 61 L 344 61 L 345 61 L 346 60 L 347 59 L 348 59 L 349 58 L 350 58 L 351 57 L 352 57 L 353 56 L 354 56 L 355 56 L 356 55 L 357 55 L 358 55 L 359 55 L 360 55 L 361 54 L 362 54 L 363 54 L 364 54 L 365 54 L 366 54 L 367 54 L 368 54 L 369 54 L 370 54 L 371 54 L 372 54 L 373 55 L 374 55 L 375 55 L 376 56 L 377 56 L 378 57 L 379 57 L 380 58 L 381 59 L 381 60 L 382 61 L 382 62 L 383 63 L 383 64 L 383 65 L 383 66 L 382 67 L 381 68 L 380 68 L 379 67 L 378 67 L 377 67 L 376 67 L 375 67 L 374 67 L 373 67 L 372 67 L 371 66 L 370 66 L 369 66 L 368 66 L 367 66 L 366 66 L 365 66 L 364 66 L 363 66 L 362 66 L 361 67 L 360 67 L 359 67 L 358 67 L 357 67 L 356 67 L 355 67 L 354 67 L 353 68 L 352 68 L 351 68 L 350 69 L 349 69 L 348 69 L 347 70 L 346 70 L 345 71 L 344 71 L 343 72 L 342 73 L 341 73 L 340 74 L 339 75 L 338 76 L 338 77 L 337 78 L 337 79 L 336 80 L 336 81 L 335 82 L 335 83 L 335 84 L 335 85 L 334 86 L 334 87 L 334 88 L 334 89 L 334 90 L 334 91 L 334 92 L 335 93 L 335 94 L 335 95 L 335 96 L 336 97 L 336 98 L 337 99 L 337 100 L 338 101 L 339 102 L 340 103 L 341 104 L 342 105 L 343 106 L 344 106 L 345 107 L 346 107 L 347 108 L 348 108 L 349 108 L 350 109 L 351 109 L 352 109 L 353 109 L 354 109 L 355 110 L 356 110 L 357 110 L 358 110 L 359 110 L 360 110 L 361 110 L 362 110 L 363 110 L 364 110 L 365 109 L 366 109 L 367 109 L 368 109 L 369 109 L 370 108 L 371 108 L 372 108 L 373 107 L 374 107 L 375 107 L 376 106 L 377 106 L 378 105 L 379 104 L 380 104 L 381 103 L 382 102 L 383 101 L 384 100 L 385 99 L 386 100 L 386 101 L 386 102 L 387 103 L 387 104 L 387 105 L 387 106 L 387 107 L 388 108 L 389 108 L 390 108 L 391 108 L 392 108 L 393 108 L 394 108 L 395 108 L 396 108 L 397 108 L 398 108 L 399 108 L 400 108 L 401 108 L 402 108 L 403 108 L 404 108 L 405 108 L 405 107 L 405 106 L 405 105 L 405 104 L 405 103 L 405 102 L 405 101 L 404 100 L 404 99 L 404 98 L 404 97 L 404 96 L 404 95 L 404 94 L 404 93 L 404 92 L 404 91 L 404 90 L 404 89 L 404 88 L 404 87 L 404 86 L 404 85 L 404 84 L 404 83 L 404 82 L 404 81 L 404 80 L 404 79 L 404 78 L 404 77 L 404 76 L 404 75 L 404 74 L 404 73 L 404 72 L 404 71 L 404 70 L 404 69 L 404 68 L 404 67 L 404 66 L 404 65 L 404 64 L 404 63 L 404 62 L 404 61 L 403 60 L 403 59 L 403 58 L 402 57 L 402 56 L 402 55 L 401 54 L 401 53 L 400 52 L 400 51 L 399 50 L 398 49 L 398 48 L 397 47 L 396 46 L 395 46 L 394 45 L 393 44 L 392 43 L 391 43 L 390 42 L 389 42 L 388 42 L 387 41 L 386 41 L 385 41 L 384 40 L 383 40 L 382 40 L 381 40 L 380 40 L 379 39 L 378 39 L 377 39 L 376 39 L 375 39 L 374 39 L 373 39 L 372 39 L 371 39 L 370 39 L 369 39 L 368 39 L 367 39 L 366 39 L 365 39 L 364 39 L 363 39 L 362 39 L 361 39 L 360 39 Z M 364 79 L 365 78 L 366 78 L 367 78 L 368 78 L 369 78 L 370 78 L 371 78 L 372 78 L 373 78 L 374 78 L 375 78 L 376 78 L 377 78 L 378 78 L 379 78 L 380 79 L 381 79 L 382 79 L 383 79 L 384 80 L 384 81 L 384 82 L 384 83 L 383 84 L 383 85 L 383 86 L 382 87 L 382 88 L 381 89 L 380 90 L 379 91 L 378 92 L 377 92 L 376 93 L 375 94 L 374 94 L 373 94 L 372 95 L 371 95 L 370 95 L 369 95 L 368 96 L 367 96 L 366 96 L 365 96 L 364 96 L 363 95 L 362 95 L 361 95 L 360 95 L 359 94 L 358 94 L 357 93 L 356 92 L 355 91 L 355 90 L 355 89 L 355 88 L 355 87 L 355 86 L 355 85 L 355 84 L 356 83 L 357 82 L 358 81 L 359 80 L 360 80 L 361 79 L 362 79 L 363 79 Z" fill="#1a1a1a" fillRule="evenodd"/>
                <path d="M 12 21 L 13 21 L 14 21 L 15 21 L 16 21 L 17 21 L 18 22 L 19 22 L 20 22 L 21 22 L 22 22 L 23 23 L 24 23 L 25 23 L 26 23 L 27 23 L 28 23 L 29 24 L 30 24 L 31 24 L 32 24 L 33 24 L 34 25 L 35 25 L 36 25 L 37 25 L 38 25 L 39 26 L 40 26 L 41 26 L 42 26 L 43 26 L 44 27 L 45 27 L 46 27 L 47 27 L 48 27 L 49 28 L 50 28 L 51 28 L 52 28 L 53 28 L 54 29 L 55 29 L 56 29 L 57 29 L 58 29 L 59 30 L 60 30 L 61 30 L 62 30 L 63 31 L 64 31 L 65 31 L 66 31 L 67 31 L 68 32 L 69 32 L 70 32 L 71 32 L 72 33 L 73 33 L 74 33 L 75 34 L 76 34 L 77 34 L 78 35 L 79 35 L 80 35 L 81 36 L 82 36 L 83 37 L 84 38 L 85 38 L 86 39 L 87 39 L 88 40 L 89 41 L 90 41 L 91 42 L 92 43 L 93 43 L 94 44 L 95 45 L 96 45 L 97 46 L 98 47 L 99 47 L 100 48 L 101 49 L 102 49 L 103 49 L 104 50 L 105 51 L 106 51 L 107 51 L 108 52 L 109 52 L 110 53 L 111 53 L 112 54 L 113 54 L 114 54 L 115 55 L 116 55 L 117 55 L 118 56 L 119 56 L 120 56 L 121 57 L 122 57 L 123 57 L 124 57 L 125 58 L 126 58 L 127 58 L 128 58 L 129 58 L 130 59 L 131 59 L 132 59 L 133 59 L 134 59 L 135 59 L 136 60 L 137 60 L 138 60 L 139 60 L 140 60 L 141 60 L 142 60 L 143 61 L 144 61 L 145 61 L 146 61 L 147 61 L 148 62 L 149 62 L 150 62 L 151 62 L 152 62 L 153 62 L 154 62 L 155 62 L 156 63 L 155 64 L 154 64 L 153 64 L 152 64 L 151 64 L 150 64 L 149 65 L 148 65 L 147 65 L 146 65 L 145 65 L 144 65 L 143 66 L 142 66 L 141 66 L 140 66 L 139 66 L 138 66 L 137 67 L 136 67 L 135 67 L 134 67 L 133 68 L 132 68 L 131 68 L 130 68 L 129 69 L 128 69 L 127 69 L 126 69 L 125 70 L 124 70 L 123 70 L 122 71 L 121 71 L 120 71 L 119 72 L 118 72 L 117 72 L 116 73 L 115 73 L 114 74 L 113 74 L 112 74 L 111 75 L 110 75 L 109 76 L 108 76 L 107 77 L 106 77 L 105 78 L 104 79 L 103 80 L 102 80 L 101 81 L 100 82 L 99 82 L 98 83 L 97 84 L 96 84 L 95 85 L 94 86 L 93 87 L 92 87 L 91 88 L 90 89 L 89 90 L 88 90 L 87 91 L 86 92 L 85 92 L 84 93 L 83 94 L 82 94 L 81 95 L 80 95 L 79 96 L 78 96 L 77 97 L 76 97 L 75 98 L 74 98 L 73 98 L 72 99 L 71 99 L 70 99 L 69 100 L 68 100 L 67 100 L 66 101 L 65 101 L 64 101 L 63 101 L 62 101 L 61 102 L 60 102 L 59 102 L 58 102 L 57 102 L 56 103 L 55 103 L 54 103 L 53 103 L 52 104 L 51 104 L 50 104 L 49 104 L 48 104 L 47 105 L 46 105 L 45 105 L 44 105 L 43 106 L 42 106 L 41 106 L 40 106 L 39 107 L 38 107 L 37 107 L 36 107 L 35 107 L 34 108 L 33 108 L 32 108 L 31 108 L 30 108 L 29 109 L 28 109 L 27 109 L 26 109 L 25 109 L 24 110 L 23 110 L 22 110 L 21 110 L 20 110 L 19 111 L 18 111 L 17 111 L 16 111 L 15 111 L 14 112 L 13 112 L 12 112 L 11 112 L 10 112 L 11 112 L 12 112 L 13 112 L 14 112 L 15 112 L 16 112 L 17 112 L 18 112 L 19 112 L 20 112 L 21 112 L 22 112 L 23 112 L 24 112 L 25 112 L 26 112 L 27 112 L 28 112 L 29 112 L 30 112 L 31 112 L 32 112 L 33 112 L 34 112 L 35 112 L 36 112 L 37 112 L 38 112 L 39 112 L 40 111 L 41 111 L 42 111 L 43 111 L 44 111 L 45 111 L 46 111 L 47 111 L 48 111 L 49 111 L 50 111 L 51 111 L 52 111 L 53 111 L 54 111 L 55 111 L 56 111 L 57 111 L 58 111 L 59 111 L 60 111 L 61 111 L 62 111 L 63 111 L 64 111 L 65 111 L 66 111 L 67 111 L 68 111 L 69 110 L 70 110 L 71 110 L 72 110 L 73 110 L 74 110 L 75 110 L 76 110 L 77 110 L 78 110 L 79 110 L 80 110 L 81 110 L 82 110 L 83 109 L 84 109 L 85 109 L 86 109 L 87 109 L 88 109 L 89 108 L 90 108 L 91 107 L 92 107 L 93 107 L 94 106 L 95 105 L 96 105 L 97 104 L 98 104 L 99 103 L 100 102 L 101 101 L 102 101 L 103 100 L 104 99 L 105 98 L 106 98 L 107 97 L 108 96 L 109 95 L 110 94 L 111 93 L 112 92 L 113 91 L 114 91 L 115 90 L 116 89 L 117 88 L 118 87 L 119 86 L 120 85 L 121 85 L 122 84 L 123 83 L 124 82 L 125 82 L 126 81 L 127 80 L 128 80 L 129 79 L 130 78 L 131 78 L 132 77 L 133 77 L 134 76 L 135 76 L 136 75 L 137 75 L 138 74 L 139 74 L 140 73 L 141 73 L 142 72 L 143 72 L 144 72 L 145 71 L 146 71 L 147 71 L 148 70 L 149 70 L 150 70 L 151 69 L 152 69 L 153 69 L 154 69 L 155 68 L 156 68 L 157 68 L 158 68 L 159 68 L 160 68 L 161 68 L 162 68 L 163 69 L 164 69 L 165 69 L 166 69 L 167 69 L 168 69 L 169 69 L 170 70 L 171 70 L 172 70 L 173 70 L 174 70 L 175 70 L 176 70 L 177 70 L 178 71 L 179 71 L 180 71 L 181 71 L 182 71 L 183 71 L 184 71 L 185 72 L 186 72 L 187 72 L 188 72 L 189 72 L 190 72 L 191 72 L 192 72 L 193 72 L 194 73 L 195 73 L 196 73 L 197 73 L 198 73 L 199 73 L 200 73 L 201 73 L 202 74 L 203 74 L 204 74 L 205 74 L 206 74 L 207 74 L 208 74 L 209 74 L 210 74 L 211 75 L 212 74 L 213 74 L 213 73 L 214 72 L 214 71 L 214 70 L 214 69 L 214 68 L 214 67 L 214 66 L 214 65 L 214 64 L 214 63 L 214 62 L 214 61 L 214 60 L 214 59 L 214 58 L 214 57 L 213 56 L 213 55 L 212 55 L 211 55 L 210 56 L 209 56 L 208 56 L 207 56 L 206 56 L 205 56 L 204 56 L 203 56 L 202 57 L 201 57 L 200 57 L 199 57 L 198 57 L 197 57 L 196 57 L 195 57 L 194 57 L 193 57 L 192 57 L 191 58 L 190 58 L 189 58 L 188 58 L 187 58 L 186 58 L 185 58 L 184 59 L 183 59 L 182 59 L 181 59 L 180 59 L 179 59 L 178 59 L 177 59 L 176 59 L 175 59 L 174 60 L 173 60 L 172 60 L 171 60 L 170 60 L 169 60 L 168 61 L 167 61 L 166 61 L 165 61 L 164 61 L 163 61 L 162 61 L 161 61 L 160 61 L 159 60 L 158 61 L 157 60 L 156 60 L 155 60 L 154 60 L 153 60 L 152 59 L 151 59 L 150 59 L 149 58 L 148 58 L 147 58 L 146 57 L 145 57 L 144 57 L 143 56 L 142 56 L 141 55 L 140 55 L 139 55 L 138 54 L 137 54 L 136 53 L 135 53 L 134 52 L 133 52 L 132 51 L 131 51 L 130 50 L 129 50 L 128 49 L 127 48 L 126 48 L 125 47 L 124 47 L 123 46 L 122 45 L 121 45 L 120 44 L 119 43 L 118 43 L 117 42 L 116 41 L 115 40 L 114 39 L 113 39 L 112 38 L 111 37 L 110 37 L 109 36 L 108 35 L 107 34 L 106 33 L 105 33 L 104 32 L 103 31 L 102 30 L 101 30 L 100 29 L 99 29 L 98 28 L 97 27 L 96 27 L 95 26 L 94 26 L 93 25 L 92 25 L 91 25 L 90 24 L 89 24 L 88 24 L 87 24 L 86 24 L 85 23 L 84 23 L 83 23 L 82 23 L 81 23 L 80 23 L 79 23 L 78 23 L 77 23 L 76 23 L 75 23 L 74 23 L 73 23 L 72 23 L 71 23 L 70 23 L 69 23 L 68 22 L 67 22 L 66 22 L 65 22 L 64 22 L 63 22 L 62 22 L 61 22 L 60 22 L 59 22 L 58 22 L 57 22 L 56 22 L 55 22 L 54 22 L 53 22 L 52 22 L 51 22 L 50 22 L 49 22 L 48 22 L 47 22 L 46 22 L 45 22 L 44 22 L 43 22 L 42 22 L 41 21 L 40 21 L 39 21 L 38 21 L 37 21 L 36 21 L 35 21 L 34 21 L 33 21 L 32 21 L 31 21 L 30 21 L 29 21 L 28 21 L 27 21 L 26 21 L 25 21 L 24 21 L 23 21 L 22 21 L 21 21 L 20 21 L 19 21 L 18 21 L 17 21 L 16 21 L 15 21 L 14 21 L 13 21 Z" fill="#1a1a1a" fillRule="evenodd"/>
                <path d="M 419 11 L 419 12 L 419 13 L 419 14 L 419 15 L 419 16 L 419 17 L 419 18 L 419 19 L 419 20 L 419 21 L 419 22 L 419 23 L 419 24 L 419 25 L 419 26 L 419 27 L 419 28 L 419 29 L 419 30 L 419 31 L 419 32 L 419 33 L 419 34 L 419 35 L 419 36 L 419 37 L 419 38 L 419 39 L 419 40 L 419 41 L 419 42 L 419 43 L 419 44 L 419 45 L 419 46 L 419 47 L 419 48 L 419 49 L 419 50 L 419 51 L 419 52 L 419 53 L 419 54 L 419 55 L 419 56 L 419 57 L 419 58 L 419 59 L 419 60 L 419 61 L 419 62 L 419 63 L 419 64 L 419 65 L 419 66 L 419 67 L 419 68 L 419 69 L 419 70 L 419 71 L 419 72 L 419 73 L 419 74 L 419 75 L 419 76 L 419 77 L 419 78 L 419 79 L 419 80 L 419 81 L 419 82 L 419 83 L 419 84 L 419 85 L 419 86 L 419 87 L 419 88 L 419 89 L 419 90 L 419 91 L 419 92 L 419 93 L 419 94 L 419 95 L 419 96 L 419 97 L 419 98 L 419 99 L 419 100 L 419 101 L 419 102 L 419 103 L 419 104 L 419 105 L 419 106 L 419 107 L 419 108 L 420 108 L 421 108 L 422 108 L 423 108 L 424 108 L 425 108 L 426 108 L 427 108 L 428 108 L 429 108 L 430 108 L 431 108 L 432 108 L 433 108 L 434 108 L 435 108 L 436 108 L 437 108 L 438 108 L 439 108 L 440 108 L 441 108 L 441 107 L 441 106 L 441 105 L 441 104 L 441 103 L 441 102 L 441 101 L 441 100 L 441 99 L 441 98 L 441 97 L 441 96 L 441 95 L 441 94 L 441 93 L 441 92 L 441 91 L 441 90 L 441 89 L 441 88 L 441 87 L 441 86 L 441 85 L 441 84 L 441 83 L 441 82 L 441 81 L 441 80 L 441 79 L 441 78 L 441 77 L 441 76 L 441 75 L 441 74 L 441 73 L 441 72 L 441 71 L 441 70 L 441 69 L 441 68 L 441 67 L 441 66 L 441 65 L 441 64 L 441 63 L 441 62 L 441 61 L 441 60 L 441 59 L 441 58 L 441 57 L 441 56 L 441 55 L 441 54 L 441 53 L 441 52 L 441 51 L 441 50 L 441 49 L 441 48 L 441 47 L 441 46 L 441 45 L 441 44 L 441 43 L 441 42 L 441 41 L 441 40 L 441 39 L 441 38 L 441 37 L 441 36 L 441 35 L 441 34 L 441 33 L 441 32 L 441 31 L 441 30 L 441 29 L 441 28 L 441 27 L 441 26 L 441 25 L 441 24 L 441 23 L 441 22 L 441 21 L 441 20 L 441 19 L 441 18 L 441 17 L 441 16 L 441 15 L 441 14 L 441 13 L 441 12 L 441 11 L 440 11 L 439 11 L 438 11 L 437 11 L 436 11 L 435 11 L 434 11 L 433 11 L 432 11 L 431 11 L 430 11 L 429 11 L 428 11 L 427 11 L 426 11 L 425 11 L 424 11 L 423 11 L 422 11 L 421 11 L 420 11 Z" fill="#1a1a1a" fillRule="evenodd"/>
                <path d="M 243 11 L 243 12 L 243 13 L 243 14 L 243 15 L 243 16 L 243 17 L 243 18 L 243 19 L 243 20 L 243 21 L 243 22 L 243 23 L 243 24 L 243 25 L 243 26 L 243 27 L 243 28 L 243 29 L 243 30 L 243 31 L 243 32 L 243 33 L 243 34 L 243 35 L 243 36 L 243 37 L 243 38 L 243 39 L 243 40 L 243 41 L 243 42 L 243 43 L 243 44 L 243 45 L 243 46 L 243 47 L 243 48 L 243 49 L 243 50 L 243 51 L 243 52 L 243 53 L 243 54 L 243 55 L 243 56 L 243 57 L 243 58 L 243 59 L 243 60 L 243 61 L 243 62 L 243 63 L 243 64 L 243 65 L 243 66 L 243 67 L 243 68 L 243 69 L 243 70 L 243 71 L 243 72 L 243 73 L 243 74 L 243 75 L 243 76 L 243 77 L 243 78 L 243 79 L 243 80 L 243 81 L 243 82 L 243 83 L 243 84 L 243 85 L 243 86 L 243 87 L 243 88 L 243 89 L 243 90 L 243 91 L 243 92 L 243 93 L 243 94 L 243 95 L 243 96 L 243 97 L 243 98 L 243 99 L 243 100 L 243 101 L 243 102 L 243 103 L 243 104 L 243 105 L 243 106 L 243 107 L 243 108 L 244 108 L 245 108 L 246 108 L 247 108 L 248 108 L 249 108 L 250 108 L 251 108 L 252 108 L 253 108 L 254 108 L 255 108 L 256 108 L 257 108 L 258 108 L 259 108 L 260 108 L 261 108 L 262 108 L 263 108 L 264 108 L 265 108 L 265 107 L 265 106 L 265 105 L 265 104 L 265 103 L 265 102 L 265 101 L 265 100 L 265 99 L 265 98 L 265 97 L 265 96 L 265 95 L 265 94 L 265 93 L 265 92 L 265 91 L 265 90 L 265 89 L 265 88 L 265 87 L 265 86 L 265 85 L 265 84 L 265 83 L 265 82 L 265 81 L 265 80 L 265 79 L 265 78 L 265 77 L 265 76 L 265 75 L 266 74 L 267 74 L 268 74 L 269 74 L 270 74 L 271 74 L 272 74 L 273 74 L 274 74 L 275 74 L 276 74 L 277 74 L 278 74 L 279 74 L 280 74 L 281 75 L 282 76 L 283 77 L 284 78 L 284 79 L 285 80 L 286 81 L 286 82 L 287 83 L 288 84 L 288 85 L 289 86 L 289 87 L 290 88 L 291 89 L 291 90 L 292 91 L 293 92 L 293 93 L 294 94 L 295 95 L 295 96 L 296 97 L 297 98 L 297 99 L 298 100 L 298 101 L 299 102 L 300 103 L 300 104 L 301 105 L 301 106 L 302 107 L 303 108 L 304 108 L 305 108 L 306 108 L 307 108 L 308 108 L 309 108 L 310 108 L 311 108 L 312 108 L 313 108 L 314 108 L 315 108 L 316 108 L 317 108 L 318 108 L 319 108 L 320 108 L 321 108 L 322 108 L 323 108 L 324 108 L 325 108 L 326 108 L 327 108 L 328 108 L 329 108 L 328 107 L 327 106 L 327 105 L 326 104 L 325 103 L 325 102 L 324 101 L 323 100 L 323 99 L 322 98 L 321 97 L 321 96 L 320 95 L 319 94 L 318 93 L 318 92 L 317 91 L 316 90 L 316 89 L 315 88 L 314 87 L 314 86 L 313 85 L 312 84 L 312 83 L 311 82 L 310 81 L 309 80 L 309 79 L 308 78 L 307 77 L 307 76 L 306 75 L 305 74 L 305 73 L 304 72 L 305 71 L 306 71 L 307 70 L 308 70 L 309 69 L 310 69 L 311 68 L 312 68 L 313 67 L 314 66 L 315 66 L 316 65 L 317 64 L 318 63 L 319 62 L 319 61 L 320 60 L 321 59 L 322 58 L 322 57 L 323 56 L 323 55 L 323 54 L 324 53 L 324 52 L 324 51 L 325 50 L 325 49 L 325 48 L 325 47 L 325 46 L 325 45 L 325 44 L 326 43 L 326 42 L 325 41 L 325 40 L 325 39 L 325 38 L 325 37 L 325 36 L 325 35 L 324 34 L 324 33 L 324 32 L 324 31 L 323 30 L 323 29 L 322 28 L 322 27 L 321 26 L 321 25 L 320 24 L 319 23 L 318 22 L 317 21 L 316 20 L 315 19 L 314 18 L 313 18 L 312 17 L 311 16 L 310 16 L 309 15 L 308 15 L 307 15 L 306 14 L 305 14 L 304 14 L 303 13 L 302 13 L 301 13 L 300 13 L 299 12 L 298 12 L 297 12 L 296 12 L 295 12 L 294 12 L 293 12 L 292 12 L 291 12 L 290 12 L 289 12 L 288 12 L 287 12 L 286 12 L 285 12 L 284 12 L 283 12 L 282 12 L 281 12 L 280 12 L 279 12 L 278 11 L 277 12 L 276 11 L 275 11 L 274 11 L 273 11 L 272 11 L 271 11 L 270 11 L 269 11 L 268 11 L 267 11 L 266 11 L 265 11 L 264 11 L 263 11 L 262 11 L 261 11 L 260 11 L 259 11 L 258 11 L 257 11 L 256 11 L 255 11 L 254 11 L 253 11 L 252 11 L 251 11 L 250 11 L 249 11 L 248 11 L 247 11 L 246 11 L 245 11 L 244 11 Z M 265 29 L 266 28 L 267 28 L 268 28 L 269 28 L 270 28 L 271 28 L 272 28 L 273 28 L 274 28 L 275 28 L 276 28 L 277 28 L 278 28 L 279 28 L 280 28 L 281 28 L 282 28 L 283 28 L 284 28 L 285 28 L 286 28 L 287 28 L 288 29 L 289 29 L 290 29 L 291 29 L 292 29 L 293 30 L 294 30 L 295 31 L 296 31 L 297 32 L 298 33 L 299 34 L 300 35 L 300 36 L 301 37 L 301 38 L 301 39 L 302 40 L 302 41 L 302 42 L 302 43 L 302 44 L 302 45 L 302 46 L 301 47 L 301 48 L 301 49 L 301 50 L 300 51 L 300 52 L 299 53 L 298 54 L 297 55 L 296 56 L 295 56 L 294 57 L 293 57 L 292 58 L 291 58 L 290 58 L 289 58 L 288 58 L 287 59 L 286 59 L 285 59 L 284 59 L 283 59 L 282 59 L 281 59 L 280 59 L 279 59 L 278 59 L 277 59 L 276 59 L 275 59 L 274 59 L 273 59 L 272 59 L 271 59 L 270 59 L 269 59 L 268 59 L 267 59 L 266 59 L 265 58 L 265 57 L 265 56 L 265 55 L 265 54 L 265 53 L 265 52 L 265 51 L 265 50 L 265 49 L 265 48 L 265 47 L 265 46 L 265 45 L 265 44 L 265 43 L 265 42 L 265 41 L 265 40 L 265 39 L 265 38 L 265 37 L 265 36 L 265 35 L 265 34 L 265 33 L 265 32 L 265 31 L 265 30 Z" fill="#1a1a1a" fillRule="evenodd"/>
                <path d="M 458 10 L 457 11 L 457 12 L 457 13 L 457 14 L 457 15 L 457 16 L 457 17 L 457 18 L 457 19 L 457 20 L 457 21 L 457 22 L 457 23 L 457 24 L 457 25 L 457 26 L 457 27 L 457 28 L 457 29 L 457 30 L 457 31 L 457 32 L 457 33 L 457 34 L 457 35 L 457 36 L 457 37 L 457 38 L 457 39 L 457 40 L 457 41 L 457 42 L 457 43 L 457 44 L 457 45 L 457 46 L 457 47 L 457 48 L 457 49 L 457 50 L 457 51 L 457 52 L 457 53 L 457 54 L 457 55 L 457 56 L 457 57 L 457 58 L 457 59 L 457 60 L 457 61 L 457 62 L 457 63 L 457 64 L 457 65 L 457 66 L 457 67 L 457 68 L 457 69 L 457 70 L 457 71 L 457 72 L 457 73 L 457 74 L 457 75 L 457 76 L 457 77 L 457 78 L 457 79 L 457 80 L 457 81 L 457 82 L 457 83 L 457 84 L 457 85 L 457 86 L 457 87 L 457 88 L 457 89 L 457 90 L 457 91 L 457 92 L 457 93 L 457 94 L 457 95 L 457 96 L 457 97 L 457 98 L 457 99 L 457 100 L 457 101 L 457 102 L 457 103 L 457 104 L 457 105 L 457 106 L 457 107 L 457 108 L 458 108 L 459 108 L 460 108 L 461 108 L 462 108 L 463 108 L 464 108 L 465 108 L 466 108 L 467 108 L 468 108 L 469 108 L 470 108 L 471 108 L 472 108 L 473 108 L 474 108 L 475 108 L 476 108 L 477 108 L 478 108 L 479 108 L 479 107 L 479 106 L 479 105 L 479 104 L 479 103 L 479 102 L 479 101 L 479 100 L 479 99 L 479 98 L 479 97 L 479 96 L 479 95 L 479 94 L 479 93 L 479 92 L 479 91 L 479 90 L 479 89 L 479 88 L 479 87 L 479 86 L 479 85 L 479 84 L 479 83 L 479 82 L 479 81 L 479 80 L 479 79 L 479 78 L 479 77 L 479 76 L 479 75 L 479 74 L 479 73 L 479 72 L 479 71 L 479 70 L 479 69 L 479 68 L 479 67 L 479 66 L 479 65 L 479 64 L 479 63 L 479 62 L 479 61 L 479 60 L 479 59 L 479 58 L 479 57 L 479 56 L 479 55 L 479 54 L 479 53 L 479 52 L 479 51 L 479 50 L 479 49 L 479 48 L 479 47 L 479 46 L 479 45 L 479 44 L 479 43 L 479 42 L 479 41 L 479 40 L 479 39 L 479 38 L 479 37 L 479 36 L 479 35 L 479 34 L 479 33 L 479 32 L 479 31 L 479 30 L 479 29 L 479 28 L 479 27 L 479 26 L 479 25 L 479 24 L 479 23 L 479 22 L 479 21 L 479 20 L 479 19 L 479 18 L 479 17 L 479 16 L 479 15 L 479 14 L 479 13 L 479 12 L 479 11 L 478 11 L 477 11 L 476 11 L 475 11 L 474 11 L 473 11 L 472 11 L 471 11 L 470 11 L 469 11 L 468 11 L 467 11 L 466 11 L 465 11 L 464 11 L 463 11 L 462 11 L 461 11 L 460 11 L 459 11 Z" fill="#1a1a1a" fillRule="evenodd"/>
              </svg>
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
        </main>

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
            <span className="tab-text">Tournaments</span>
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
      </div>
      {showInbox && (
        <div ref={inboxWrapperRef}>
        <Inbox
          currentPlayerId={profile.id}
          currentPlayerName={profile.name}
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

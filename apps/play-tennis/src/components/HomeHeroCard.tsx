import { useState, useEffect, useRef } from 'react'
import {
  getLobbyByCounty, joinLobby, leaveLobby, isInLobby,
  startTournamentFromLobby, getSetupTournamentForCounty,
  getCountdownRemaining, checkCountdownExpired,
  getSchedulingConfidence, getAvailability,
} from '../store'
import { SYNC_EVENT } from '../sync'
import { PlayerProfile, Tournament, LobbyEntry } from '../types'

type HeroState =
  | 'new'                         // Not joined, no tournament history
  | 'returning'                   // Has played before, not in a tournament
  | 'joined-needs-availability'   // In lobby/setup, < 6 players, no availability
  | 'joined-ready'                // In lobby/setup, < 6 players, has availability
  | 'countdown-needs-availability'// 6+ players, countdown, no availability
  | 'countdown-ready'             // 6+ players, countdown, has availability
  | 'active-needs-availability'   // Tournament live, no availability
  | 'active'                      // Tournament live, has availability

interface Props {
  profile: PlayerProfile
  tournaments: Tournament[]
  autoJoin?: boolean
  onAutoJoinConsumed?: () => void
  onTournamentCreated: (id: string) => void
  onSetAvailability?: () => void
  onViewHelp?: () => void
  actionCardCount: number
}

function getInviteLink(county: string): string {
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('join', county)
  return url.toString()
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`
}

export default function HomeHeroCard({
  profile,
  tournaments,
  autoJoin,
  onAutoJoinConsumed,
  onTournamentCreated,
  onSetAvailability,
  onViewHelp,
  actionCardCount,
}: Props) {
  const [entries, setEntries] = useState<LobbyEntry[]>([])
  const [joined, setJoined] = useState(false)
  const [setupTournament, setSetupTournament] = useState<Tournament | null>(null)
  const [countdown, setCountdown] = useState<string | null>(null)
  const [showShareSheet, setShowShareSheet] = useState(false)
  const [copied, setCopied] = useState(false)
  const [hiwExpanded, setHiwExpanded] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoJoinedRef = useRef(false)
  const joiningRef = useRef(false)

  const isInSetupTournament = setupTournament?.players.some(p => p.id === profile.id) ?? false

  function refreshState() {
    setEntries(getLobbyByCounty(profile.county))
    setJoined(isInLobby(profile.id))
    const t = getSetupTournamentForCounty(profile.county)
    setSetupTournament(t ?? null)
  }

  useEffect(() => { refreshState() }, [profile])

  useEffect(() => {
    function handleSync() {
      if (joiningRef.current) return
      refreshState()
    }
    window.addEventListener(SYNC_EVENT, handleSync)
    return () => window.removeEventListener(SYNC_EVENT, handleSync)
  }, [profile])

  // Auto-join
  useEffect(() => {
    if (autoJoin && !autoJoinedRef.current && !joined && !isInSetupTournament) {
      autoJoinedRef.current = true
      handleJoin()
      onAutoJoinConsumed?.()
    }
  }, [autoJoin, joined])

  // Countdown timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (!setupTournament) { setCountdown(null); return }

    function tick() {
      if (!setupTournament) return
      const remaining = getCountdownRemaining(setupTournament)
      if (remaining === null) { setCountdown(null); return }
      if (remaining <= 0) {
        checkCountdownExpired(setupTournament.id).then(started => {
          if (started && started.status === 'in-progress') {
            onTournamentCreated(started.id)
          }
        })
        setCountdown(null)
        if (timerRef.current) clearInterval(timerRef.current)
        return
      }
      setCountdown(formatCountdown(remaining))
    }

    tick()
    timerRef.current = setInterval(tick, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [setupTournament])

  async function handleJoin() {
    joiningRef.current = true
    try {
      const updated = await joinLobby(profile)
      setEntries(updated)
      setJoined(true)

      if (updated.length >= 6 || getSetupTournamentForCounty(profile.county)) {
        const tournament = await startTournamentFromLobby(profile.county)
        if (tournament) {
          if (tournament.status === 'in-progress') {
            onTournamentCreated(tournament.id)
            return
          }
          setSetupTournament(tournament)
          setEntries(getLobbyByCounty(profile.county))
          return
        }
      }
    } catch {
      refreshState()
    } finally {
      joiningRef.current = false
      refreshState()
    }
  }

  async function handleLeave() {
    await leaveLobby(profile.id)
    setEntries(getLobbyByCounty(profile.county))
    setJoined(false)
  }

  function handleShareInvite() {
    const link = getInviteLink(profile.county)
    const message = `I just started a Rally tennis tournament in ${profile.county}.\nJoin and compete: ${link}`
    if (navigator.share) {
      navigator.share({ title: 'Rally Tennis', text: message, url: link }).catch(() => {
        setShowShareSheet(true)
      })
    } else {
      setShowShareSheet(true)
    }
  }

  function handleCopyLink() {
    const link = getInviteLink(profile.county)
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleSMS() {
    const link = getInviteLink(profile.county)
    const message = `I just started a Rally tennis tournament in ${profile.county}.\nJoin and compete: ${link}`
    window.open(`sms:?body=${encodeURIComponent(message)}`, '_self')
    setShowShareSheet(false)
  }

  function handleWhatsApp() {
    const link = getInviteLink(profile.county)
    const message = `I just started a Rally tennis tournament in ${profile.county}.\nJoin and compete: ${link}`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
    setShowShareSheet(false)
  }

  // --- Derived state ---
  const hasAvailability = getAvailability(profile.id).length > 0
  const hasPlayedMatch = tournaments.some(t =>
    t.matches.some(m => m.completed && (m.player1Id === profile.id || m.player2Id === profile.id))
  )

  const activeTournament = tournaments.find(
    t => t.status === 'in-progress' && t.players.some(p => p.id === profile.id)
  )

  const setupPlayers = setupTournament?.players ?? []
  const totalJoined = setupPlayers.length + entries.length
  const isUserInvolved = joined || isInSetupTournament
  const targetPlayers = 6
  const maxPlayers = 8
  const tournamentReady = setupTournament && setupPlayers.length >= targetPlayers
  const spotsLeft = setupTournament ? maxPlayers - setupPlayers.length : 0

  // Determine hero state
  const heroState: HeroState = (() => {
    if (activeTournament) {
      return hasAvailability ? 'active' : 'active-needs-availability'
    }
    if (tournamentReady) {
      return hasAvailability ? 'countdown-ready' : 'countdown-needs-availability'
    }
    if (isUserInvolved) {
      return hasAvailability ? 'joined-ready' : 'joined-needs-availability'
    }
    if (hasPlayedMatch) return 'returning'
    return 'new'
  })()

  // Progress bar
  const progressPct = tournamentReady
    ? (setupPlayers.length / maxPlayers) * 100
    : Math.min((totalJoined / targetPlayers) * 100, 100)
  const progressColor = totalJoined === 0
    ? 'var(--color-text-muted)'
    : totalJoined >= targetPlayers
      ? 'var(--color-positive-primary)'
      : 'var(--color-accent-primary)'

  // --- Status badge ---
  function getStatusBadge(): { label: string; color: string; chip: string } {
    switch (heroState) {
      case 'active':
      case 'active-needs-availability':
        return { label: 'Your Tournament', color: 'slate', chip: 'In Progress' }
      case 'countdown-ready':
      case 'countdown-needs-availability':
        return { label: 'Starting Soon', color: 'green', chip: `${setupPlayers.length}/${maxPlayers}` }
      case 'returning':
        return { label: 'Next Tournament', color: 'blue', chip: `${totalJoined}/${targetPlayers}` }
      default:
        return { label: 'Tournament Forming', color: 'blue', chip: `${totalJoined}/${targetPlayers}` }
    }
  }

  const badge = getStatusBadge()

  // Show "How it works" only in pre-tournament states
  const showHowItWorks = !activeTournament

  // --- Active tournament rendering ---
  if (activeTournament) {
    const totalMatches = activeTournament.matches.filter(m => m.player1Id && m.player2Id).length
    const completedMatches = activeTournament.matches.filter(m => m.completed).length
    const progressPctActive = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0

    return (
      <div className="card formation-hero">
        <div className="card-status-row">
          <div className="card-status-label card-status-label--slate">Your Tournament</div>
          <div className="card-meta-chip">{progressPctActive}% complete</div>
        </div>
        <div className="card-summary-main">
          <div className="card-title">{activeTournament.name}</div>
          <div className="card-supporting">
            {activeTournament.players.length} players · {activeTournament.format === 'single-elimination' ? 'Playoffs' : activeTournament.format === 'group-knockout' ? 'Group + Playoffs' : 'Round robin'} · {completedMatches} of {totalMatches} matches played
          </div>
        </div>
        <div className="tournament-progress-bar">
          <div className="tournament-progress-fill" style={{ width: `${progressPctActive}%` }} />
        </div>

        {heroState === 'active-needs-availability' && (
          <div className="hero-next-step hero-next-step--warning">
            <span className="hero-step-icon">&#9888;</span>
            <div className="hero-step-text">
              <strong>Your matches can't be scheduled yet</strong>
              <span>Add your availability so Rally can find times that work for you</span>
            </div>
          </div>
        )}

        {heroState === 'active-needs-availability' && (
          <div className="formation-actions">
            <button className="btn btn-primary btn-large formation-cta-primary" onClick={onSetAvailability}>
              Set Your Availability
            </button>
          </div>
        )}

        {heroState === 'active' && actionCardCount === 0 && (
          <>
            <div className="hero-all-clear">
              <span className="hero-check">&#10003;</span> You're all caught up
            </div>
            <div className="hero-invite-nudge">
              <span>Know someone who'd enjoy Rally?</span>
              <button className="btn btn-large formation-cta-secondary" onClick={handleShareInvite}>
                Invite to Next Tournament
              </button>
            </div>
          </>
        )}

        {heroState === 'active' && actionCardCount > 0 && (
          <div className="hero-action-summary">
            {actionCardCount} match{actionCardCount !== 1 ? 'es' : ''} need{actionCardCount === 1 ? 's' : ''} your attention
          </div>
        )}
      </div>
    )
  }

  // --- Pre-tournament rendering ---
  const playersNeeded = targetPlayers - totalJoined

  return (
    <div className="lobby-section">
      <div className="card formation-hero">
        <div className="card-status-row">
          <div className={`card-status-label card-status-label--${badge.color}`}>{badge.label}</div>
          <div className="card-meta-chip">{badge.chip}</div>
        </div>
        <div className="card-summary-main">
          <div className="card-title">{profile.county} Tournament{tournamentReady ? ' Starting' : ' Forming'}</div>
          <div className="card-supporting">
            {heroState === 'new' && '6\u20138 players compete in a local round-robin tournament.'}
            {heroState === 'returning' && (
              <>Join the next season.</>
            )}
            {heroState === 'joined-needs-availability' && (
              <>You're in! {playersNeeded > 0 ? `${playersNeeded} more player${playersNeeded !== 1 ? 's' : ''} needed to start the countdown.` : 'Waiting for more players.'}</>
            )}
            {heroState === 'joined-ready' && (
              <>You're all set. {playersNeeded > 0 ? `${playersNeeded} more player${playersNeeded !== 1 ? 's' : ''} needed to start the countdown.` : 'Waiting for more players.'}</>
            )}
            {heroState === 'countdown-needs-availability' && 'Tournament starts when the countdown ends. Set your availability now!'}
            {heroState === 'countdown-ready' && "You're ready! Tournament starts when the countdown ends."}
          </div>
        </div>

        {/* Countdown timer */}
        {tournamentReady && countdown && (
          <div className="formation-countdown">
            <div className="formation-countdown-label">Starts in</div>
            <div className="formation-countdown-timer">{countdown}</div>
          </div>
        )}

        {/* Player count + progress bar */}
        <div className="formation-player-count">
          <span className="formation-count-mono">{tournamentReady ? setupPlayers.length : totalJoined}</span>
          <span className="formation-count-sep">/</span>
          <span className="formation-count-mono">{tournamentReady ? maxPlayers : targetPlayers}</span>
          <span className="formation-count-label">players joined</span>
        </div>
        <div className="formation-progress-bar formation-progress-animated">
          <div className="formation-progress-fill" style={{ width: `${progressPct}%`, background: progressColor }} />
        </div>

        {/* Spots remaining (countdown mode) */}
        {tournamentReady && spotsLeft > 0 && (
          <p className="formation-logic">{spotsLeft} spot{spotsLeft === 1 ? '' : 's'} remaining before bracket is full</p>
        )}

        {/* Formation explanation (pre-countdown) */}
        {!tournamentReady && heroState === 'new' && (
          <p className="formation-logic">When {targetPlayers} players join, a 48-hour countdown begins. Tournament starts when it ends or {maxPlayers} join.</p>
        )}

        {/* Next step hints */}
        {(heroState === 'joined-needs-availability' || heroState === 'countdown-needs-availability') && (
          <div className="hero-next-step hero-next-step--info">
            <span className="hero-step-icon">&#9675;</span>
            <div className="hero-step-text">
              <strong>Set your availability</strong>
              <span>So matches auto-schedule when the tournament starts</span>
            </div>
          </div>
        )}

        {(heroState === 'joined-ready' || heroState === 'countdown-ready') && (
          <div className="hero-checklist">
            <div className="hero-check-item"><span className="hero-check-done">&#10003;</span> Profile complete</div>
            <div className="hero-check-item"><span className="hero-check-done">&#10003;</span> Availability set</div>
            {isUserInvolved && <div className="hero-check-item"><span className="hero-check-done">&#10003;</span> Joined tournament</div>}
          </div>
        )}

        {!tournamentReady && heroState === 'joined-ready' && (
          <p className="formation-logic">When {targetPlayers} players join, a 48-hour countdown begins. Your matches will auto-schedule.</p>
        )}

        {/* Primary CTA */}
        <div className="formation-actions">
          {/* Set Availability (highest priority when missing) */}
          {(heroState === 'joined-needs-availability' || heroState === 'countdown-needs-availability') && (
            <>
              <button className="btn btn-primary btn-large formation-cta-primary" onClick={onSetAvailability}>
                Set Your Availability
              </button>
              {isUserInvolved && (
                <button className="btn btn-large formation-cta-secondary" onClick={handleShareInvite}>
                  Invite Friends
                </button>
              )}
            </>
          )}

          {/* Join Tournament (when not joined) */}
          {(heroState === 'new' || heroState === 'returning') && (
            <>
              <button className="btn btn-primary btn-large formation-cta-primary" onClick={handleJoin}>
                Join Tournament
              </button>
              <button className="btn btn-large formation-cta-secondary" onClick={handleCopyLink}>
                {copied ? 'Copied!' : 'Copy Invite Link'}
              </button>
            </>
          )}

          {/* Invite (when joined, has availability, waiting for players) */}
          {heroState === 'joined-ready' && (
            <>
              <button className="btn btn-primary btn-large formation-cta-primary" onClick={handleShareInvite}>
                Invite Friends
              </button>
              <button className="btn btn-large formation-cta-secondary" onClick={handleCopyLink}>
                {copied ? 'Copied!' : 'Copy Invite Link'}
              </button>
            </>
          )}

          {/* Countdown ready - invite with spots context */}
          {heroState === 'countdown-ready' && (
            <>
              {spotsLeft > 0 ? (
                <button className="btn btn-primary btn-large formation-cta-primary" onClick={handleShareInvite}>
                  {spotsLeft === 1 ? 'Invite One More Player' : `Invite ${spotsLeft} More Players`}
                </button>
              ) : (
                <p className="formation-logic">Bracket full — tournament starts when countdown ends.</p>
              )}
            </>
          )}
        </div>

        {/* How Rally Works (collapsible) */}
        {showHowItWorks && (
          <div className="hero-how-it-works">
            <button
              className="hero-hiw-toggle"
              onClick={() => setHiwExpanded(!hiwExpanded)}
            >
              <span className="hero-hiw-chevron">{hiwExpanded ? '\u25BE' : '\u25B8'}</span>
              How does Rally work?
            </button>
            {hiwExpanded && (
              <div className="hero-hiw-content">
                <div className="how-rally-steps">
                  <div className="how-rally-step">
                    <div className="how-rally-step-icon how-rally-step-icon--join">1</div>
                    <div className="how-rally-step-text">
                      <strong>Join</strong>
                      <span>Sign up for a tournament in your area</span>
                    </div>
                  </div>
                  <div className="how-rally-step">
                    <div className="how-rally-step-icon how-rally-step-icon--play">2</div>
                    <div className="how-rally-step-text">
                      <strong>Play</strong>
                      <span>Matches auto-scheduled from your availability</span>
                    </div>
                  </div>
                  <div className="how-rally-step">
                    <div className="how-rally-step-icon how-rally-step-icon--compete">3</div>
                    <div className="how-rally-step-text">
                      <strong>Compete</strong>
                      <span>Top 4 advance to finals for the championship</span>
                    </div>
                  </div>
                </div>
                <div className="how-rally-footer">
                  ~30 days per season
                  {onViewHelp && <button className="how-rally-learn-more" onClick={onViewHelp}>Learn more</button>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scheduling confidence preview */}
      {isUserInvolved && totalJoined >= 4 && (() => {
        const confidence = getSchedulingConfidence(profile.county)
        if (confidence.playersWithAvailability < 2) return null
        return (
          <div className="card scheduling-confidence">
            <div className="card-status-row">
              <div className="card-status-label card-status-label--slate">Scheduling Confidence</div>
              <div className="card-meta-chip">{confidence.score}%</div>
            </div>
            <div className="card-summary-main">
              <div className="card-title">How likely matches are to auto-schedule</div>
              <div className="card-supporting">Based on {confidence.playersWithAvailability} players&apos; saved availability.</div>
            </div>
            <div className="confidence-bar">
              <div
                className={`confidence-fill confidence-fill--${confidence.label}`}
                style={{ width: `${confidence.score}%` }}
              />
            </div>
            <div className="confidence-value" style={{
              color: confidence.label === 'high' ? 'var(--color-positive-primary)' :
                     confidence.label === 'medium' ? 'var(--color-accent-primary, #2563EB)' :
                     'var(--color-warning-primary, #F59E0B)'
            }}>
              {confidence.score}%
            </div>
            <div className="confidence-label">
              {confidence.label === 'high' ? 'High -- most matches can be auto-scheduled' :
               confidence.label === 'medium' ? 'Medium -- some matches may need manual scheduling' :
               'Low -- many matches will need manual scheduling'}
            </div>
          </div>
        )
      })()}

      {/* Leave option */}
      {isUserInvolved && !isInSetupTournament && (
        <div className="formation-leave">
          <button className="btn-link" onClick={handleLeave}>Leave tournament</button>
        </div>
      )}

      {/* Share Sheet Modal */}
      {showShareSheet && (
        <div className="modal-overlay" onClick={() => setShowShareSheet(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Invite Players</h2>
            <div className="share-options">
              <button className="btn btn-large" onClick={handleSMS}>Text Message</button>
              <button className="btn btn-large" onClick={handleWhatsApp}>WhatsApp</button>
              <button className="btn btn-large" onClick={() => { handleCopyLink(); setShowShareSheet(false) }}>
                {copied ? 'Copied!' : 'Copy Invite Link'}
              </button>
            </div>
            <div className="share-close">
              <button className="btn-link" onClick={() => setShowShareSheet(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

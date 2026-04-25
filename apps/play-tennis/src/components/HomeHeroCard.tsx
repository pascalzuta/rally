import { useState, useEffect, useRef } from 'react'
import { titleCase } from '../dateUtils'
import {
  getLobbyByCounty, joinLobby, leaveLobby, isInLobby,
  startTournamentFromLobby, getSetupTournamentForCounty,
  getCountdownRemaining, checkCountdownExpired,
  getSchedulingConfidence, getAvailability,
} from '../store'
import { useRallyData } from '../context/RallyDataProvider'
import { PlayerProfile, Tournament, LobbyEntry } from '../types'
import WelcomeCard, { ActivationStep } from './WelcomeCard'

type HeroState =
  | 'new'
  | 'returning'
  | 'joined-needs-availability'
  | 'joined-ready'
  | 'countdown-needs-availability'
  | 'countdown-ready'
  | 'active-needs-availability'
  | 'active'

interface Props {
  profile: PlayerProfile
  tournaments: Tournament[]
  autoJoin?: boolean
  onAutoJoinConsumed?: () => void
  onTournamentCreated: (id: string) => void
  onSetAvailability?: () => void
  onJoinLobby?: () => void
  onFindMatch?: () => void
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

function getActivationSteps(
  profile: PlayerProfile,
  tournaments: Tournament[],
  hasAvailability: boolean,
  hasPlayedMatch: boolean
): ActivationStep[] {
  const inLobby = isInLobby(profile.id)
  const inTournament = tournaments.some(t =>
    (t.status === 'setup' || t.status === 'in-progress') &&
    t.players.some(p => p.id === profile.id)
  )

  return [
    { label: 'Set up your profile', completed: true },
    { label: `Join the ${titleCase(profile.county)} lobby`, completed: inLobby || inTournament || hasPlayedMatch },
    { label: 'Set your availability', completed: hasAvailability },
    { label: 'Play your first match', completed: hasPlayedMatch },
  ]
}

export default function HomeHeroCard({
  profile,
  tournaments,
  autoJoin,
  onAutoJoinConsumed,
  onTournamentCreated,
  onSetAvailability,
  onJoinLobby,
  onFindMatch,
  actionCardCount,
}: Props) {
  const { lobby: providerLobby, tournaments: providerTournaments } = useRallyData()
  const [entries, setEntries] = useState<LobbyEntry[]>([])
  const [joined, setJoined] = useState(false)
  const [setupTournament, setSetupTournament] = useState<Tournament | null>(null)
  const [countdown, setCountdown] = useState<string | null>(null)
  const [showShareSheet, setShowShareSheet] = useState(false)
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoJoinedRef = useRef(false)
  const joiningRef = useRef(false)

  const isInSetupTournament = setupTournament?.players.some(p => p.id === profile.id) ?? false

  // Derive lobby entries directly from provider state — no bridge roundtrip
  function refreshState() {
    const countyLobby = providerLobby.filter(
      e => e.county.toLowerCase() === profile.county.toLowerCase()
    )
    setEntries(countyLobby)
    setJoined(countyLobby.some(e => e.playerId === profile.id))
    const t = providerTournaments.find(
      pt => pt.status === 'setup' && pt.county.toLowerCase() === profile.county.toLowerCase()
    ) ?? null
    setSetupTournament(t)
  }

  useEffect(() => { refreshState() }, [profile])

  // React to Supabase realtime updates via provider — data is always fresh
  useEffect(() => {
    if (joiningRef.current) return
    refreshState()
  }, [providerLobby, providerTournaments])

  // Auto-trigger tournament when lobby reaches 6 via realtime sync
  // (not just when the joining player clicks the button)
  const autoTriggerRef = useRef(false)
  useEffect(() => {
    if (autoTriggerRef.current || joiningRef.current) return
    const countyLobby = providerLobby.filter(
      e => e.county.toLowerCase() === profile.county.toLowerCase()
    )
    const userInLobby = countyLobby.some(e => e.playerId === profile.id)
    // Re-run even when a setup tournament already exists: startTournamentFromLobby
    // handles both "create new" and "add to existing partition" paths, and also
    // runs the >=MAX_PLAYERS auto-start loop. Gating on !alreadyHasSetup meant
    // lobby growth past 6 never promoted players into the live tournament.
    if (userInLobby && countyLobby.length >= 6) {
      autoTriggerRef.current = true
      startTournamentFromLobby(profile.county).then(tournament => {
        if (tournament) {
          if (tournament.status === 'in-progress') {
            onTournamentCreated(tournament.id)
          } else {
            setSetupTournament(tournament)
          }
        }
        autoTriggerRef.current = false
      })
    }
  }, [providerLobby])

  useEffect(() => {
    if (autoJoin && !autoJoinedRef.current && !joined && !isInSetupTournament) {
      autoJoinedRef.current = true
      handleJoin()
      onAutoJoinConsumed?.()
    }
  }, [autoJoin, joined])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (!setupTournament) { setCountdown(null); return }

    function tick() {
      // Use the setupTournament already in state rather than re-looking-up by
      // (county, gender, skillLevel). getSetupTournamentForCounty's partition
      // filter means a call missing the partition args always returns undefined,
      // which silently killed the countdown. The state reference is fresh enough
      // because RallyDataProvider pushes updates whenever the tournament changes.
      if (!setupTournament) { setCountdown(null); return }
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
    const message = `I just started a Rally tennis tournament in ${titleCase(profile.county)}.\nJoin and compete: ${link}`
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
    const message = `I just started a Rally tennis tournament in ${titleCase(profile.county)}.\nJoin and compete: ${link}`
    window.open(`sms:?body=${encodeURIComponent(message)}`, '_self')
    setShowShareSheet(false)
  }

  function handleWhatsApp() {
    const link = getInviteLink(profile.county)
    const message = `I just started a Rally tennis tournament in ${titleCase(profile.county)}.\nJoin and compete: ${link}`
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

  const activationSteps = getActivationSteps(profile, tournaments, hasAvailability, hasPlayedMatch)
  const showOnboarding = !activationSteps.every(s => s.completed)

  const setupPlayers = setupTournament?.players ?? []
  const totalJoined = setupPlayers.length + entries.length
  const isUserInvolved = joined || isInSetupTournament
  const targetPlayers = 6
  const maxPlayers = 8
  const tournamentReady = setupTournament && setupPlayers.length >= targetPlayers
  const spotsLeft = setupTournament ? maxPlayers - setupPlayers.length : 0

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

  const progressPct = tournamentReady
    ? (setupPlayers.length / maxPlayers) * 100
    : Math.min((totalJoined / targetPlayers) * 100, 100)
  const progressColor = totalJoined === 0
    ? 'var(--color-text-muted)'
    : totalJoined >= targetPlayers
      ? 'var(--color-positive-primary)'
      : 'var(--color-accent-primary)'

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

  // --- Active tournament rendering ---
  if (activeTournament) {
    const totalMatches = activeTournament.matches.filter(m => m.player1Id && m.player2Id).length
    const completedMatches = activeTournament.matches.filter(m => m.completed).length

    // Split tournament name so "Open #N" (or trailing portion after the city) renders in italic blue
    // matching screenshot 04: "Mineral County, CO Open #2" → "Open #2" italic blue.
    const tName = activeTournament.name
    const tMatch = tName.match(/^(.*?)(\s)(Open\s+#?\d+|Tournament|League|Season.*|Cup.*|Championship.*)$/i)
    const tBase = tMatch ? tMatch[1] : tName
    const tEm = tMatch ? tMatch[3] : ''
    const formatLabel = activeTournament.format === 'single-elimination'
      ? 'Elimination'
      : activeTournament.format === 'group-knockout'
        ? 'Round robin + Playoffs'
        : 'Round robin'

    return (
      <div className="b-card" style={{ margin: '10px 14px' }}>
        <div className="b-card-head">
          <span className="b-card-head-left">Your tournament</span>
          <span className="b-card-head-right">{completedMatches} / {totalMatches} matches</span>
        </div>
        <h3 className="b-card-title">
          {tBase}{tEm ? <> <em className="bg-em">{tEm}</em></> : null}
        </h3>
        <p className="b-card-supporting">
          {activeTournament.players.length} players · {formatLabel}
        </p>

        {(heroState === 'active-needs-availability' || (heroState === 'active' && actionCardCount > 0) || (heroState === 'active' && actionCardCount === 0)) && (
          <hr className="b-card-divider" />
        )}

        {heroState === 'active-needs-availability' && (
          <>
            <div className="b-card-attention-row">
              <span className="b-status-dot b-status-dot--amber" />
              <span>Set your availability to get matches scheduled</span>
            </div>
            <button className="b-btn-block" style={{ marginTop: 14 }} onClick={onSetAvailability}>
              Set Your Availability
            </button>
          </>
        )}

        {heroState === 'active' && actionCardCount === 0 && (
          <div className="b-card-attention-row">
            <span className="b-status-dot b-status-dot--blue" />
            <span>You're all caught up</span>
          </div>
        )}

        {heroState === 'active' && actionCardCount > 0 && (
          <div className="b-card-attention-row">
            <span className="b-status-dot b-status-dot--blue" />
            <span>{actionCardCount} match{actionCardCount !== 1 ? 'es' : ''} need{actionCardCount === 1 ? 's' : ''} your attention</span>
          </div>
        )}

        {showOnboarding && (
          <div style={{ marginTop: 'var(--space-md)', borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-md)' }}>
            <WelcomeCard
              activationSteps={activationSteps}
              county={profile.county}
              onJoinLobby={onJoinLobby || (() => {})}
              onSetAvailability={onSetAvailability || (() => {})}
              onFindMatch={onFindMatch || (() => {})}
              hideAction
            />
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
          <div className="card-title">{titleCase(profile.county)} Tournament{tournamentReady ? ' Starting' : ' Forming'}</div>
          <div className="card-supporting">
            {heroState === 'new' && '6\u20138 players compete in a local round-robin tournament.'}
            {heroState === 'returning' && 'Join the next season.'}
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

        {tournamentReady && countdown && (
          <div className="formation-countdown">
            <div className="formation-countdown-label">Starts in</div>
            <div className="formation-countdown-timer">{countdown}</div>
          </div>
        )}

        <div className="formation-player-count">
          <span className="formation-count-mono">{tournamentReady ? setupPlayers.length : totalJoined}</span>
          <span className="formation-count-sep">/</span>
          <span className="formation-count-mono">{tournamentReady ? maxPlayers : targetPlayers}</span>
          <span className="formation-count-label">players joined</span>
        </div>
        <div className="formation-progress-bar formation-progress-animated">
          <div className="formation-progress-fill" style={{ width: `${progressPct}%`, background: progressColor }} />
        </div>

        {tournamentReady && spotsLeft > 0 && (
          <p className="formation-logic">{spotsLeft} spot{spotsLeft === 1 ? '' : 's'} remaining before the tournament is full</p>
        )}

        {!tournamentReady && heroState === 'new' && (
          <p className="formation-logic">At {targetPlayers} players, a 48-hour countdown begins. The tournament starts when it ends or {maxPlayers} players join.</p>
        )}

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
          <p className="formation-logic">At {targetPlayers} players, a 48-hour countdown begins. Your matches will auto-schedule.</p>
        )}

        <div className="formation-actions">
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

          {(heroState === 'new' || heroState === 'returning') && (
            <div className="formation-choice-options">
              <button className="btn btn-primary btn-large formation-cta-primary" onClick={handleJoin}>
                <span className="formation-choice-label">Join Tournament</span>
                <span className="formation-choice-desc">Matched by skill level and location</span>
              </button>
              <button className="btn btn-large formation-cta-secondary" onClick={handleShareInvite}>
                <span className="formation-choice-label">Create Free Tournament</span>
                <span className="formation-choice-desc">Invite 5+ friends and play together</span>
              </button>
            </div>
          )}

          {heroState === 'joined-ready' && (
            <button className="btn btn-primary btn-large formation-cta-primary" onClick={handleShareInvite}>
              Invite Friends
            </button>
          )}

          {heroState === 'countdown-ready' && (
            <>
              {spotsLeft > 0 ? (
                <button className="btn btn-primary btn-large formation-cta-primary" onClick={handleShareInvite}>
                  {spotsLeft === 1 ? 'Invite One More Player' : `Invite ${spotsLeft} More Players`}
                </button>
              ) : (
                <p className="formation-logic">Tournament is full — starts when the countdown ends.</p>
              )}
            </>
          )}
        </div>

        {showOnboarding && (
          <div style={{ marginTop: 'var(--space-md)', borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-md)' }}>
            <WelcomeCard
              activationSteps={activationSteps}
              county={profile.county}
              onJoinLobby={onJoinLobby || (() => {})}
              onSetAvailability={onSetAvailability || (() => {})}
              onFindMatch={onFindMatch || (() => {})}
              hideAction
            />
          </div>
        )}
      </div>

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
              <div className="card-title">How likely your matches will auto-schedule</div>
              <div className="card-supporting">{confidence.playersWithAvailability} players have set their availability. Add more time slots to improve this.</div>
            </div>
            <div className="confidence-bar">
              <div
                className={`confidence-fill confidence-fill--${confidence.label}`}
                style={{ width: `${confidence.score}%` }}
              />
            </div>
            <div className="confidence-value" style={{
              color: confidence.label === 'high' ? 'var(--color-positive-primary)' :
                     confidence.label === 'medium' ? 'var(--color-accent-primary)' :
                     'var(--color-warning-primary)'
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

      {isUserInvolved && !isInSetupTournament && (
        <div className="formation-leave">
          <button className="btn-link" onClick={handleLeave}>Leave tournament</button>
        </div>
      )}

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

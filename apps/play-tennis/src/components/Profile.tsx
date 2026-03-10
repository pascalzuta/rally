import { useState } from 'react'
import { getPlayerRating, getRatingLabel, getRatingHistory, getPlayerTournaments, getTournamentsByCounty, logout, getAvailability, saveAvailability } from '../store'
import type { RatingSnapshot } from '../store'
import { PlayerProfile, AvailabilitySlot, DayOfWeek, Tournament } from '../types'

interface Props {
  profile: PlayerProfile
  onLogout: () => void
  onNavigate: (tab: 'home' | 'bracket' | 'playnow') => void
}

const DAYS: { key: DayOfWeek; label: string; short: string }[] = [
  { key: 'monday', label: 'Monday', short: 'Mon' },
  { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { key: 'thursday', label: 'Thursday', short: 'Thu' },
  { key: 'friday', label: 'Friday', short: 'Fri' },
  { key: 'saturday', label: 'Saturday', short: 'Sat' },
  { key: 'sunday', label: 'Sunday', short: 'Sun' },
]

const QUICK_SLOTS: { label: string; slots: AvailabilitySlot[] }[] = [
  { label: 'Weekday evenings', slots: [
    { day: 'monday', startHour: 18, endHour: 21 },
    { day: 'tuesday', startHour: 18, endHour: 21 },
    { day: 'wednesday', startHour: 18, endHour: 21 },
    { day: 'thursday', startHour: 18, endHour: 21 },
    { day: 'friday', startHour: 18, endHour: 21 },
  ]},
  { label: 'Saturday mornings', slots: [{ day: 'saturday', startHour: 8, endHour: 12 }]},
  { label: 'Saturday afternoons', slots: [{ day: 'saturday', startHour: 13, endHour: 17 }]},
  { label: 'Sunday mornings', slots: [{ day: 'sunday', startHour: 8, endHour: 12 }]},
  { label: 'Sunday afternoons', slots: [{ day: 'sunday', startHour: 13, endHour: 17 }]},
]

function formatHour(h: number): string {
  if (h === 0 || h === 24) return '12am'
  if (h === 12) return '12pm'
  return h < 12 ? `${h}am` : `${h - 12}pm`
}

function getInviteLink(county: string): string {
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('join', county)
  return url.toString()
}

function handleInvite(county: string) {
  const link = getInviteLink(county)
  const message = `Join the Rally tennis tournament in ${county}. Let's start competing.\n${link}`
  if (navigator.share) {
    navigator.share({ title: 'Rally Tennis', text: message, url: link }).catch(() => {
      window.open(`sms:?body=${encodeURIComponent(message)}`, '_self')
    })
  } else {
    window.open(`sms:?body=${encodeURIComponent(message)}`, '_self')
  }
}

// --- Activation Progress ---

interface ActivationStep {
  label: string
  completed: boolean
}

function getActivationSteps(
  profile: PlayerProfile,
  tournaments: Tournament[],
  hasAvailability: boolean,
  hasPlayedMatch: boolean
): ActivationStep[] {
  const inTournament = tournaments.some(t =>
    (t.status === 'setup' || t.status === 'in-progress') &&
    t.players.some(p => p.id === profile.id)
  )

  return [
    { label: 'Create profile', completed: true },
    { label: 'Join or start a tournament', completed: inTournament || hasPlayedMatch },
    { label: 'Invite players', completed: false },
    { label: 'Add availability', completed: hasAvailability },
    { label: 'Play your first match', completed: hasPlayedMatch },
  ]
}

function ActivationProgress({ steps }: { steps: ActivationStep[] }) {
  const allDone = steps.every(s => s.completed)
  if (allDone) return null

  const nextIndex = steps.findIndex(s => !s.completed)

  return (
    <div className="card activation-progress">
      <h3 className="activation-progress-title">Your Rally Journey</h3>
      <div className="activation-steps">
        {steps.map((step, i) => (
          <div key={i} className={`activation-step ${step.completed ? 'completed' : ''} ${i === nextIndex ? 'next' : ''}`}>
            <span className="activation-step-check">
              {step.completed ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="8" fill="var(--color-positive-primary)" />
                  <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7.5" stroke={i === nextIndex ? 'var(--color-accent-primary)' : 'var(--color-divider)'} />
                </svg>
              )}
            </span>
            <span className="activation-step-label">{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Activation Card ---

type ActivationState = 'no-tournament' | 'tournament-joinable' | 'in-tournament' | 'needs-availability' | 'all-done'

function getActivationState(
  profile: PlayerProfile,
  tournaments: Tournament[],
  countyTournaments: Tournament[],
  hasAvailability: boolean,
  hasPlayedMatch: boolean
): ActivationState {
  if (hasPlayedMatch && hasAvailability) return 'all-done'

  const userActiveTournament = tournaments.find(t =>
    (t.status === 'setup' || t.status === 'in-progress') &&
    t.players.some(p => p.id === profile.id)
  )

  if (userActiveTournament) {
    if (!hasAvailability) return 'needs-availability'
    return 'in-tournament'
  }

  const joinable = countyTournaments.find(t =>
    (t.status === 'setup' || t.status === 'in-progress') &&
    !t.players.some(p => p.id === profile.id)
  )

  if (joinable) return 'tournament-joinable'
  return 'no-tournament'
}

function ActivationCard({ state, county, onNavigate }: {
  state: ActivationState
  county: string
  onNavigate: (tab: 'home' | 'bracket' | 'playnow') => void
}) {
  if (state === 'all-done') return null

  if (state === 'needs-availability') {
    return (
      <div className="card activation-card">
        <div className="activation-card-icon">&#128197;</div>
        <h3 className="activation-card-title">Add Your Playing Times</h3>
        <p className="activation-card-desc">Tell other players when you are available. This makes scheduling matches much easier.</p>
        <div className="activation-card-actions">
          <button className="btn btn-primary btn-large" onClick={() => {
            const el = document.querySelector('.profile-section .btn-small')
            if (el instanceof HTMLElement) el.click()
          }}>Add Availability</button>
          <button className="btn btn-large" onClick={() => handleInvite(county)}>Invite Players</button>
        </div>
      </div>
    )
  }

  if (state === 'no-tournament') {
    return (
      <div className="card activation-card">
        <div className="activation-card-icon">&#127942;</div>
        <h3 className="activation-card-title">Start the first tournament in {county}</h3>
        <p className="activation-card-desc">There is no active tournament in your county yet. Start one and invite players to begin competing.</p>
        <div className="activation-card-actions">
          <button className="btn btn-primary btn-large" onClick={() => onNavigate('home')}>Start Tournament</button>
          <button className="btn btn-large" onClick={() => handleInvite(county)}>Invite Players</button>
        </div>
      </div>
    )
  }

  if (state === 'tournament-joinable') {
    return (
      <div className="card activation-card">
        <div className="activation-card-icon">&#127934;</div>
        <h3 className="activation-card-title">Join the {county} Tournament</h3>
        <p className="activation-card-desc">Players in your county are already competing. Join the tournament to start playing matches.</p>
        <div className="activation-card-actions">
          <button className="btn btn-primary btn-large" onClick={() => onNavigate('home')}>Join Tournament</button>
          <button className="btn btn-large" onClick={() => handleInvite(county)}>Invite Players</button>
        </div>
      </div>
    )
  }

  // in-tournament
  return (
    <div className="card activation-card">
      <div className="activation-card-icon">&#127934;</div>
      <h3 className="activation-card-title">Start Playing Matches</h3>
      <p className="activation-card-desc">Schedule matches with players in your tournament or broadcast that you're ready to play now.</p>
      <div className="activation-card-actions">
        <button className="btn btn-primary btn-large" onClick={() => onNavigate('bracket')}>Find Match</button>
        <button className="btn btn-large" onClick={() => onNavigate('playnow')}>Play Now</button>
        <button className="btn btn-large" onClick={() => handleInvite(county)}>Invite Players</button>
      </div>
    </div>
  )
}

// --- Rating Chart ---

function RatingChart({ history, currentRating }: { history: RatingSnapshot[]; currentRating: number }) {
  const points: { rating: number; timestamp: string }[] = [
    ...history,
  ]
  if (points.length === 0) {
    points.push({ rating: currentRating, timestamp: new Date().toISOString() })
  }

  if (points.length === 1) {
    points.unshift({ rating: 1500, timestamp: points[0].timestamp })
  }

  const W = 300
  const H = 140
  const PAD_X = 40
  const PAD_Y = 20
  const chartW = W - PAD_X - 10
  const chartH = H - PAD_Y * 2

  const ratings = points.map(p => p.rating)
  const minR = Math.floor((Math.min(...ratings) - 20) / 50) * 50
  const maxR = Math.ceil((Math.max(...ratings) + 20) / 50) * 50
  const range = maxR - minR || 100

  const pathPoints = points.map((p, i) => {
    const x = PAD_X + (i / (points.length - 1)) * chartW
    const y = PAD_Y + chartH - ((p.rating - minR) / range) * chartH
    return { x, y }
  })

  const d = pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

  const yLabels = [minR, Math.round((minR + maxR) / 2), maxR]

  const firstDate = new Date(points[0].timestamp)
  const lastDate = new Date(points[points.length - 1].timestamp)
  const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 400 }}>
      {yLabels.map(v => {
        const y = PAD_Y + chartH - ((v - minR) / range) * chartH
        return (
          <g key={v}>
            <line x1={PAD_X} y1={y} x2={W - 10} y2={y} stroke="var(--color-divider)" strokeWidth="0.5" />
            <text x={PAD_X - 4} y={y + 3} textAnchor="end" fontSize="8" fill="var(--color-text-secondary)">{v}</text>
          </g>
        )
      })}

      <text x={PAD_X} y={H - 4} fontSize="8" fill="var(--color-text-secondary)">{fmt(firstDate)}</text>
      <text x={W - 10} y={H - 4} textAnchor="end" fontSize="8" fill="var(--color-text-secondary)">{fmt(lastDate)}</text>

      <path d={d} fill="none" stroke="var(--color-accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      <circle cx={pathPoints[pathPoints.length - 1].x} cy={pathPoints[pathPoints.length - 1].y} r="3" fill="var(--color-accent-primary)" />
    </svg>
  )
}

// --- Main Profile ---

export default function Profile({ profile, onLogout, onNavigate }: Props) {
  const rating = getPlayerRating(profile.name)
  const label = getRatingLabel(rating.rating)
  const tournaments = getPlayerTournaments(profile.id)
  const countyTournaments = getTournamentsByCounty(profile.county)

  const [editing, setEditing] = useState(false)
  const [slots, setSlots] = useState<AvailabilitySlot[]>(() => getAvailability(profile.id))
  const [detailedMode, setDetailedMode] = useState(false)
  const [detailDay, setDetailDay] = useState<DayOfWeek>('monday')
  const [detailStart, setDetailStart] = useState(9)
  const [detailEnd, setDetailEnd] = useState(12)

  const hasAvailability = slots.length > 0

  const hasPlayedMatch = tournaments.some(t =>
    t.matches.some(m =>
      m.completed &&
      (m.player1Id === profile.id || m.player2Id === profile.id)
    )
  )

  const activationSteps = getActivationSteps(profile, tournaments, hasAvailability, hasPlayedMatch)
  const activationState = getActivationState(profile, tournaments, countyTournaments, hasAvailability, hasPlayedMatch)
  const showActivation = !activationSteps.every(s => s.completed)

  const wins = tournaments.reduce((sum, t) => {
    return sum + t.matches.filter(m =>
      m.completed && m.winnerId &&
      (m.player1Id === profile.id || m.player2Id === profile.id) &&
      m.winnerId === profile.id
    ).length
  }, 0)

  const losses = tournaments.reduce((sum, t) => {
    return sum + t.matches.filter(m =>
      m.completed && m.winnerId &&
      (m.player1Id === profile.id || m.player2Id === profile.id) &&
      m.winnerId !== profile.id
    ).length
  }, 0)

  const completedTournaments = tournaments.filter(t => t.status === 'completed')

  function handleLogout() {
    if (confirm('Sign out? You can sign back in with the same name.')) {
      logout()
      onLogout()
    }
  }

  function toggleQuickSlot(quickSlot: { label: string; slots: AvailabilitySlot[] }) {
    const allPresent = quickSlot.slots.every(qs =>
      slots.some(s => s.day === qs.day && s.startHour === qs.startHour && s.endHour === qs.endHour)
    )
    if (allPresent) {
      setSlots(slots.filter(s =>
        !quickSlot.slots.some(qs => qs.day === s.day && qs.startHour === s.startHour && qs.endHour === s.endHour)
      ))
    } else {
      const newSlots = quickSlot.slots.filter(qs =>
        !slots.some(s => s.day === qs.day && s.startHour === qs.startHour && s.endHour === qs.endHour)
      )
      setSlots([...slots, ...newSlots])
    }
  }

  function isQuickSlotActive(quickSlot: { slots: AvailabilitySlot[] }): boolean {
    return quickSlot.slots.every(qs =>
      slots.some(s => s.day === qs.day && s.startHour === qs.startHour && s.endHour === qs.endHour)
    )
  }

  function addDetailedSlot() {
    const exists = slots.some(s => s.day === detailDay && s.startHour === detailStart && s.endHour === detailEnd)
    if (!exists && detailStart < detailEnd) {
      setSlots([...slots, { day: detailDay, startHour: detailStart, endHour: detailEnd }])
    }
  }

  function removeSlot(index: number) {
    setSlots(slots.filter((_, i) => i !== index))
  }

  function handleSaveAvailability() {
    saveAvailability(profile.id, slots)
    setEditing(false)
  }

  function handleCancelEdit() {
    setSlots(getAvailability(profile.id))
    setEditing(false)
    setDetailedMode(false)
  }

  function getTournamentResult(tournament: typeof tournaments[0]): string {
    const playerMatches = tournament.matches.filter(m =>
      m.completed && m.winnerId &&
      (m.player1Id === profile.id || m.player2Id === profile.id)
    )
    const playerWins = playerMatches.filter(m => m.winnerId === profile.id).length
    const playerLosses = playerMatches.length - playerWins
    if (playerWins > playerLosses) return 'Won'
    if (playerLosses > playerWins) return 'Lost'
    return 'Draw'
  }

  return (
    <div className="profile-content">
      {/* Player Card */}
      <div className="card">
        <div className="profile-card">
          <div className="profile-avatar">{profile.name[0].toUpperCase()}</div>
          <h2 className="profile-name">{profile.name}</h2>
          <p className="profile-county">{profile.county}</p>
        </div>
      </div>

      {/* Rating Card */}
      <div className="card">
        <div className="rating-card">
          <div className="rating-big">{Math.round(rating.rating)}</div>
          <div className="rating-label-text">{label}</div>
        </div>
      </div>

      {/* Activation Progress System */}
      {showActivation && <ActivationProgress steps={activationSteps} />}

      {/* Activation Card */}
      {showActivation && <ActivationCard state={activationState} county={profile.county} onNavigate={onNavigate} />}

      {/* Stats Row */}
      <div className="stats-row">
        <div className="card stat-box">
          <div className="stat-value">{rating.matchesPlayed}</div>
          <div className="stat-label">Matches</div>
        </div>
        <div className="card stat-box">
          <div className="stat-value">{wins}</div>
          <div className="stat-label">Wins</div>
        </div>
        <div className="card stat-box">
          <div className="stat-value">{losses}</div>
          <div className="stat-label">Losses</div>
        </div>
        <div className="card stat-box">
          <div className="stat-value">{tournaments.length}</div>
          <div className="stat-label">Events</div>
        </div>
      </div>

      {/* Availability Section */}
      <div className="card profile-section">
        <h3 className="profile-section-title">
          <span>Availability</span>
          {!editing && <button className="btn btn-small" onClick={() => setEditing(true)}>Edit</button>}
        </h3>
        {!editing ? (
          <div className="availability-current">
            {slots.length === 0 ? (
              <p className="subtle">No availability slots set</p>
            ) : (
              slots.map((slot, i) => {
                const dayInfo = DAYS.find(d => d.key === slot.day)
                return (
                  <div key={i} className="availability-slot-item">
                    <span className="availability-slot-day">{dayInfo?.label ?? slot.day}</span>
                    <span className="availability-slot-hours">{formatHour(slot.startHour)}–{formatHour(slot.endHour)}</span>
                  </div>
                )
              })
            )}
          </div>
        ) : (
          <>
            <div className="quick-slots">
              {QUICK_SLOTS.map(qs => (
                <button
                  key={qs.label}
                  className={`quick-slot-btn ${isQuickSlotActive(qs) ? 'selected' : ''}`}
                  onClick={() => toggleQuickSlot(qs)}
                >
                  <span className="quick-slot-check">{isQuickSlotActive(qs) ? '✓' : ''}</span>
                  {qs.label}
                </button>
              ))}
            </div>

            <button className="btn-link" onClick={() => setDetailedMode(!detailedMode)}>
              {detailedMode ? 'Hide specific times' : 'Add specific times'}
            </button>

            {detailedMode && (
              <div className="detailed-add-row">
                <select value={detailDay} onChange={e => setDetailDay(e.target.value as DayOfWeek)}>
                  {DAYS.map(d => <option key={d.key} value={d.key}>{d.short}</option>)}
                </select>
                <select value={detailStart} onChange={e => setDetailStart(Number(e.target.value))}>
                  {Array.from({ length: 16 }, (_, i) => i + 6).map(h => (
                    <option key={h} value={h}>{formatHour(h)}</option>
                  ))}
                </select>
                <span>–</span>
                <select value={detailEnd} onChange={e => setDetailEnd(Number(e.target.value))}>
                  {Array.from({ length: 16 }, (_, i) => i + 7).map(h => (
                    <option key={h} value={h}>{formatHour(h)}</option>
                  ))}
                </select>
                <button className="btn btn-small" onClick={addDetailedSlot}>Add</button>
              </div>
            )}

            {slots.length > 0 && (
              <div className="availability-current">
                {slots.map((slot, i) => {
                  const dayInfo = DAYS.find(d => d.key === slot.day)
                  return (
                    <div key={i} className="availability-slot-item">
                      <span className="availability-slot-day">{dayInfo?.label ?? slot.day}</span>
                      <span className="availability-slot-hours">{formatHour(slot.startHour)}–{formatHour(slot.endHour)}</span>
                      <button className="btn-icon" onClick={() => removeSlot(i)}>✕</button>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="btn-row">
              <button className="btn btn-primary" onClick={handleSaveAvailability}>Save</button>
              <button className="btn" onClick={handleCancelEdit}>Cancel</button>
            </div>
          </>
        )}
      </div>

      {/* Tournament History */}
      <div className="card profile-section">
        <h3 className="profile-section-title">Tournament History</h3>
        <RatingChart history={getRatingHistory(profile.name)} currentRating={rating.rating} />
        <div className="tournament-history">
          {completedTournaments.length === 0 ? (
            <p className="subtle">No completed tournaments yet</p>
          ) : (
            completedTournaments.map(t => {
              const result = getTournamentResult(t)
              return (
                <div key={t.id} className="history-card">
                  <div className="history-card-info">
                    <div className="history-card-name">{t.name}</div>
                    <div className="history-card-meta">{t.date} · {t.format === 'single-elimination' ? 'Knockout' : 'Round Robin'}</div>
                  </div>
                  <span className={`history-card-result ${result === 'Won' ? 'won' : result === 'Lost' ? 'lost' : ''}`}>{result}</span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Sign Out */}
      <button className="btn btn-large logout-btn" onClick={handleLogout}>Sign Out</button>
    </div>
  )
}

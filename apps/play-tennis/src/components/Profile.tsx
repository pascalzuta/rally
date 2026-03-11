import { useState } from 'react'
import { getPlayerRating, getRatingLabel, getRatingHistory, getPlayerTournaments, getPlayerRank, logout, getAvailability, saveAvailability } from '../store'
import type { RatingSnapshot } from '../store'
import { PlayerProfile, AvailabilitySlot, DayOfWeek } from '../types'

interface Props {
  profile: PlayerProfile
  onLogout: () => void
  onNavigate: (tab: 'home' | 'bracket' | 'playnow') => void
  onViewLeaderboard?: () => void
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

export default function Profile({ profile, onLogout, onNavigate, onViewLeaderboard }: Props) {
  const rating = getPlayerRating(profile.name)
  const label = getRatingLabel(rating.rating)
  const tournaments = getPlayerTournaments(profile.id)
  const rankInfo = getPlayerRank(profile.name, profile.county)
  const ratingHistory = getRatingHistory(profile.name)

  const [showRatingInfo, setShowRatingInfo] = useState(false)
  const [editing, setEditing] = useState(false)
  const [slots, setSlots] = useState<AvailabilitySlot[]>(() => getAvailability(profile.id))
  const [detailedMode, setDetailedMode] = useState(false)
  const [detailDay, setDetailDay] = useState<DayOfWeek>('monday')
  const [detailStart, setDetailStart] = useState(9)
  const [detailEnd, setDetailEnd] = useState(12)

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

  const totalMatches = wins + losses
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0

  // Last match rating change
  const lastRatingChange = ratingHistory.length >= 2
    ? Math.round(ratingHistory[ratingHistory.length - 1].rating - ratingHistory[ratingHistory.length - 2].rating)
    : 0

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
      {/* Player Identity */}
      <div className="card">
        <div className="profile-card">
          <div className="profile-avatar">{profile.name[0].toUpperCase()}</div>
          <h2 className="profile-name">{profile.name}</h2>
          <p className="profile-county">{profile.county}</p>
        </div>
      </div>

      {/* Rating Hero Card */}
      <div className="card rating-hero">
        <div className="rating-hero-number">{Math.round(rating.rating)}</div>
        <div className="rating-hero-label">{label} Rating</div>
        <div className="rating-hero-details">
          {rankInfo.total > 1 && (
            <>
              <span className="rating-hero-rank">Rank #{rankInfo.rank} in {profile.county}</span>
              <span className="rating-hero-percentile">Top {100 - rankInfo.percentile}% in county</span>
            </>
          )}
          {lastRatingChange !== 0 && (
            <span className={`rating-hero-change ${lastRatingChange > 0 ? 'positive' : 'negative'}`}>
              {lastRatingChange > 0 ? '+' : ''}{lastRatingChange} last match
            </span>
          )}
        </div>
        <div className="rating-hero-actions">
          {onViewLeaderboard && rankInfo.total > 1 && (
            <button className="btn-link rating-hero-link" onClick={onViewLeaderboard}>View leaderboard</button>
          )}
          <button className="btn-link rating-hero-link" onClick={() => setShowRatingInfo(!showRatingInfo)}>
            {showRatingInfo ? 'Hide rating info' : 'How ratings work'}
          </button>
        </div>
        {showRatingInfo && (
          <div className="rating-explainer">
            <p>Rally uses an <strong>Elo rating system</strong>, similar to chess rankings. Every player starts at <strong>1500</strong>.</p>
            <p>When you win against a higher-rated opponent, you gain more points. Losing to a lower-rated opponent costs more. This means upsets are rewarded and the system finds your true level over time.</p>
            <div className="rating-tiers">
              <div className="rating-tier"><span className="tier-range">2200+</span><span className="tier-label">Pro</span></div>
              <div className="rating-tier"><span className="tier-range">2000–2199</span><span className="tier-label">Semi-pro</span></div>
              <div className="rating-tier"><span className="tier-range">1800–1999</span><span className="tier-label">Elite</span></div>
              <div className="rating-tier"><span className="tier-range">1600–1799</span><span className="tier-label">Strong</span></div>
              <div className="rating-tier"><span className="tier-range">1400–1599</span><span className="tier-label">Club</span></div>
              <div className="rating-tier"><span className="tier-range">1200–1399</span><span className="tier-label">Beginner</span></div>
              <div className="rating-tier"><span className="tier-range">&lt;1200</span><span className="tier-label">Newcomer</span></div>
            </div>
            <p className="subtle">Your rating changes more in your first matches, then stabilises as you play more.</p>
          </div>
        )}
      </div>

      {/* Performance Section */}
      <div className="card profile-section">
        <h3 className="profile-section-title"><span>Performance</span></h3>
        <div className="performance-grid">
          <div className="performance-item">
            <div className="performance-value">{totalMatches}</div>
            <div className="performance-label">Matches</div>
          </div>
          <div className="performance-item">
            <div className="performance-value">{wins}</div>
            <div className="performance-label">Wins</div>
          </div>
          <div className="performance-item">
            <div className="performance-value">{losses}</div>
            <div className="performance-label">Losses</div>
          </div>
          <div className="performance-item">
            <div className="performance-value">{winRate}%</div>
            <div className="performance-label">Win Rate</div>
          </div>
        </div>
      </div>

      {/* Rating History */}
      <div className="card profile-section">
        <h3 className="profile-section-title"><span>Rating Progress</span></h3>
        <RatingChart history={ratingHistory} currentRating={rating.rating} />
        {completedTournaments.length > 0 && (
          <div className="tournament-history">
            {completedTournaments.map(t => {
              const result = getTournamentResult(t)
              return (
                <div key={t.id} className="history-card">
                  <div className="history-card-info">
                    <div className="history-card-name">{t.name}</div>
                    <div className="history-card-meta">{t.date} · {t.format === 'single-elimination' ? 'Knockout' : t.format === 'group-knockout' ? 'Group + Knockout' : 'Round Robin'}</div>
                  </div>
                  <span className={`history-card-result ${result === 'Won' ? 'won' : result === 'Lost' ? 'lost' : ''}`}>{result}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Availability Section */}
      <div className="card profile-section">
        <h3 className="profile-section-title">
          <span>When You Play</span>
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

      {/* Sign Out */}
      <button className="btn btn-large logout-btn" onClick={handleLogout}>Sign Out</button>
    </div>
  )
}

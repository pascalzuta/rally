import { useState } from 'react'
import { getPlayerRating, getRatingLabel, getRatingHistory, getRatingTrend, getPlayerTournaments, getPlayerRank, getPlayerTrophies, getPlayerBadges, getMatchHistory, getHeadToHead, logout, getAvailability, saveAvailability } from '../store'
import type { RatingSnapshot, MatchHistoryEntry } from '../store'
import { PlayerProfile, AvailabilitySlot, DayOfWeek, Trophy, TrophyTier, Badge } from '../types'

interface Props {
  profile: PlayerProfile
  onLogout: () => void
  onNavigate: (tab: 'home' | 'bracket' | 'playnow') => void
  onViewLeaderboard?: () => void
  onViewHelp?: () => void
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

  // Prepend starting rating if only one point
  if (points.length === 1) {
    points.unshift({ rating: 1500, timestamp: points[0].timestamp })
  }

  const W = 300
  const H = 150
  const PAD_X = 40
  const PAD_Y = 20
  const PAD_BOTTOM = 28
  const chartW = W - PAD_X - 10
  const chartH = H - PAD_Y - PAD_BOTTOM

  const ratings = points.map(p => p.rating)
  const minR = Math.floor((Math.min(...ratings) - 20) / 50) * 50
  const maxR = Math.ceil((Math.max(...ratings) + 20) / 50) * 50
  const range = maxR - minR || 100

  const pathPoints = points.map((p, i) => {
    const x = PAD_X + (i / (points.length - 1)) * chartW
    const y = PAD_Y + chartH - ((p.rating - minR) / range) * chartH
    return { x, y, rating: p.rating }
  })

  const d = pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

  const yLabels = [minR, Math.round((minR + maxR) / 2), maxR]

  // Match-based x-axis labels
  const totalPoints = points.length
  const xLabelIndices: number[] = []
  if (totalPoints <= 6) {
    // Show all
    for (let i = 0; i < totalPoints; i++) xLabelIndices.push(i)
  } else {
    // Show first, last, and a few evenly spaced
    xLabelIndices.push(0)
    const step = Math.floor((totalPoints - 1) / 4)
    for (let i = step; i < totalPoints - 1; i += step) xLabelIndices.push(i)
    xLabelIndices.push(totalPoints - 1)
  }

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

      {/* Match-based x-axis */}
      {xLabelIndices.map(i => (
        <text key={i} x={pathPoints[i].x} y={H - 6} textAnchor="middle" fontSize="7" fill="var(--color-text-secondary)">
          {i === 0 ? 'Start' : `M${i}`}
        </text>
      ))}

      <path d={d} fill="none" stroke="var(--color-accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* Data points */}
      {pathPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === pathPoints.length - 1 ? 3.5 : 2} fill="var(--color-accent-primary)" opacity={i === pathPoints.length - 1 ? 1 : 0.5} />
      ))}
    </svg>
  )
}

// --- Trophy helpers ---

const TROPHY_COLORS: Record<TrophyTier, { primary: string; highlight: string; shadow: string }> = {
  champion: { primary: '#D4AF37', highlight: '#F6E27A', shadow: '#9A7C1E' },
  finalist: { primary: '#C0C0C0', highlight: '#E4E4E4', shadow: '#8A8A8A' },
  semifinalist: { primary: '#CD7F32', highlight: '#E0A46C', shadow: '#8C5421' },
}

const TROPHY_LABEL: Record<TrophyTier, string> = {
  champion: 'Champion',
  finalist: 'Finalist',
  semifinalist: 'Semifinalist',
}

function TrophyIcon({ tier, size = 40 }: { tier: TrophyTier; size?: number }) {
  const c = TROPHY_COLORS[tier]
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <defs>
        <linearGradient id={`trophy-${tier}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c.highlight} />
          <stop offset="50%" stopColor={c.primary} />
          <stop offset="100%" stopColor={c.shadow} />
        </linearGradient>
      </defs>
      {/* Cup body */}
      <path d="M10 8h20v4c0 7-4 12-10 14-6-2-10-7-10-14V8z" fill={`url(#trophy-${tier})`} />
      {/* Handles */}
      <path d="M10 10H7c0 4 1.5 7 3 8" stroke={c.primary} strokeWidth="1.5" fill="none" />
      <path d="M30 10h3c0 4-1.5 7-3 8" stroke={c.primary} strokeWidth="1.5" fill="none" />
      {/* Stem */}
      <rect x="18" y="26" width="4" height="5" rx="1" fill={c.shadow} />
      {/* Base */}
      <rect x="13" y="31" width="14" height="3" rx="1.5" fill={c.primary} />
      {/* Specular highlight */}
      <ellipse cx="17" cy="14" rx="3" ry="5" fill="white" opacity="0.15" />
    </svg>
  )
}

function TrophyDetailModal({ trophy, onClose }: { trophy: Trophy; onClose: () => void }) {
  return (
    <div className="trophy-modal-backdrop" onClick={onClose}>
      <div className="trophy-modal" onClick={e => e.stopPropagation()}>
        <div className="trophy-modal-icon">
          <TrophyIcon tier={trophy.tier} size={64} />
        </div>
        <h3 className="trophy-modal-title">{trophy.tournamentName}</h3>
        <div className="trophy-modal-tier">{TROPHY_LABEL[trophy.tier]}</div>
        <div className="trophy-modal-date">{trophy.date}</div>
        {trophy.finalMatch && (
          <div className="trophy-modal-match">
            <div className="trophy-modal-match-label">
              {trophy.tier === 'champion' ? 'Final Match' : 'Final'}
            </div>
            <div className="trophy-modal-match-result">
              {trophy.finalMatch.won
                ? `${trophy.playerName} def. ${trophy.finalMatch.opponentName}`
                : `${trophy.finalMatch.opponentName} def. ${trophy.playerName}`
              }
            </div>
            <div className="trophy-modal-match-score">{trophy.finalMatch.score}</div>
          </div>
        )}
        <button className="btn trophy-modal-close" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

function BadgeIcon({ type }: { type: Badge['type'] }) {
  const icons: Record<string, string> = {
    'first-tournament': '1',
    'undefeated-champion': '★',
    'comeback-win': '↺',
    'five-tournaments': '5',
    'ten-matches': '10',
  }
  return (
    <div className="badge-icon">{icons[type] ?? '●'}</div>
  )
}

// --- Main Profile ---

export default function Profile({ profile, onLogout, onNavigate, onViewLeaderboard, onViewHelp }: Props) {
  const rating = getPlayerRating(profile.id, profile.name)
  const label = getRatingLabel(rating.rating)
  const tournaments = getPlayerTournaments(profile.id)
  const rankInfo = getPlayerRank(profile.name, profile.county)
  const ratingHistory = getRatingHistory(profile.id)
  const weeklyTrend = getRatingTrend(profile.id)
  const trophies = getPlayerTrophies(profile.id)
  const badges = getPlayerBadges(profile.id)

  const [selectedTrophy, setSelectedTrophy] = useState<Trophy | null>(null)
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
  const matchHistory = getMatchHistory(profile.id)
  const [showAllMatches, setShowAllMatches] = useState(false)
  const [h2hOpponent, setH2hOpponent] = useState<string | null>(null)
  const visibleMatches = showAllMatches ? matchHistory : matchHistory.slice(0, 5)

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

  // Engagement prompt
  const nextRankUp = rankInfo.rank > 1 ? rankInfo.rank - 1 : null
  const engagementPrompt = lastRatingChange > 0 && nextRankUp
    ? `One more win could move you to #${nextRankUp}.`
    : lastRatingChange > 0
      ? 'Keep the momentum — play another match.'
      : totalMatches > 0
        ? 'Play another match to climb the leaderboard.'
        : null

  return (
    <div className="profile-content">
      {/* Player Identity */}
      <div className="card">
        <div className="profile-card">
          <div className="profile-avatar">{profile.name[0].toUpperCase()}</div>
          <h2 className="profile-name">{profile.name}</h2>
          <p className="profile-county">{profile.county}</p>
          {(profile.experienceLevel || profile.ageRange) && (
            <div className="profile-details-chips">
              {profile.experienceLevel && (
                <span className="profile-detail-chip">
                  {profile.experienceLevel === 'beginner' ? 'Just started' :
                   profile.experienceLevel === 'intermediate' ? 'Regular player' :
                   profile.experienceLevel === 'advanced' ? 'Club player' : 'Tournament player'}
                </span>
              )}
              {profile.ageRange && <span className="profile-detail-chip">{profile.ageRange}</span>}
            </div>
          )}
          {totalMatches > 0 && <p className="profile-matches-played">{totalMatches} matches played</p>}
        </div>
      </div>

      {/* Rating Hero Card */}
      <div className="card rating-hero">
        <div className="rating-hero-top">
          <div className="rating-hero-number">
            {Math.round(rating.rating)}
            {weeklyTrend !== 0 && (
              <span className={`rating-trend ${weeklyTrend > 0 ? 'positive' : 'negative'}`}>
                {weeklyTrend > 0 ? ' ▲' : ' ▼'}
              </span>
            )}
          </div>
        </div>
        <div className="rating-hero-label">{label} Level</div>
        <div className="rating-level-bar">
          <div className="rating-level-fill" style={{ width: `${Math.min(100, Math.max(5, ((rating.rating - 800) / 1600) * 100))}%` }} />
        </div>
        <div className="rating-hero-details">
          {rankInfo.total > 1 && (
            <span className="rating-hero-rank">Rank #{rankInfo.rank} in {profile.county}</span>
          )}
          {lastRatingChange !== 0 && (
            <span className={`rating-hero-change ${lastRatingChange > 0 ? 'positive' : 'negative'}`}>
              {lastRatingChange > 0 ? '+' : ''}{lastRatingChange} last match
            </span>
          )}
          {weeklyTrend !== 0 && (
            <span className={`rating-hero-trend ${weeklyTrend > 0 ? 'positive' : 'negative'}`}>
              {weeklyTrend > 0 ? '+' : ''}{weeklyTrend} this week
            </span>
          )}
        </div>
        {engagementPrompt && (
          <div className="engagement-prompt">{engagementPrompt}</div>
        )}
        <div className="rating-hero-actions">
          {onViewLeaderboard && rankInfo.total > 1 && (
            <button className="btn-link rating-hero-link" onClick={onViewLeaderboard}>View leaderboard</button>
          )}
        </div>
      </div>

      {/* Trophy Cabinet */}
      <div className="card profile-section">
        <h3 className="profile-section-title"><span>Trophies</span></h3>
        {trophies.length > 0 ? (
          <div className="trophy-grid">
            {trophies.map(trophy => (
              <button key={trophy.id} className="trophy-cell" onClick={() => setSelectedTrophy(trophy)}>
                <TrophyIcon tier={trophy.tier} size={40} />
                <div className="trophy-cell-label">{TROPHY_LABEL[trophy.tier]}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="trophy-empty">
            <div className="trophy-empty-icon">🏆</div>
            <p className="trophy-empty-title">Your first trophy awaits</p>
            <p className="trophy-empty-desc">Win your first match to start collecting</p>
          </div>
        )}
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="card profile-section">
          <h3 className="profile-section-title"><span>Badges</span></h3>
          <div className="badge-grid">
            {badges.map(badge => (
              <div key={badge.id} className="badge-cell" title={badge.description}>
                <BadgeIcon type={badge.type} />
                <div className="badge-cell-label">{badge.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* Match History */}
      {matchHistory.length > 0 && (
        <div className="card profile-section">
          <h3 className="profile-section-title"><span>Match History</span></h3>

          {/* Head-to-head overlay */}
          {h2hOpponent && (() => {
            const h2h = getHeadToHead(profile.id, h2hOpponent)
            const oppName = h2h.matches[0]?.opponentName ?? 'Opponent'
            return (
              <div className="h2h-card">
                <div className="h2h-header">
                  <span className="h2h-title">vs {oppName}</span>
                  <button className="btn-icon" onClick={() => setH2hOpponent(null)}>✕</button>
                </div>
                <div className="h2h-record">
                  <span className="h2h-wins">{h2h.wins}W</span>
                  <span className="h2h-divider">–</span>
                  <span className="h2h-losses">{h2h.losses}L</span>
                </div>
                <div className="h2h-matches">
                  {h2h.matches.map(m => (
                    <div key={m.matchId} className={`h2h-match-row ${m.won ? 'won' : 'lost'}`}>
                      <span className="h2h-result">{m.won ? 'W' : 'L'}</span>
                      <span className="h2h-score">{m.score}</span>
                      <span className="h2h-tournament">{m.tournamentName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          <div className="match-history-list">
            {visibleMatches.map(match => (
              <div
                key={match.matchId}
                className={`match-history-item ${match.won ? 'won' : 'lost'}`}
                onClick={() => setH2hOpponent(match.opponentId === h2hOpponent ? null : match.opponentId)}
              >
                <div className="match-history-result">
                  <span className={`match-result-badge ${match.won ? 'win' : 'loss'}`}>
                    {match.won ? 'W' : 'L'}
                  </span>
                </div>
                <div className="match-history-info">
                  <div className="match-history-opponent">vs {match.opponentName}</div>
                  <div className="match-history-meta">{match.tournamentName} · R{match.round}</div>
                </div>
                <div className="match-history-score">{match.score}</div>
              </div>
            ))}
          </div>
          {matchHistory.length > 5 && (
            <button className="btn-link match-history-toggle" onClick={() => setShowAllMatches(!showAllMatches)}>
              {showAllMatches ? 'Show less' : `Show all ${matchHistory.length} matches`}
            </button>
          )}
        </div>
      )}

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
          <span>{slots.length > 0 ? 'Available' : 'When You Play'}</span>
          {!editing && <button className="btn btn-small" onClick={() => setEditing(true)}>Edit</button>}
        </h3>
        {!editing ? (
          <div className="availability-current">
            {slots.length === 0 ? (
              <p className="subtle">No availability set</p>
            ) : (
              slots.map((slot, i) => {
                const dayInfo = DAYS.find(d => d.key === slot.day)
                return (
                  <div key={i} className="availability-slot-item">
                    <span className="availability-slot-day">{dayInfo?.short ?? slot.day}</span>
                    <span className="availability-slot-hours">{formatHour(slot.startHour).replace(':00', '')}–{formatHour(slot.endHour).replace(':00', '')}</span>
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

      {/* Rating Explanation (collapsed by default) */}
      <div className="card profile-section">
        <h3 className="profile-section-title">
          <button className="btn-link" onClick={() => setShowRatingInfo(!showRatingInfo)}>
            {showRatingInfo ? 'Hide rating info ▾' : 'How ratings work ▸'}
          </button>
        </h3>
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

      {/* Help & FAQ */}
      {onViewHelp && (
        <button className="btn btn-large help-link-btn" onClick={onViewHelp}>
          Help &amp; FAQ
        </button>
      )}

      {/* Sign Out */}
      <button className="btn btn-large logout-btn" onClick={handleLogout}>Sign Out</button>

      {/* Trophy Detail Modal */}
      {selectedTrophy && (
        <TrophyDetailModal trophy={selectedTrophy} onClose={() => setSelectedTrophy(null)} />
      )}
    </div>
  )
}

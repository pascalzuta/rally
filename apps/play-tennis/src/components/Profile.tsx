import { useState, useRef } from 'react'
import { getPlayerRating, getRatingLabel, getRatingHistory, getRatingTrend, getPlayerTournaments, getPlayerRank, getPlayerTrophies, getPlayerBadges, getMatchHistory, getHeadToHead, logout, getAvailability, saveAvailability, switchProfile } from '../store'
import type { RatingSnapshot, MatchHistoryEntry } from '../store'
import { PlayerProfile, AvailabilitySlot, DayOfWeek, Trophy, TrophyTier, Badge } from '../types'
import { useToast } from './Toast'

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
          {i === 0 ? 'Start' : `Match ${i}`}
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
    'reliable-player': '✓',
    'good-sport': '♥',
    'community-regular': '♦',
  }
  return (
    <div className="badge-icon">{icons[type] ?? '●'}</div>
  )
}

// --- Main Profile ---

export default function Profile({ profile, onLogout, onNavigate, onViewLeaderboard, onViewHelp }: Props) {
  const { showSuccess } = useToast()
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

  // R-20: Profile photo, bio, playing style, preferred courts
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photoUrl, setPhotoUrl] = useState<string>(profile.photoUrl ?? '')
  const [bio, setBio] = useState<string>(profile.bio ?? '')
  const [playingStyle, setPlayingStyle] = useState<string[]>(profile.playingStyle ?? [])
  const [preferredCourts, setPreferredCourts] = useState<string[]>(profile.preferredCourts ?? [])
  const [newCourt, setNewCourt] = useState('')
  const [slots, setSlots] = useState<AvailabilitySlot[]>(() => getAvailability(profile.id))
  const [availMode, setAvailMode] = useState<'quick' | 'custom'>('quick')
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

  async function handleLogout() {
    if (confirm('Sign out? You can sign back in with your email.')) {
      await logout()
      onLogout()
      window.location.hash = '#home'
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
    showSuccess('Changes saved')
  }

  function handleCancelEdit() {
    setSlots(getAvailability(profile.id))
    setEditing(false)
    setAvailMode('quick')
  }

  // R-20: Profile management helpers
  const STYLE_OPTIONS = ['Singles', 'Doubles', 'Competitive', 'Casual'] as const

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setPhotoUrl(dataUrl)
      const updated = { ...profile, photoUrl: dataUrl }
      switchProfile(updated)
    }
    reader.readAsDataURL(file)
  }

  function handleBioChange(value: string) {
    if (value.length <= 150) {
      setBio(value)
      const updated = { ...profile, bio: value }
      switchProfile(updated)
    }
  }

  function togglePlayingStyle(style: string) {
    const next = playingStyle.includes(style)
      ? playingStyle.filter(s => s !== style)
      : [...playingStyle, style]
    setPlayingStyle(next)
    const updated = { ...profile, playingStyle: next }
    switchProfile(updated)
  }

  function addCourt() {
    const name = newCourt.trim()
    if (!name || preferredCourts.length >= 3 || preferredCourts.includes(name)) return
    const next = [...preferredCourts, name]
    setPreferredCourts(next)
    setNewCourt('')
    const updated = { ...profile, preferredCourts: next }
    switchProfile(updated)
  }

  function removeCourt(court: string) {
    const next = preferredCourts.filter(c => c !== court)
    setPreferredCourts(next)
    const updated = { ...profile, preferredCourts: next }
    switchProfile(updated)
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
      <div className="card profile-identity-card">
        <div className="card-status-row">
          <div className="card-status-label card-status-label--slate">Player Profile</div>
          {profile.skillLevel && (
            <div className="card-meta-chip">
              {profile.skillLevel.charAt(0).toUpperCase() + profile.skillLevel.slice(1)}
            </div>
          )}
        </div>
        <div className="profile-card">
          {/* Profile Photo */}
          <div className="profile-photo-section" onClick={() => fileInputRef.current?.click()} style={{ cursor: 'pointer' }}>
            {photoUrl ? (
              <img src={photoUrl} alt={profile.name} className="profile-avatar-img" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div className="profile-avatar">{profile.name[0].toUpperCase()}</div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoUpload}
            />
            <div className="profile-photo-hint" style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>Tap to change photo</div>
          </div>
          <h2 className="profile-name">{profile.name}</h2>
          {profile.email && (
            <p className="profile-email" style={{ fontSize: 'var(--font-body-sm)', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>{profile.email}</p>
          )}
          <p className="profile-county">{profile.county}</p>
          {profile.skillLevel && (
            <div className="profile-details">
              <p className="profile-skill">{profile.skillLevel.charAt(0).toUpperCase() + profile.skillLevel.slice(1)} &middot; {profile.skillLevel === 'beginner' ? 'NTRP 2.0\u20132.5' : profile.skillLevel === 'intermediate' ? 'NTRP 3.0\u20133.5' : profile.skillLevel === 'advanced' ? 'NTRP 4.0+' : ''}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>Your starting level — updates to Rally Rating after first matches</p>
            </div>
          )}
          {bio && <p className="profile-bio-display" style={{ marginTop: 6, fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{bio}</p>}
          {playingStyle.length > 0 && (
            <div className="profile-style-tags-display" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, justifyContent: 'center' }}>
              {playingStyle.map(s => (
                <span key={s} className="profile-style-tag" style={{ padding: '2px 10px', borderRadius: 12, background: 'var(--color-surface-alt, #f0f0f0)', fontSize: '0.8rem' }}>{s}</span>
              ))}
            </div>
          )}
          {totalMatches > 0 && <p className="profile-matches-played">{totalMatches} matches played</p>}
        </div>
      </div>

      {/* Bio & Playing Style */}
      <div className="card profile-section">
        <h3 className="profile-section-title"><span>Your Tennis Profile</span></h3>

        {/* Bio */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4, color: 'var(--color-text-secondary)' }}>Bio</label>
          <input
            type="text"
            className="form-input"
            placeholder="Introduce yourself to opponents..."
            value={bio}
            maxLength={150}
            onChange={e => handleBioChange(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', textAlign: 'right', marginTop: 2 }}>{150 - bio.length} characters remaining</div>
        </div>

        {/* Playing Style Tags */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 8, color: 'var(--color-text-secondary)' }}>Playing Style</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {STYLE_OPTIONS.map(style => (
              <button
                key={style}
                className={`btn btn-small ${playingStyle.includes(style) ? 'btn-primary' : ''}`}
                onClick={() => togglePlayingStyle(style)}
                style={{ borderRadius: 20 }}
              >
                {style}
              </button>
            ))}
          </div>
        </div>

        {/* Preferred Courts */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 8, color: 'var(--color-text-secondary)' }}>Home Courts (max 3)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: preferredCourts.length > 0 ? 8 : 0 }}>
            {preferredCourts.map(court => (
              <span key={court} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 16,
                background: 'var(--color-surface-alt, #f0f0f0)',
                fontSize: '0.85rem',
              }}>
                {court}
                <button
                  className="btn-icon"
                  onClick={() => removeCourt(court)}
                  style={{ fontSize: '0.75rem', padding: 0, lineHeight: 1 }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          {preferredCourts.length < 3 && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Where do you usually play?"
                value={newCourt}
                onChange={e => setNewCourt(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCourt() }}
                style={{ flex: 1 }}
              />
              <button className="btn btn-small" onClick={addCourt}>Add</button>
            </div>
          )}
        </div>
      </div>

      {/* Rating Hero Card */}
      <div className="card rating-hero">
        <div className="card-status-row">
          <div className="card-status-label card-status-label--blue">Rally Rating</div>
          {rankInfo.total > 1 && (
            <div className="card-meta-chip card-meta-chip--blue">Rank #{rankInfo.rank}</div>
          )}
        </div>
        <div className="card-summary-main rating-hero-summary">
          <div className="card-title">Your current rating</div>
          <div className="card-supporting">Ratings adjust after each match and help keep matchups fair.</div>
        </div>
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
        <div className="rating-hero-label">Your Rally Rating</div>
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
        <div className="rating-hero-explanation" style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: 8 }}>
          Ratings adjust after each match — win against stronger players for a bigger boost
        </div>
        {engagementPrompt && (
          <div className="engagement-prompt">{engagementPrompt}</div>
        )}
        <div className="rating-hero-actions">
          {onViewLeaderboard && rankInfo.total > 1 && (
            <button className="btn-link rating-hero-link" onClick={onViewLeaderboard}>View full leaderboard</button>
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
            <p className="trophy-empty-title">Your trophy case is empty — for now</p>
            <p className="trophy-empty-desc">Win matches to earn tournament trophies and badges</p>
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
        <h3 className="profile-section-title"><span>Your Record</span></h3>
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
        <h3 className="profile-section-title"><span>Your Rating Over Time</span></h3>
        <RatingChart history={ratingHistory} currentRating={rating.rating} />
        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: 8 }}>Each match result adjusts your rating. Decisive wins earn bigger jumps.</p>
        {completedTournaments.length > 0 && (
          <div className="tournament-history">
            {completedTournaments.map(t => {
              const result = getTournamentResult(t)
              return (
                <div key={t.id} className="history-card">
                  <div className="history-card-info">
                    <div className="history-card-name">{t.name}</div>
                    <div className="history-card-meta">{t.date} · {t.format === 'single-elimination' ? 'Elimination' : t.format === 'group-knockout' ? 'Group stage + Playoffs' : 'Round robin'}</div>
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
          <span>Your Availability</span>
          {!editing && <button className="btn btn-small" onClick={() => setEditing(true)}>Edit</button>}
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 12 }}>The more times you add, the more matches Rally can auto-schedule</p>
        {!editing ? (
          <div className="availability-current">
            {slots.length === 0 ? (
              <div>
                <p className="subtle">No availability set</p>
                <p style={{ color: 'var(--color-warning, #e6a200)', fontSize: '0.85rem', marginTop: 8 }}>Set your availability to get better match times</p>
              </div>
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
            <div className="avail-segmented-control">
              <button
                className={`avail-segment-btn ${availMode === 'quick' ? 'active' : ''}`}
                onClick={() => setAvailMode('quick')}
              >
                Quick Presets
              </button>
              <button
                className={`avail-segment-btn ${availMode === 'custom' ? 'active' : ''}`}
                onClick={() => setAvailMode('custom')}
              >
                Custom Times
              </button>
            </div>

            {availMode === 'quick' && (
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
            )}

            {availMode === 'custom' && (
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
            {showRatingInfo ? 'Hide rating info ▾' : 'How Rally Ratings work — and why they make matches fairer ▸'}
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

      {/* Help & How Rally Works */}
      {onViewHelp && (
        <button className="btn btn-large help-link-btn" onClick={onViewHelp}>How Rally Works</button>
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

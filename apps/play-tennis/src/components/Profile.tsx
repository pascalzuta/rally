import { useState } from 'react'
import { getPlayerRating, getRatingLabel, getPlayerTournaments, logout, getAvailability, saveAvailability } from '../store'
import { PlayerProfile, AvailabilitySlot, DayOfWeek } from '../types'

interface Props {
  profile: PlayerProfile
  onLogout: () => void
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

export default function Profile({ profile, onLogout }: Props) {
  const rating = getPlayerRating(profile.name)
  const label = getRatingLabel(rating.rating)
  const tournaments = getPlayerTournaments(profile.id)

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

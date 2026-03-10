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
      <div className="profile-card">
        <div className="profile-avatar">{profile.name[0].toUpperCase()}</div>
        <h2 className="profile-name">{profile.name}</h2>
        <p className="profile-county">{profile.county}</p>
      </div>

      <div className="rating-card">
        <div className="rating-big">{Math.round(rating.rating)}</div>
        <div className="rating-label-text">{label}</div>
      </div>

      <div className="stats-row">
        <div className="stat-box">
          <div className="stat-value">{rating.matchesPlayed}</div>
          <div className="stat-label">Matches</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{wins}</div>
          <div className="stat-label">Wins</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{losses}</div>
          <div className="stat-label">Losses</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{tournaments.length}</div>
          <div className="stat-label">Events</div>
        </div>
      </div>

      <div className="profile-section">
        <h3 className="profile-section-title">Availability</h3>
        {!editing ? (
          <>
            <div className="availability-current">
              {slots.length === 0 ? (
                <p>No availability slots set.</p>
              ) : (
                <ul>
                  {slots.map((slot, i) => {
                    const dayInfo = DAYS.find(d => d.key === slot.day)
                    return (
                      <li key={i}>
                        {dayInfo?.label ?? slot.day} {formatHour(slot.startHour)}–{formatHour(slot.endHour)}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            <button className="btn" onClick={() => setEditing(true)}>
              Edit Availability
            </button>
          </>
        ) : (
          <>
            <div className="quick-slots">
              {QUICK_SLOTS.map(qs => (
                <button
                  key={qs.label}
                  className={`btn btn-small${isQuickSlotActive(qs) ? ' active' : ''}`}
                  onClick={() => toggleQuickSlot(qs)}
                >
                  {qs.label}
                </button>
              ))}
            </div>

            <button className="btn btn-small" onClick={() => setDetailedMode(!detailedMode)}>
              {detailedMode ? 'Hide detailed' : 'Add specific times'}
            </button>

            {detailedMode && (
              <div className="detailed-slots">
                <select value={detailDay} onChange={e => setDetailDay(e.target.value as DayOfWeek)}>
                  {DAYS.map(d => (
                    <option key={d.key} value={d.key}>{d.label}</option>
                  ))}
                </select>
                <select value={detailStart} onChange={e => setDetailStart(Number(e.target.value))}>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{formatHour(i)}</option>
                  ))}
                </select>
                <span>to</span>
                <select value={detailEnd} onChange={e => setDetailEnd(Number(e.target.value))}>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{formatHour(i + 1)}</option>
                  ))}
                </select>
                <button className="btn btn-small" onClick={addDetailedSlot}>Add</button>
              </div>
            )}

            {slots.length > 0 && (
              <div className="availability-current">
                <ul>
                  {slots.map((slot, i) => {
                    const dayInfo = DAYS.find(d => d.key === slot.day)
                    return (
                      <li key={i}>
                        {dayInfo?.label ?? slot.day} {formatHour(slot.startHour)}–{formatHour(slot.endHour)}
                        <button className="btn btn-small" onClick={() => removeSlot(i)}>Remove</button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            <div className="btn-row">
              <button className="btn" onClick={handleSaveAvailability}>Save</button>
              <button className="btn" onClick={handleCancelEdit}>Cancel</button>
            </div>
          </>
        )}
      </div>

      <div className="profile-section">
        <h3 className="profile-section-title">Tournament History</h3>
        <div className="tournament-history">
          {completedTournaments.length === 0 ? (
            <p>No completed tournaments yet</p>
          ) : (
            completedTournaments.map(t => (
              <div key={t.id} className="history-card">
                <div className="history-card-name">{t.name}</div>
                <div className="history-card-date">{t.date}</div>
                <div className="history-card-result">{getTournamentResult(t)}</div>
                <div className="history-card-format">{t.format}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <button className="btn btn-large logout-btn" onClick={handleLogout}>
        Sign Out
      </button>
    </div>
  )
}

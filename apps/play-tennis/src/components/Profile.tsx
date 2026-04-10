import { formatHourCompact, titleCase } from '../dateUtils'
import { useState, useEffect, useRef, useMemo } from 'react'
import { getAvailability, switchProfile, getLobbyByCounty, getPlayerRating, getPlayerTournaments, getCountyLeaderboard } from '../store'
import { updateMyAvailability } from '../mutations'
import { useRallyData } from '../context/RallyDataProvider'
import { PlayerProfile, AvailabilitySlot, DayOfWeek } from '../types'
import { useToast } from './Toast'

interface Props {
  profile: PlayerProfile
  onLogout: () => void
  onNavigate: (tab: 'home' | 'bracket' | 'playnow') => void
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
  { label: 'Weekend mornings', slots: [
    { day: 'saturday', startHour: 8, endHour: 12 },
    { day: 'sunday', startHour: 8, endHour: 12 },
  ]},
  { label: 'Weekend afternoons', slots: [
    { day: 'saturday', startHour: 13, endHour: 17 },
    { day: 'sunday', startHour: 13, endHour: 17 },
  ]},
  { label: 'Weekday mornings', slots: [
    { day: 'monday', startHour: 8, endHour: 12 },
    { day: 'tuesday', startHour: 8, endHour: 12 },
    { day: 'wednesday', startHour: 8, endHour: 12 },
    { day: 'thursday', startHour: 8, endHour: 12 },
    { day: 'friday', startHour: 8, endHour: 12 },
  ]},
  { label: 'Weekday afternoons', slots: [
    { day: 'monday', startHour: 13, endHour: 17 },
    { day: 'tuesday', startHour: 13, endHour: 17 },
    { day: 'wednesday', startHour: 13, endHour: 17 },
    { day: 'thursday', startHour: 13, endHour: 17 },
    { day: 'friday', startHour: 13, endHour: 17 },
  ]},
]

export default function Profile({ profile, onLogout, onNavigate, onViewHelp }: Props) {
  const { showSuccess } = useToast()
  const { availability: providerAvailability } = useRallyData()

  const [editing, setEditing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photoUrl, setPhotoUrl] = useState<string>(profile.photoUrl ?? '')
  const [slots, setSlots] = useState<AvailabilitySlot[]>(() => getAvailability(profile.id))
  const [availMode, setAvailMode] = useState<'quick' | 'custom'>('quick')
  const [detailDay, setDetailDay] = useState<DayOfWeek>('monday')
  const [detailStart, setDetailStart] = useState(9)
  const [detailEnd, setDetailEnd] = useState(12)

  // Re-sync availability when provider data updates (e.g., after hydration from Supabase)
  useEffect(() => {
    if (!editing) {
      const fresh = getAvailability(profile.id)
      if (fresh.length > 0) setSlots(fresh)
    }
  }, [providerAvailability, profile.id])

  const playerRating = getPlayerRating(profile.id, profile.name)
  const tournamentsPlayed = getPlayerTournaments(profile.id).length

  const { wins, losses } = (() => {
    const leaderboard = getCountyLeaderboard(profile.county)
    const entry = leaderboard.find(e => e.name.toLowerCase() === profile.name.toLowerCase())
    return { wins: entry?.wins ?? 0, losses: entry?.losses ?? 0 }
  })()

  const joinDate = useMemo(() => {
    if (!profile.createdAt) return ''
    const d = new Date(profile.createdAt)
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }, [profile.createdAt])

  async function handleLogout() {
    onLogout()
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

  async function handleSaveAvailability() {
    // Mutations layer pulls profile context automatically — no params can be forgotten
    const result = await updateMyAvailability(slots)
    if (result.ok) {
      setEditing(false)
      showSuccess('Changes saved')
    } else {
      // Toast already shown by mutations layer — just don't close edit mode
      console.warn('[Rally] Save availability failed:', result.error)
    }
  }

  function handleCancelEdit() {
    setSlots(getAvailability(profile.id))
    setEditing(false)
    setAvailMode('quick')
  }

  // Social proof: count lobby players who overlap with current slots
  const matchableCount = useMemo(() => {
    if (slots.length === 0) return 0
    const lobby = getLobbyByCounty(profile.county)
    let count = 0
    for (const entry of lobby) {
      if (entry.playerId === profile.id) continue
      const playerSlots = getAvailability(entry.playerId)
      if (playerSlots.length === 0) continue
      const hasOverlap = slots.some(cs =>
        playerSlots.some(ps =>
          cs.day === ps.day &&
          Math.min(cs.endHour, ps.endHour) - Math.max(cs.startHour, ps.startHour) >= 2
        )
      )
      if (hasOverlap) count++
    }
    return count
  }, [slots, profile.county, profile.id])

  // Nudge: find which unselected quick slot would unlock the most additional matches
  const nudgeSuggestion = useMemo(() => {
    const lobby = getLobbyByCounty(profile.county)
    if (lobby.length === 0) return null

    let bestSlot: { label: string; gain: number } | null = null
    for (const qs of QUICK_SLOTS) {
      const alreadyHas = qs.slots.every(s =>
        slots.some(es => es.day === s.day && es.startHour === s.startHour && es.endHour === s.endHour)
      )
      if (alreadyHas) continue

      const combinedSlots = [...slots, ...qs.slots]
      let newMatches = 0
      for (const entry of lobby) {
        if (entry.playerId === profile.id) continue
        const playerSlots = getAvailability(entry.playerId)
        if (playerSlots.length === 0) continue
        const alreadyMatched = slots.some(cs =>
          playerSlots.some(ps =>
            cs.day === ps.day &&
            Math.min(cs.endHour, ps.endHour) - Math.max(cs.startHour, ps.startHour) >= 2
          )
        )
        if (alreadyMatched) continue
        const nowMatches = combinedSlots.some(cs =>
          playerSlots.some(ps =>
            cs.day === ps.day &&
            Math.min(cs.endHour, ps.endHour) - Math.max(cs.startHour, ps.startHour) >= 2
          )
        )
        if (nowMatches) newMatches++
      }
      if (newMatches > 0 && (!bestSlot || newMatches > bestSlot.gain)) {
        bestSlot = { label: qs.label.toLowerCase(), gain: newMatches }
      }
    }
    return bestSlot
  }, [slots, profile.county, profile.id])

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

  return (
    <div className="profile-content">
      {/* Hero Profile Card */}
      <div className="profile-hero-card">
        <div className="profile-hero-banner" />
        <div className="profile-hero-photo" onClick={() => fileInputRef.current?.click()}>
          {photoUrl ? (
            <img src={photoUrl} alt={profile.name} className="profile-hero-photo-img" />
          ) : (
            <div className="profile-hero-avatar">{profile.name[0].toUpperCase()}</div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handlePhotoUpload}
          />
        </div>
        <div className="profile-hero-info">
          <h2 className="profile-hero-name">{profile.name}</h2>
          <p className="profile-hero-county">{titleCase(profile.county)}</p>
          <div className="profile-hero-tags">
            {profile.skillLevel && (
              <span className="profile-hero-level">
                {profile.skillLevel.charAt(0).toUpperCase() + profile.skillLevel.slice(1)}
              </span>
            )}
            {joinDate && <span className="profile-hero-joined">Joined {joinDate}</span>}
          </div>
        </div>
        <div className="profile-hero-stats">
          <div className="profile-hero-stat">
            <span className="profile-hero-stat-value">{Math.round(playerRating.rating)}</span>
            <span className="profile-hero-stat-label">Rating</span>
          </div>
          <div className="profile-hero-stat">
            <span className="profile-hero-stat-value">{wins}<span className="profile-hero-stat-sep">–</span>{losses}</span>
            <span className="profile-hero-stat-label">W – L</span>
          </div>
          <div className="profile-hero-stat">
            <span className="profile-hero-stat-value">{tournamentsPlayed}</span>
            <span className="profile-hero-stat-label">Tournaments</span>
          </div>
        </div>
      </div>

      {/* Availability Section */}
      <div className="card profile-edit-card">
        <div className="profile-avail-header">
          <div>
            <h3 className="profile-edit-title">Availability</h3>
            <p className="profile-edit-subtitle">More times = more auto-scheduled matches</p>
          </div>
          {!editing && <button className="btn btn-small" onClick={() => setEditing(true)}>Edit</button>}
        </div>
        {!editing ? (
          <div className="availability-current">
            {slots.length === 0 ? (
              <div>
                <p className="subtle">No availability set</p>
                <p className="profile-avail-warning">Set your availability to get better match times</p>
              </div>
            ) : (
              <>
                {slots.map((slot, i) => {
                  const dayInfo = DAYS.find(d => d.key === slot.day)
                  return (
                    <div key={i} className="availability-slot-item">
                      <span className="availability-slot-day">{dayInfo?.short ?? slot.day}</span>
                      <span className="availability-slot-hours">{formatHourCompact(slot.startHour).replace(':00', '')}–{formatHourCompact(slot.endHour).replace(':00', '')}</span>
                    </div>
                  )
                })}
                {matchableCount > 0 && (
                  <div className="avail-social-proof">
                    <span className="avail-social-proof-count">{matchableCount}</span>
                    <span className="avail-social-proof-label">player{matchableCount !== 1 ? 's' : ''} share your times</span>
                  </div>
                )}
                {nudgeSuggestion && (
                  <p className="avail-profile-nudge">
                    Add {nudgeSuggestion.label} to match with {nudgeSuggestion.gain} more player{nudgeSuggestion.gain !== 1 ? 's' : ''}
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            <div className="avail-mode-toggle">
              <button
                className={`avail-mode-btn ${availMode === 'custom' ? 'active' : ''}`}
                onClick={() => setAvailMode('custom')}
              >
                Custom times
              </button>
              <button
                className={`avail-mode-btn ${availMode === 'quick' ? 'active' : ''}`}
                onClick={() => setAvailMode('quick')}
              >
                Quick presets
              </button>
            </div>

            {availMode === 'quick' && (
              <div className="quick-slots-v2">
                <p className="quick-presets-hint">Tap to add common time blocks</p>
                {QUICK_SLOTS.map(qs => (
                  <button
                    key={qs.label}
                    className={`quick-slot-v2 ${isQuickSlotActive(qs) ? 'selected' : ''}`}
                    onClick={() => toggleQuickSlot(qs)}
                  >
                    <span className="quick-slot-v2-check">{isQuickSlotActive(qs) ? '\u2713' : ''}</span>
                    <span className="quick-slot-v2-label">{qs.label}</span>
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
                    <option key={h} value={h}>{formatHourCompact(h)}</option>
                  ))}
                </select>
                <span>–</span>
                <select value={detailEnd} onChange={e => setDetailEnd(Number(e.target.value))}>
                  {Array.from({ length: 16 }, (_, i) => i + 7).map(h => (
                    <option key={h} value={h}>{formatHourCompact(h)}</option>
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
                      <span className="availability-slot-hours">{formatHourCompact(slot.startHour)}–{formatHourCompact(slot.endHour)}</span>
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

      {/* Help & How Rally Works */}
      {onViewHelp && (
        <button className="btn btn-large help-link-btn" onClick={onViewHelp}>How Rally Works</button>
      )}

      {/* Sign Out */}
      <button className="btn btn-large logout-btn" onClick={handleLogout}>Sign Out</button>
    </div>
  )
}

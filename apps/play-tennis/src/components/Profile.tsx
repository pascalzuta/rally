import { formatHourCompact } from '../dateUtils'
import { useState, useRef } from 'react'
import { logout, getAvailability, saveAvailability, switchProfile } from '../store'
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
  { label: 'Saturday mornings', slots: [{ day: 'saturday', startHour: 8, endHour: 12 }]},
  { label: 'Saturday afternoons', slots: [{ day: 'saturday', startHour: 13, endHour: 17 }]},
  { label: 'Sunday mornings', slots: [{ day: 'sunday', startHour: 8, endHour: 12 }]},
  { label: 'Sunday afternoons', slots: [{ day: 'sunday', startHour: 13, endHour: 17 }]},
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

  const [editing, setEditing] = useState(false)
  const [showRatingInfo, setShowRatingInfo] = useState(false)
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
        </div>
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
                    <span className="availability-slot-hours">{formatHourCompact(slot.startHour).replace(':00', '')}–{formatHourCompact(slot.endHour).replace(':00', '')}</span>
                  </div>
                )
              })
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
                <button
                  className={`quick-slot-v2 quick-slot-v2--wide ${isQuickSlotActive(QUICK_SLOTS[0]) ? 'selected' : ''}`}
                  onClick={() => toggleQuickSlot(QUICK_SLOTS[0])}
                >
                  <span className="quick-slot-v2-check">{isQuickSlotActive(QUICK_SLOTS[0]) ? '\u2713' : ''}</span>
                  <span className="quick-slot-v2-label">{QUICK_SLOTS[0].label}</span>
                  <span className="quick-slot-v2-time">Mon–Fri 6–9pm</span>
                </button>
                <div className="quick-slots-grid">
                {QUICK_SLOTS.slice(1).map(qs => (
                  <button
                    key={qs.label}
                    className={`quick-slot-v2 ${isQuickSlotActive(qs) ? 'selected' : ''}`}
                    onClick={() => toggleQuickSlot(qs)}
                  >
                    <span className="quick-slot-v2-check">{isQuickSlotActive(qs) ? '\u2713' : ''}</span>
                    <span className="quick-slot-v2-label">{qs.label.replace('Saturday ', 'Sat ').replace('Sunday ', 'Sun ')}</span>
                  </button>
                ))}
              </div>
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

      {/* Bio & Playing Style */}
      <div className="card profile-section">
        <h3 className="profile-section-title"><span>Your Tennis Profile</span></h3>

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

      {/* Rating Explanation (collapsed by default) */}
      <div className="card profile-section">
        <button className="rating-explainer-toggle" onClick={() => setShowRatingInfo(!showRatingInfo)}>
          <span className="rating-explainer-toggle-text">How ratings work</span>
          <span className="rating-explainer-toggle-chevron">{showRatingInfo ? '▾' : '▸'}</span>
        </button>
        {showRatingInfo && (
          <div className="rating-explainer">
            <p>Rally uses an <strong>Elo rating system</strong>, similar to chess. Every player starts at <strong>1500</strong>.</p>
            <p>Beat a stronger opponent for a bigger boost. Lose to a weaker one and you drop more. The system finds your true level over time.</p>
            <div className="rating-tiers">
              <div className="rating-tier"><span className="tier-range">2200+</span><span className="tier-label">Pro</span></div>
              <div className="rating-tier"><span className="tier-range">2000–2199</span><span className="tier-label">Semi-pro</span></div>
              <div className="rating-tier"><span className="tier-range">1800–1999</span><span className="tier-label">Elite</span></div>
              <div className="rating-tier"><span className="tier-range">1600–1799</span><span className="tier-label">Strong</span></div>
              <div className="rating-tier"><span className="tier-range">1400–1599</span><span className="tier-label">Club</span></div>
              <div className="rating-tier"><span className="tier-range">1200–1399</span><span className="tier-label">Beginner</span></div>
              <div className="rating-tier"><span className="tier-range">&lt;1200</span><span className="tier-label">Newcomer</span></div>
            </div>
            <p className="rating-explainer-footnote">Ratings shift more in your first few matches, then stabilise.</p>
          </div>
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

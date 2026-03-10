import { useState } from 'react'
import { createProfile, saveAvailability } from '../store'
import { PlayerProfile, AvailabilitySlot, DayOfWeek } from '../types'

interface Props {
  onRegistered: (profile: PlayerProfile) => void
  inviteCounty?: string | null
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
  { label: 'Saturday mornings', slots: [
    { day: 'saturday', startHour: 8, endHour: 12 },
  ]},
  { label: 'Saturday afternoons', slots: [
    { day: 'saturday', startHour: 13, endHour: 17 },
  ]},
  { label: 'Sunday mornings', slots: [
    { day: 'sunday', startHour: 8, endHour: 12 },
  ]},
  { label: 'Sunday afternoons', slots: [
    { day: 'sunday', startHour: 13, endHour: 17 },
  ]},
]

function formatHour(h: number): string {
  if (h === 0 || h === 24) return '12am'
  if (h === 12) return '12pm'
  return h < 12 ? `${h}am` : `${h - 12}pm`
}

export default function Register({ onRegistered, inviteCounty }: Props) {
  const [step, setStep] = useState<'info' | 'availability'>('info')
  const [name, setName] = useState('')
  const [county, setCounty] = useState(inviteCounty ?? '')
  const [selectedQuick, setSelectedQuick] = useState<Set<number>>(new Set())
  const [detailedMode, setDetailedMode] = useState(false)
  const [detailedSlots, setDetailedSlots] = useState<AvailabilitySlot[]>([])
  const [addingDay, setAddingDay] = useState<DayOfWeek | ''>('')
  const [addingStart, setAddingStart] = useState(18)
  const [addingEnd, setAddingEnd] = useState(21)

  function handleInfoSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !county) return
    setStep('availability')
  }

  function toggleQuickSlot(idx: number) {
    const next = new Set(selectedQuick)
    if (next.has(idx)) next.delete(idx)
    else next.add(idx)
    setSelectedQuick(next)
  }

  function addDetailedSlot() {
    if (!addingDay || addingStart >= addingEnd) return
    setDetailedSlots(prev => [...prev, { day: addingDay as DayOfWeek, startHour: addingStart, endHour: addingEnd }])
    setAddingDay('')
  }

  function removeDetailedSlot(idx: number) {
    setDetailedSlots(prev => prev.filter((_, i) => i !== idx))
  }

  function handleFinish(skip: boolean) {
    const profile = createProfile(name, county)

    if (!skip) {
      let slots: AvailabilitySlot[] = []
      if (detailedMode) {
        slots = detailedSlots
      } else {
        for (const idx of selectedQuick) {
          slots.push(...QUICK_SLOTS[idx].slots)
        }
      }
      if (slots.length > 0) {
        saveAvailability(profile.id, slots)
      }
    }

    onRegistered(profile)
  }

  if (step === 'info') {
    return (
      <div className="screen">
        <header className="header">
          <h1>Play Tennis</h1>
        </header>

        <main className="content">
          <div className="register-hero">
            <div className="empty-icon">🎾</div>
            {inviteCounty ? (
              <p>You've been invited to play in {inviteCounty}!</p>
            ) : (
              <p>Join your local tennis community</p>
            )}
          </div>

          <form onSubmit={handleInfoSubmit} className="form">
            <label className="field">
              <span className="field-label">Your Name</span>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. John Smith"
                autoFocus
              />
            </label>

            <label className="field">
              <span className="field-label">County</span>
              <input
                type="text"
                value={county}
                onChange={e => setCounty(e.target.value)}
                placeholder="e.g. Los Angeles County, CA"
                readOnly={!!inviteCounty}
              />
            </label>

            <button
              type="submit"
              className="btn btn-primary btn-large"
              disabled={!name.trim() || !county}
            >
              Next
            </button>
          </form>
        </main>
      </div>
    )
  }

  // Step 2: Availability
  return (
    <div className="screen">
      <header className="header">
        <h1>Play Tennis</h1>
      </header>

      <main className="content">
        <div className="register-hero">
          <div className="empty-icon">📅</div>
          <p>When can you play?</p>
          <p className="subtle">Helps us schedule matches automatically</p>
        </div>

        <div className="availability-picker">
          {!detailedMode ? (
            <>
              <div className="quick-slots">
                {QUICK_SLOTS.map((slot, idx) => (
                  <button
                    key={idx}
                    className={`quick-slot-btn ${selectedQuick.has(idx) ? 'selected' : ''}`}
                    onClick={() => toggleQuickSlot(idx)}
                  >
                    <span className="quick-slot-check">{selectedQuick.has(idx) ? '✓' : ''}</span>
                    {slot.label}
                  </button>
                ))}
              </div>
              <button className="btn-link" onClick={() => setDetailedMode(true)}>
                Set specific times instead
              </button>
            </>
          ) : (
            <>
              {detailedSlots.length > 0 && (
                <ul className="detailed-slot-list">
                  {detailedSlots.map((s, i) => (
                    <li key={i} className="detailed-slot-item">
                      <span>{DAYS.find(d => d.key === s.day)?.label} {formatHour(s.startHour)}–{formatHour(s.endHour)}</span>
                      <button className="btn-icon" onClick={() => removeDetailedSlot(i)}>✕</button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="detailed-add-row">
                <select value={addingDay} onChange={e => setAddingDay(e.target.value as DayOfWeek | '')}>
                  <option value="">Day...</option>
                  {DAYS.map(d => <option key={d.key} value={d.key}>{d.short}</option>)}
                </select>
                <select value={addingStart} onChange={e => setAddingStart(Number(e.target.value))}>
                  {Array.from({ length: 16 }, (_, i) => i + 6).map(h => (
                    <option key={h} value={h}>{formatHour(h)}</option>
                  ))}
                </select>
                <span>–</span>
                <select value={addingEnd} onChange={e => setAddingEnd(Number(e.target.value))}>
                  {Array.from({ length: 16 }, (_, i) => i + 7).map(h => (
                    <option key={h} value={h}>{formatHour(h)}</option>
                  ))}
                </select>
                <button className="btn dev-btn" onClick={addDetailedSlot} disabled={!addingDay || addingStart >= addingEnd}>
                  Add
                </button>
              </div>

              <button className="btn-link" onClick={() => setDetailedMode(false)}>
                Use quick picks instead
              </button>
            </>
          )}
        </div>

        <div className="availability-actions">
          <button
            className="btn btn-primary btn-large"
            onClick={() => handleFinish(false)}
            disabled={detailedMode ? detailedSlots.length === 0 : selectedQuick.size === 0}
          >
            {inviteCounty ? 'Join & Play' : 'Join'}
          </button>
          <button
            className="btn btn-large"
            onClick={() => handleFinish(true)}
          >
            Skip for now
          </button>
        </div>
      </main>
    </div>
  )
}

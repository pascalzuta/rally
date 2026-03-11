import { useState, useEffect, useRef } from 'react'
import { createProfile, saveAvailability } from '../store'
import { PlayerProfile, AvailabilitySlot, DayOfWeek } from '../types'
import { searchCounties } from '../counties'

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

// Reverse geocode coordinates to county using free Nominatim API
async function reverseGeocodeCounty(lat: number, lon: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const data = await res.json()
    const addr = data?.address
    if (!addr) return null
    const county = addr.county
    const state = addr.state
    if (!county || !state) return null
    // Convert state name to abbreviation
    const abbr = STATE_ABBREVS[state.toLowerCase()]
    if (!abbr) return null
    // Ensure "County" suffix
    const countyName = county.includes('County') || county.includes('Parish') || county.includes('Borough')
      ? county
      : `${county} County`
    return `${countyName}, ${abbr}`
  } catch {
    return null
  }
}

const STATE_ABBREVS: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'district of columbia': 'DC',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL',
  'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA',
  'maine': 'ME', 'maryland': 'MD', 'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN',
  'mississippi': 'MS', 'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK', 'oregon': 'OR',
  'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD',
  'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT', 'virginia': 'VA',
  'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
}

type Step = 'onboard-1' | 'onboard-2' | 'onboard-3' | 'signup' | 'availability'

export default function Register({ onRegistered, inviteCounty }: Props) {
  const [step, setStep] = useState<Step>(inviteCounty ? 'signup' : 'onboard-1')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [county, setCounty] = useState(inviteCounty ?? '')
  const [countyQuery, setCountyQuery] = useState(inviteCounty ?? '')
  const [countySuggestions, setCountySuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestedCounty, setSuggestedCounty] = useState<string | null>(null)
  const [detectingLocation, setDetectingLocation] = useState(false)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const [selectedQuick, setSelectedQuick] = useState<Set<number>>(new Set())
  const [detailedMode, setDetailedMode] = useState(false)
  const [detailedSlots, setDetailedSlots] = useState<AvailabilitySlot[]>([])
  const [addingDay, setAddingDay] = useState<DayOfWeek | ''>('')
  const [addingStart, setAddingStart] = useState(18)
  const [addingEnd, setAddingEnd] = useState(21)

  // Attempt geolocation on signup step
  useEffect(() => {
    if (step === 'signup' && !inviteCounty && !suggestedCounty && !detectingLocation) {
      if ('geolocation' in navigator) {
        setDetectingLocation(true)
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const result = await reverseGeocodeCounty(pos.coords.latitude, pos.coords.longitude)
            if (result) setSuggestedCounty(result)
            setDetectingLocation(false)
          },
          () => setDetectingLocation(false),
          { timeout: 5000 }
        )
      }
    }
  }, [step, inviteCounty, suggestedCounty, detectingLocation])

  // County autocomplete
  useEffect(() => {
    if (countyQuery.length >= 2 && county !== countyQuery) {
      const results = searchCounties(countyQuery)
      setCountySuggestions(results)
      setShowSuggestions(results.length > 0)
    } else {
      setCountySuggestions([])
      setShowSuggestions(false)
    }
  }, [countyQuery, county])

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function selectCounty(value: string) {
    setCounty(value)
    setCountyQuery(value)
    setShowSuggestions(false)
  }

  function useSuggestedCounty() {
    if (suggestedCounty) {
      selectCounty(suggestedCounty)
      setSuggestedCounty(null)
    }
  }

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()

  function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim() || !county) return
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
    const profile = createProfile(fullName, county)
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

  // Social proof number (deterministic based on county)
  function getPlayerCount(c: string): number {
    if (!c) return 0
    let hash = 0
    for (let i = 0; i < c.length; i++) hash = ((hash << 5) - hash + c.charCodeAt(i)) | 0
    return 80 + Math.abs(hash % 400)
  }

  // --- Onboarding Screen 1: The Problem ---
  if (step === 'onboard-1') {
    return (
      <div className="onboard-screen">
        <div className="onboard-content">
          <div className="onboard-visual">
            <div className="onboard-chat">
              <div className="onboard-chat-bubble onboard-chat-out">Can you play Tuesday?</div>
              <div className="onboard-chat-bubble onboard-chat-in">Maybe Wednesday?</div>
              <div className="onboard-chat-bubble onboard-chat-out">I can't that day</div>
              <div className="onboard-chat-bubble onboard-chat-in">Let's try next week</div>
            </div>
          </div>

          <h1 className="onboard-title">Scheduling tennis is frustrating</h1>
          <p className="onboard-subtitle">You message five people just to organize one match.</p>
          <p className="onboard-tagline">Rally removes the scheduling headache.</p>
        </div>

        <div className="onboard-actions">
          <button className="btn btn-primary btn-large onboard-btn" onClick={() => setStep('onboard-2')}>
            Continue
          </button>
          <div className="onboard-dots">
            <span className="onboard-dot active" />
            <span className="onboard-dot" />
            <span className="onboard-dot" />
          </div>
        </div>
      </div>
    )
  }

  // --- Onboarding Screen 2: The Solution ---
  if (step === 'onboard-2') {
    return (
      <div className="onboard-screen">
        <div className="onboard-content">
          <div className="onboard-visual">
            <div className="onboard-match-visual">
              <div className="onboard-match-row">
                <span className="onboard-match-player">You</span>
                <span className="onboard-match-time">Sat 9am available</span>
              </div>
              <div className="onboard-match-row">
                <span className="onboard-match-player">Opponent</span>
                <span className="onboard-match-time">Sat 9am available</span>
              </div>
              <div className="onboard-match-confirmed">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="8" fill="var(--color-positive-primary)" />
                  <path d="M4.5 8L7 10.5L11.5 5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Match scheduled
              </div>
            </div>
          </div>

          <h1 className="onboard-title">Rally schedules matches automatically</h1>
          <p className="onboard-subtitle">Find local opponents and let Rally coordinate the match time.</p>
          <p className="onboard-tagline">Just show up and play.</p>
        </div>

        <div className="onboard-actions">
          <button className="btn btn-primary btn-large onboard-btn" onClick={() => setStep('onboard-3')}>
            Continue
          </button>
          <div className="onboard-dots">
            <span className="onboard-dot" />
            <span className="onboard-dot active" />
            <span className="onboard-dot" />
          </div>
        </div>
      </div>
    )
  }

  // --- Onboarding Screen 3: The Motivation ---
  if (step === 'onboard-3') {
    return (
      <div className="onboard-screen">
        <div className="onboard-content">
          <div className="onboard-visual">
            <div className="onboard-leaderboard">
              <div className="onboard-lb-header">Local Rankings</div>
              {[
                { rank: '#1', name: 'Taylor Kim', rating: 1650 },
                { rank: '#2', name: 'Alex Rivera', rating: 1580 },
                { rank: '#3', name: 'Sam Patel', rating: 1520 },
                { rank: '#4', name: 'You', rating: '—', isYou: true },
              ].map((row, i) => (
                <div key={i} className={`onboard-lb-row ${row.isYou ? 'onboard-lb-you' : ''}`}>
                  <span className="onboard-lb-rank">{row.rank}</span>
                  <span className="onboard-lb-name">{row.name}</span>
                  <span className="onboard-lb-rating">{row.rating}</span>
                </div>
              ))}
            </div>
          </div>

          <h1 className="onboard-title">Compete in your local tennis ladder</h1>
          <p className="onboard-subtitle">Play matches, climb the rankings, and win tournaments.</p>
          <p className="onboard-tagline">Every match counts.</p>
        </div>

        <div className="onboard-actions">
          <button className="btn btn-primary btn-large onboard-btn" onClick={() => setStep('signup')}>
            Join Rally
          </button>
          <div className="onboard-dots">
            <span className="onboard-dot" />
            <span className="onboard-dot" />
            <span className="onboard-dot active" />
          </div>
        </div>
      </div>
    )
  }

  // --- Signup Screen ---
  if (step === 'signup') {
    return (
      <div className="onboard-screen signup-screen">
        <div className="signup-content">
          <div className="signup-header">
            <h1 className="signup-title">Start Playing</h1>
            <p className="signup-subtitle">We'll Handle the Scheduling</p>
            <p className="signup-desc">Find local players and let Rally organize your matches.</p>
          </div>

          {inviteCounty && (
            <div className="signup-invite-banner">
              You've been invited to play in {inviteCounty}
            </div>
          )}

          <form onSubmit={handleSignup} className="signup-form">
            <label className="field">
              <span className="field-label">First name</span>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="e.g. John"
                autoFocus
              />
            </label>

            <label className="field">
              <span className="field-label">Last name</span>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="e.g. Smith"
              />
            </label>

            <div className="field" ref={suggestionsRef}>
              <span className="field-label">Where do you play?</span>
              {inviteCounty ? (
                <input type="text" value={county} readOnly />
              ) : (
                <>
                  <input
                    type="text"
                    value={countyQuery}
                    onChange={e => {
                      setCountyQuery(e.target.value)
                      setCounty('')
                    }}
                    onFocus={() => {
                      if (countySuggestions.length > 0) setShowSuggestions(true)
                    }}
                    placeholder="Search county..."
                  />
                  {showSuggestions && (
                    <div className="county-suggestions">
                      {countySuggestions.map(c => (
                        <button
                          key={c}
                          type="button"
                          className="county-suggestion-item"
                          onClick={() => selectCounty(c)}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {suggestedCounty && !county && (
              <div className="county-detected">
                <span className="county-detected-label">Detected location</span>
                <button type="button" className="county-detected-btn" onClick={useSuggestedCounty}>
                  {suggestedCounty}
                  <span className="county-detected-use">Use this</span>
                </button>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-large signup-cta"
              disabled={!firstName.trim() || !lastName.trim() || !county}
            >
              Start Competing
            </button>
          </form>

          {county && (
            <p className="signup-social-proof">
              {getPlayerCount(county)} players competing in {county.split(',')[0]}
            </p>
          )}
        </div>
      </div>
    )
  }

  // --- Step: Availability ---
  return (
    <div className="onboard-screen">
      <div className="signup-content">
        <div className="signup-header">
          <h1 className="signup-title">When can you play?</h1>
          <p className="signup-desc">Helps us schedule matches automatically</p>
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
            Start Competing
          </button>
          <button
            className="btn btn-large"
            onClick={() => handleFinish(true)}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}

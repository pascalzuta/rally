import { formatHourCompact } from '../dateUtils'
import { useState, useEffect, useRef } from 'react'
import { createProfile, saveAvailability, getLobbyByCounty, getAvailability } from '../store'
import { PlayerProfile, AvailabilitySlot, DayOfWeek, SkillLevel, Gender } from '../types'
import { searchCounties } from '../counties'
import { sendOtp, verifyOtp, getSession, onAuthStateChange, fetchExistingPlayer } from '../supabase'

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


/** Generate time options in 30-min increments */
function timeOptions(startVal: number, endVal: number): { value: number; label: string }[] {
  const opts: { value: number; label: string }[] = []
  for (let h = startVal; h <= endVal; h += 0.5) {
    opts.push({ value: h, label: formatHourCompact(h) })
  }
  return opts
}

const START_OPTIONS = timeOptions(6, 21.5)
const END_OPTIONS = timeOptions(6.5, 22)

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

type Step = 'onboard-1' | 'onboard-2' | 'onboard-3' | 'email' | 'verify' | 'signup' | 'skill-gender' | 'availability' | 'confirmed'

export default function Register({ onRegistered, inviteCounty }: Props) {
  // R-12: Auto-skip onboarding for returning users
  const [step, setStepRaw] = useState<Step>(() => {
    if (inviteCounty) return 'email'
    try {
      const saved = localStorage.getItem('play-tennis-profile')
      if (saved) {
        const prev = JSON.parse(saved)
        if (prev.name && prev.county) return 'email'
      }
    } catch { /* ignore */ }
    return 'onboard-1'
  })

  // Wrap setStep to push browser history so the back button works
  const setStep = (next: Step) => {
    window.history.pushState({ step: next }, '')
    setStepRaw(next)
  }

  // Listen for browser back/forward button
  useEffect(() => {
    // Replace initial state so popstate has something to land on
    window.history.replaceState({ step }, '')

    function onPopState(e: PopStateEvent) {
      if (e.state?.step) {
        setStepRaw(e.state.step)
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auth state
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpSending, setOtpSending] = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [otpError, setOtpError] = useState<string | null>(null)
  const [resendCountdown, setResendCountdown] = useState(0)
  const [authUserId, setAuthUserId] = useState<string | null>(null)

  // Check for existing session on mount + listen for magic link auth
  useEffect(() => {
    // Check if already authenticated (e.g. page refresh with valid session)
    getSession().then(async session => {
      if (session) {
        setAuthUserId(session.userId)
        setEmail(session.email)
        // If user already completed registration, skip straight to home
        const existing = await fetchExistingPlayer(session.userId)
        if (existing) {
          const p = createProfile(existing.name, existing.county, {
            email: session.email,
            authId: session.userId,
          })
          onRegistered(p)
          return
        }
        setStep('signup')
      }
    })

    // Listen for magic link redirect (tokens arrive via URL hash)
    const unsub = onAuthStateChange(async (event, userId, userEmail) => {
      if (event === 'SIGNED_IN' && userId) {
        setAuthUserId(userId)
        if (userEmail) setEmail(userEmail)
        // If user already completed registration, skip straight to home
        const existing = await fetchExistingPlayer(userId)
        if (existing) {
          const p = createProfile(existing.name, existing.county, {
            email: userEmail ?? undefined,
            authId: userId,
          })
          onRegistered(p)
          return
        }
        setStep('signup')
      }
    })
    return unsub
  }, [])

  // Resend countdown timer
  useEffect(() => {
    if (resendCountdown <= 0) return
    const timer = setTimeout(() => setResendCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCountdown])

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [county, setCounty] = useState(inviteCounty ?? '')
  const [countyQuery, setCountyQuery] = useState(inviteCounty ?? '')
  const [countySuggestions, setCountySuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestedCounty, setSuggestedCounty] = useState<string | null>(null)
  const [detectingLocation, setDetectingLocation] = useState(false)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const [skillLevel, setSkillLevel] = useState<SkillLevel | ''>('')
  const [gender, setGender] = useState<Gender | ''>('')

  const [selectedQuick, setSelectedQuick] = useState<Set<number>>(new Set())
  const [detailedMode, setDetailedMode] = useState(true)  // Custom times is now the default/primary
  const [detailedSlots, setDetailedSlots] = useState<AvailabilitySlot[]>([])
  const [addingDay, setAddingDay] = useState<DayOfWeek | ''>('')
  const [addingStart, setAddingStart] = useState(18)
  const [addingEnd, setAddingEnd] = useState(21)
  const [weeklyCap, setWeeklyCap] = useState<1 | 2 | 3>(2)
  const [matchableCount, setMatchableCount] = useState(0)

  function detectLocation() {
    if (detectingLocation || suggestedCounty) return
    if ('geolocation' in navigator) {
      setDetectingLocation(true)
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const result = await reverseGeocodeCounty(pos.coords.latitude, pos.coords.longitude)
          if (result) {
            setSuggestedCounty(result)
            selectCounty(result)
          }
          setDetectingLocation(false)
        },
        () => setDetectingLocation(false),
        { timeout: 5000 }
      )
    }
  }

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
    setStep('skill-gender')
  }

  // Presets now pre-fill the detailed slots list (shortcuts, not a separate mode)
  function toggleQuickSlot(idx: number) {
    const next = new Set(selectedQuick)
    if (next.has(idx)) {
      next.delete(idx)
      const slotsToRemove = QUICK_SLOTS[idx].slots
      setDetailedSlots(prev => prev.filter(existing =>
        !slotsToRemove.some(r => r.day === existing.day && r.startHour === existing.startHour && r.endHour === existing.endHour)
      ))
    } else {
      next.add(idx)
      const newSlots = QUICK_SLOTS[idx].slots
      setDetailedSlots(prev => {
        const combined = [...prev]
        for (const s of newSlots) {
          const exists = combined.some(e => e.day === s.day && e.startHour === s.startHour && e.endHour === s.endHour)
          if (!exists) combined.push(s)
        }
        return combined
      })
      setDetailedMode(true)
    }
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

  // Compute matchable players count -- detailedSlots is always the combined source
  useEffect(() => {
    if (!county) { setMatchableCount(0); return }
    const currentSlots: AvailabilitySlot[] = detailedSlots

    if (currentSlots.length === 0) { setMatchableCount(0); return }

    const lobby = getLobbyByCounty(county)
    let count = 0
    for (const entry of lobby) {
      const playerSlots = getAvailability(entry.playerId)
      if (playerSlots.length === 0) continue
      // Check if any slot overlaps (same day, >= 2 hour overlap)
      const hasOverlap = currentSlots.some(cs =>
        playerSlots.some(ps =>
          cs.day === ps.day &&
          Math.min(cs.endHour, ps.endHour) - Math.max(cs.startHour, ps.startHour) >= 2
        )
      )
      if (hasOverlap) count++
    }
    setMatchableCount(count)
  }, [county, detailedSlots])

  const [createdProfile, setCreatedProfile] = useState<PlayerProfile | null>(null)

  function handleFinish(skip: boolean) {
    const p = createProfile(fullName, county, {
      skillLevel: skillLevel || undefined,
      gender: gender || undefined,
      email: email || undefined,
      authId: authUserId || undefined,
    })
    // Save weekly cap to profile
    p.weeklyCap = weeklyCap
    localStorage.setItem('play-tennis-profile', JSON.stringify(p))

    if (!skip) {
      // detailedSlots is the combined source (presets pre-fill into it)
      const slots = detailedSlots
      if (slots.length > 0) {
        saveAvailability(p.id, slots, county, weeklyCap)
      }
    }
    setCreatedProfile(p)
    setStep('confirmed')
    setTimeout(() => onRegistered(p), 1500)
  }

  // Social proof number (deterministic based on county)
  function getPlayerCount(c: string): number {
    if (!c) return 0
    let hash = 0
    for (let i = 0; i < c.length; i++) hash = ((hash << 5) - hash + c.charCodeAt(i)) | 0
    return 80 + Math.abs(hash % 400)
  }


  // --- Swipeable Onboarding ---
  const onboardScreens: ('onboard-1' | 'onboard-2' | 'onboard-3')[] = ['onboard-1', 'onboard-2', 'onboard-3']
  const currentIdx = onboardScreens.indexOf(step as 'onboard-1' | 'onboard-2' | 'onboard-3')

  if (currentIdx >= 0) {
    function handleSwipe(dir: 'left' | 'right') {
      if (dir === 'left' && currentIdx < 2) {
        setStep(onboardScreens[currentIdx + 1])
      } else if (dir === 'right' && currentIdx > 0) {
        setStep(onboardScreens[currentIdx - 1])
      }
    }

    const touchStartX = useRef(0)
    const touchStartY = useRef(0)

    function onTouchStart(e: React.TouchEvent) {
      touchStartX.current = e.touches[0].clientX
      touchStartY.current = e.touches[0].clientY
    }

    function onTouchEnd(e: React.TouchEvent) {
      const dx = e.changedTouches[0].clientX - touchStartX.current
      const dy = e.changedTouches[0].clientY - touchStartY.current
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        handleSwipe(dx < 0 ? 'left' : 'right')
      }
    }

    const slides = [
      {
        visual: (
          <div className="onboard-chat onboard-chat-chaotic">
            <div className="onboard-chat-bubble onboard-chat-out">Can you play Tuesday?</div>
            <div className="onboard-chat-bubble onboard-chat-in">Maybe Wednesday?</div>
            <div className="onboard-chat-bubble onboard-chat-out">Next week?</div>
            <div className="onboard-chat-bubble onboard-chat-in">Let me check...</div>
          </div>
        ),
        title: 'Scheduling tennis shouldn\'t take 20 messages',
        subtitle: 'Rally handles the back-and-forth for you.',
      },
      {
        visual: (
          <div className="onboard-match-visual">
            <div className="onboard-match-row">
              <span className="onboard-match-player">You</span>
              <span className="onboard-match-time">Sat 9am</span>
            </div>
            <div className="onboard-match-row">
              <span className="onboard-match-player">Opponent</span>
              <span className="onboard-match-time">Sat 9am</span>
            </div>
            <div className="onboard-match-confirmed">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="8" fill="var(--color-positive-primary)" />
                <path d="M4.5 8L7 10.5L11.5 5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Match scheduled</span>
            </div>
          </div>
        ),
        title: 'Matches are scheduled automatically',
        subtitle: 'Set your availability. Rally does the rest.',
      },
      {
        visual: (
          <div className="onboard-leaderboard">
            <div className="onboard-lb-header">Local Rankings</div>
            {[
              { rank: '#1', name: 'Taylor Kim', rating: 1650 },
              { rank: '#2', name: 'Alex Rivera', rating: 1580 },
              { rank: '#3', name: 'Sam Patel', rating: 1520 },
              { rank: '#4', name: 'You', rating: '\u2014', isYou: true },
            ].map((row, i) => (
              <div key={i} className={`onboard-lb-row ${row.isYou ? 'onboard-lb-you' : ''}`}>
                <span className="onboard-lb-rank">{row.rank}</span>
                <span className="onboard-lb-name">{row.name}</span>
                <span className="onboard-lb-rating">{row.rating}</span>
              </div>
            ))}
          </div>
        ),
        title: 'Compete in your local ladder',
        subtitle: 'Play matches. Climb the rankings.',
      },
    ]

    const slide = slides[currentIdx]

    return (
      <div
        className="onboard-screen"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="onboard-logo">
          <svg width="120" height="40" viewBox="8 20 208 94" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M 12 21 L 13 21 L 14 21 L 15 21 L 16 21 L 17 21 L 18 22 L 19 22 L 20 22 L 21 22 L 22 22 L 23 23 L 24 23 L 25 23 L 26 23 L 27 23 L 28 23 L 29 24 L 30 24 L 31 24 L 32 24 L 33 24 L 34 25 L 35 25 L 36 25 L 37 25 L 38 25 L 39 26 L 40 26 L 41 26 L 42 26 L 43 26 L 44 27 L 45 27 L 46 27 L 47 27 L 48 27 L 49 28 L 50 28 L 51 28 L 52 28 L 53 28 L 54 29 L 55 29 L 56 29 L 57 29 L 58 29 L 59 30 L 60 30 L 61 30 L 62 30 L 63 31 L 64 31 L 65 31 L 66 31 L 67 31 L 68 32 L 69 32 L 70 32 L 71 32 L 72 33 L 73 33 L 74 33 L 75 34 L 76 34 L 77 34 L 78 35 L 79 35 L 80 35 L 81 36 L 82 36 L 83 37 L 84 38 L 85 38 L 86 39 L 87 39 L 88 40 L 89 41 L 90 41 L 91 42 L 92 43 L 93 43 L 94 44 L 95 45 L 96 45 L 97 46 L 98 47 L 99 47 L 100 48 L 101 49 L 102 49 L 103 49 L 104 50 L 105 51 L 106 51 L 107 51 L 108 52 L 109 52 L 110 53 L 111 53 L 112 54 L 113 54 L 114 54 L 115 55 L 116 55 L 117 55 L 118 56 L 119 56 L 120 56 L 121 57 L 122 57 L 123 57 L 124 57 L 125 58 L 126 58 L 127 58 L 128 58 L 129 58 L 130 59 L 131 59 L 132 59 L 133 59 L 134 59 L 135 59 L 136 60 L 137 60 L 138 60 L 139 60 L 140 60 L 141 60 L 142 60 L 143 61 L 144 61 L 145 61 L 146 61 L 147 61 L 148 62 L 149 62 L 150 62 L 151 62 L 152 62 L 153 62 L 154 62 L 155 62 L 156 63 L 155 64 L 154 64 L 153 64 L 152 64 L 151 64 L 150 64 L 149 65 L 148 65 L 147 65 L 146 65 L 145 65 L 144 65 L 143 66 L 142 66 L 141 66 L 140 66 L 139 66 L 138 66 L 137 67 L 136 67 L 135 67 L 134 67 L 133 68 L 132 68 L 131 68 L 130 68 L 129 69 L 128 69 L 127 69 L 126 69 L 125 70 L 124 70 L 123 70 L 122 71 L 121 71 L 120 71 L 119 72 L 118 72 L 117 72 L 116 73 L 115 73 L 114 74 L 113 74 L 112 74 L 111 75 L 110 75 L 109 76 L 108 76 L 107 77 L 106 77 L 105 78 L 104 79 L 103 80 L 102 80 L 101 81 L 100 82 L 99 82 L 98 83 L 97 84 L 96 84 L 95 85 L 94 86 L 93 87 L 92 87 L 91 88 L 90 89 L 89 90 L 88 90 L 87 91 L 86 92 L 85 92 L 84 93 L 83 94 L 82 94 L 81 95 L 80 95 L 79 96 L 78 96 L 77 97 L 76 97 L 75 98 L 74 98 L 73 98 L 72 99 L 71 99 L 70 99 L 69 100 L 68 100 L 67 100 L 66 101 L 65 101 L 64 101 L 63 101 L 62 101 L 61 102 L 60 102 L 59 102 L 58 102 L 57 102 L 56 103 L 55 103 L 54 103 L 53 103 L 52 104 L 51 104 L 50 104 L 49 104 L 48 104 L 47 105 L 46 105 L 45 105 L 44 105 L 43 106 L 42 106 L 41 106 L 40 106 L 39 107 L 38 107 L 37 107 L 36 107 L 35 107 L 34 108 L 33 108 L 32 108 L 31 108 L 30 108 L 29 109 L 28 109 L 27 109 L 26 109 L 25 109 L 24 110 L 23 110 L 22 110 L 21 110 L 20 110 L 19 111 L 18 111 L 17 111 L 16 111 L 15 111 L 14 112 L 13 112 L 12 112 L 11 112 L 10 112 L 11 112 L 12 112 L 13 112 L 14 112 L 15 112 L 16 112 L 17 112 L 18 112 L 19 112 L 20 112 L 21 112 L 22 112 L 23 112 L 24 112 L 25 112 L 26 112 L 27 112 L 28 112 L 29 112 L 30 112 L 31 112 L 32 112 L 33 112 L 34 112 L 35 112 L 36 112 L 37 112 L 38 112 L 39 112 L 40 111 L 41 111 L 42 111 L 43 111 L 44 111 L 45 111 L 46 111 L 47 111 L 48 111 L 49 111 L 50 111 L 51 111 L 52 111 L 53 111 L 54 111 L 55 111 L 56 111 L 57 111 L 58 111 L 59 111 L 60 111 L 61 111 L 62 111 L 63 111 L 64 111 L 65 111 L 66 111 L 67 111 L 68 111 L 69 110 L 70 110 L 71 110 L 72 110 L 73 110 L 74 110 L 75 110 L 76 110 L 77 110 L 78 110 L 79 110 L 80 110 L 81 110 L 82 110 L 83 109 L 84 109 L 85 109 L 86 109 L 87 109 L 88 109 L 89 108 L 90 108 L 91 107 L 92 107 L 93 107 L 94 106 L 95 105 L 96 105 L 97 104 L 98 104 L 99 103 L 100 102 L 101 101 L 102 101 L 103 100 L 104 99 L 105 98 L 106 98 L 107 97 L 108 96 L 109 95 L 110 94 L 111 93 L 112 92 L 113 91 L 114 91 L 115 90 L 116 89 L 117 88 L 118 87 L 119 86 L 120 85 L 121 85 L 122 84 L 123 83 L 124 82 L 125 82 L 126 81 L 127 80 L 128 80 L 129 79 L 130 78 L 131 78 L 132 77 L 133 77 L 134 76 L 135 76 L 136 75 L 137 75 L 138 74 L 139 74 L 140 73 L 141 73 L 142 72 L 143 72 L 144 72 L 145 71 L 146 71 L 147 71 L 148 70 L 149 70 L 150 70 L 151 69 L 152 69 L 153 69 L 154 69 L 155 68 L 156 68 L 157 68 L 158 68 L 159 68 L 160 68 L 161 68 L 162 68 L 163 69 L 164 69 L 165 69 L 166 69 L 167 69 L 168 69 L 169 69 L 170 70 L 171 70 L 172 70 L 173 70 L 174 70 L 175 70 L 176 70 L 177 70 L 178 71 L 179 71 L 180 71 L 181 71 L 182 71 L 183 71 L 184 71 L 185 72 L 186 72 L 187 72 L 188 72 L 189 72 L 190 72 L 191 72 L 192 72 L 193 72 L 194 73 L 195 73 L 196 73 L 197 73 L 198 73 L 199 73 L 200 73 L 201 73 L 202 74 L 203 74 L 204 74 L 205 74 L 206 74 L 207 74 L 208 74 L 209 74 L 210 74 L 211 75 L 212 74 L 213 74 L 213 73 L 214 72 L 214 71 L 214 70 L 214 69 L 214 68 L 214 67 L 214 66 L 214 65 L 214 64 L 214 63 L 214 62 L 214 61 L 214 60 L 214 59 L 214 58 L 214 57 L 213 56 L 213 55 L 212 55 L 211 55 L 210 56 L 209 56 L 208 56 L 207 56 L 206 56 L 205 56 L 204 56 L 203 56 L 202 57 L 201 57 L 200 57 L 199 57 L 198 57 L 197 57 L 196 57 L 195 57 L 194 57 L 193 57 L 192 57 L 191 58 L 190 58 L 189 58 L 188 58 L 187 58 L 186 58 L 185 58 L 184 59 L 183 59 L 182 59 L 181 59 L 180 59 L 179 59 L 178 59 L 177 59 L 176 59 L 175 59 L 174 60 L 173 60 L 172 60 L 171 60 L 170 60 L 169 60 L 168 61 L 167 61 L 166 61 L 165 61 L 164 61 L 163 61 L 162 61 L 161 61 L 160 61 L 159 60 L 158 61 L 157 60 L 156 60 L 155 60 L 154 60 L 153 60 L 152 59 L 151 59 L 150 59 L 149 58 L 148 58 L 147 58 L 146 57 L 145 57 L 144 57 L 143 56 L 142 56 L 141 55 L 140 55 L 139 55 L 138 54 L 137 54 L 136 53 L 135 53 L 134 52 L 133 52 L 132 51 L 131 51 L 130 50 L 129 50 L 128 49 L 127 48 L 126 48 L 125 47 L 124 47 L 123 46 L 122 45 L 121 45 L 120 44 L 119 43 L 118 43 L 117 42 L 116 41 L 115 40 L 114 39 L 113 39 L 112 38 L 111 37 L 110 37 L 109 36 L 108 35 L 107 34 L 106 33 L 105 33 L 104 32 L 103 31 L 102 30 L 101 30 L 100 29 L 99 29 L 98 28 L 97 27 L 96 27 L 95 26 L 94 26 L 93 25 L 92 25 L 91 25 L 90 24 L 89 24 L 88 24 L 87 24 L 86 24 L 85 23 L 84 23 L 83 23 L 82 23 L 81 23 L 80 23 L 79 23 L 78 23 L 77 23 L 76 23 L 75 23 L 74 23 L 73 23 L 72 23 L 71 23 L 70 23 L 69 23 L 68 22 L 67 22 L 66 22 L 65 22 L 64 22 L 63 22 L 62 22 L 61 22 L 60 22 L 59 22 L 58 22 L 57 22 L 56 22 L 55 22 L 54 22 L 53 22 L 52 22 L 51 22 L 50 22 L 49 22 L 48 22 L 47 22 L 46 22 L 45 22 L 44 22 L 43 22 L 42 22 L 41 21 L 40 21 L 39 21 L 38 21 L 37 21 L 36 21 L 35 21 L 34 21 L 33 21 L 32 21 L 31 21 L 30 21 L 29 21 L 28 21 L 27 21 L 26 21 L 25 21 L 24 21 L 23 21 L 22 21 L 21 21 L 20 21 L 19 21 L 18 21 L 17 21 L 16 21 L 15 21 L 14 21 L 13 21 Z" fill="#16a34a" fillRule="evenodd"/>
          </svg>
          <span className="onboard-logo-text">Rally</span>
        </div>

        <div className="onboard-content">
          <div className="onboard-visual" key={step}>
            {slide.visual}
          </div>
          <h1 className="onboard-title">{slide.title}</h1>
          <p className="onboard-subtitle">{slide.subtitle}</p>
        </div>

        <div className="onboard-actions">
          <div className="onboard-dots">
            {onboardScreens.map((s, i) => (
              <span key={s} className={`onboard-dot ${i === currentIdx ? 'active' : ''}`} />
            ))}
          </div>
          <button className="btn btn-join-free btn-large onboard-btn" onClick={() => setStep('email')}>
            Join for free
          </button>
          <button className="btn-link onboard-login" onClick={() => setStep('email')}>Log in</button>
        </div>
      </div>
    )
  }

    // --- Email Screen ---
  if (step === 'email') {
    async function handleSendOtp(e: React.FormEvent) {
      e.preventDefault()
      if (!email.trim() || otpSending) return
      setOtpError(null)
      setOtpSending(true)
      const result = await sendOtp(email.trim().toLowerCase())
      setOtpSending(false)
      if (result.ok) {
        setResendCountdown(60)
        setStep('verify')
      } else {
        const err = (result.error ?? '').toLowerCase()
        const isRateLimit = err.includes('rate limit') || err.includes('once every 60 seconds') || result.status === 429
        setOtpError(
          isRateLimit
            ? 'Too many attempts. Please wait a few minutes before trying again.'
            : 'Could not send verification code. Please try again.'
        )
      }
    }

    return (
      <div className="onboard-screen signup-screen">
        <div className="signup-content">
          <div className="signup-header">
            <h1 className="signup-title">What's your email?</h1>
            <p className="signup-desc">We'll send you a verification code to sign in.</p>
          </div>

          <div className="auth-card">
            <form onSubmit={handleSendOtp} className="signup-form">
              <label className="field auth-field">
                <span className="field-label">Email address</span>
                <input
                  className="auth-input"
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setOtpError(null) }}
                  placeholder="you@example.com"
                  autoFocus
                  autoComplete="email"
                  inputMode="email"
                />
              </label>

              {otpError && (
                <p className="otp-error">{otpError}</p>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-large signup-cta auth-cta"
                disabled={!email.trim() || otpSending}
              >
                {otpSending ? 'Sending...' : 'Continue'}
              </button>
            </form>

            <p className="signup-social-proof auth-helper-copy">
              No password needed. We’ll just verify your email.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // --- OTP Verification Screen ---
  if (step === 'verify') {
    async function handleVerifyOtp(e: React.FormEvent) {
      e.preventDefault()
      if (otpCode.length !== 6 || otpVerifying) return
      setOtpError(null)
      setOtpVerifying(true)
      const result = await verifyOtp(email.trim().toLowerCase(), otpCode)
      setOtpVerifying(false)
      if (result.ok && result.userId) {
        setAuthUserId(result.userId)
        // Check if this user already has a profile in the lobby
        const existing = await fetchExistingPlayer(result.userId)
        if (existing) {
          const p = createProfile(existing.name, existing.county, {
            email: email.trim().toLowerCase(),
            authId: result.userId,
          })
          onRegistered(p)
          return
        }
        setStep('signup')
      } else {
        setOtpError('Invalid or expired code. Please try again.')
        setOtpCode('')
      }
    }

    async function handleResend() {
      if (resendCountdown > 0) return
      setOtpError(null)
      const result = await sendOtp(email.trim().toLowerCase())
      if (result.ok) {
        setResendCountdown(60)
      } else {
        setOtpError('Could not resend code. Please wait a moment.')
      }
    }

    return (
      <div className="onboard-screen signup-screen">
        <div className="signup-content">
          <div className="signup-header">
            <h1 className="signup-title">Check your email</h1>
            <p className="signup-desc">
              Enter the 6-digit code sent to <strong>{email}</strong>
            </p>
          </div>

          <div className="auth-card">
            <form onSubmit={handleVerifyOtp} className="signup-form">
              <label className="field auth-field">
                <span className="field-label">Verification code</span>
                <input
                  className="auth-input auth-input--otp"
                  type="text"
                  value={otpCode}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                    setOtpCode(val)
                    setOtpError(null)
                  }}
                  placeholder="000000"
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                />
              </label>

              {otpError && (
                <p className="otp-error">{otpError}</p>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-large signup-cta auth-cta"
                disabled={otpCode.length !== 6 || otpVerifying}
              >
                {otpVerifying ? 'Verifying...' : 'Verify'}
              </button>
            </form>

            <div className="otp-actions">
              <button
                className="btn-link"
                onClick={handleResend}
                disabled={resendCountdown > 0}
              >
                {resendCountdown > 0 ? `Resend code (${resendCountdown}s)` : 'Resend code'}
              </button>
              <button className="btn-link" onClick={() => { setStep('email'); setOtpCode(''); setOtpError(null) }}>
                Use a different email
              </button>
            </div>
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

  // --- Step: Skill Level & Gender ---
  if (step === 'skill-gender') {
    return (
      <div className="onboard-screen signup-screen">
        <div className="signup-content">
          <div className="signup-header">
            <h1 className="signup-title">About your game</h1>
            <p className="signup-desc">Helps us match you with the right players</p>
          </div>

          <div className="skill-gender-form">
            <div className="field">
              <span className="field-label">Skill level</span>
              <div className="skill-options">
                {([
                  { value: 'beginner' as SkillLevel, label: 'Beginner', desc: 'Learning strokes, developing consistency' },
                  { value: 'intermediate' as SkillLevel, label: 'Intermediate', desc: 'Consistent serve, comfortable rallying, plays regularly (NTRP 3.0\u20133.5)' },
                  { value: 'advanced' as SkillLevel, label: 'Advanced', desc: 'Strong all-court game, plays competitively (NTRP 4.0+)' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    className={`skill-option ${skillLevel === opt.value ? 'selected' : ''}`}
                    onClick={() => setSkillLevel(opt.value)}
                  >
                    <span className="skill-option-label">{opt.label}</span>
                    <span className="skill-option-desc">{opt.desc}</span>
                  </button>
                ))}
              </div>
              <p className="skill-reassurance" style={{ fontSize: 'var(--font-body-sm, 13px)', color: 'var(--color-text-muted)', marginTop: '8px' }}>
                Your rating will adjust automatically after a few matches.
              </p>
            </div>

            <div className="field">
              <span className="field-label">Gender</span>
              <div className="gender-options">
                {([
                  { value: 'male' as Gender, label: 'Male' },
                  { value: 'female' as Gender, label: 'Female' },
                  { value: 'other' as Gender, label: 'Other' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    className={`gender-option ${gender === opt.value ? 'selected' : ''}`}
                    onClick={() => setGender(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="availability-actions">
            <button
              className="btn btn-primary btn-large"
              onClick={() => setStep('availability')}
              disabled={!skillLevel || !gender}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --- Step: Confirmed ---
  if (step === 'confirmed') {
    return (
      <div className="onboard-screen">
        <div className="onboard-content confirmed-content">
          <div className="confirmed-check">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="24" fill="var(--color-positive-primary)" className="confirmed-circle" />
              <path d="M14 24l7 7 13-13" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="confirmed-path" />
            </svg>
          </div>
          <h1 className="onboard-title">You're in!</h1>
          <p className="onboard-subtitle">Rally can now schedule matches for you.</p>
          <div className="confirmed-ball">🎾</div>
        </div>
      </div>
    )
  }

  // --- Step: Availability ---
  const hasSlots = detailedSlots.length > 0
  const capDurationLabels: Record<number, string> = { 1: '~5 weeks', 2: '~3 weeks', 3: '~2 weeks' }
  const slotCount = detailedSlots.length

  return (
    <div className="onboard-screen avail-screen">
      <div className="signup-content">
        {/* Motivational header */}
        <div className="avail-header">
          <h1 className="signup-title">When can you play?</h1>
          <p className="avail-value-prop">
            More times = more opponents matched.
            <br />
            <span className="avail-value-highlight">We handle all the scheduling.</span>
          </p>
        </div>

        {/* Mode toggle -- Custom times is primary/default */}
        <div className="avail-mode-toggle">
          <button
            className={`avail-mode-btn ${detailedMode ? 'active' : ''}`}
            onClick={() => setDetailedMode(true)}
          >
            Custom times
          </button>
          <button
            className={`avail-mode-btn ${!detailedMode ? 'active' : ''}`}
            onClick={() => setDetailedMode(false)}
          >
            Quick presets
          </button>
        </div>

        <div className="availability-picker">
          {!detailedMode ? (
            <>
              <div className="quick-slots-v2">
                <p className="quick-presets-hint">Tap to add common time blocks</p>
                <button
                  className={`quick-slot-v2 quick-slot-v2--wide ${selectedQuick.has(0) ? 'selected' : ''}`}
                  onClick={() => toggleQuickSlot(0)}
                >
                  <span className="quick-slot-v2-check">{selectedQuick.has(0) ? '\u2713' : ''}</span>
                  <span className="quick-slot-v2-label">{QUICK_SLOTS[0].label}</span>
                  <span className="quick-slot-v2-time">Mon-Fri 6-9pm</span>
                </button>
                <div className="quick-slots-grid">
                  {QUICK_SLOTS.slice(1).map((slot, idx) => (
                    <button
                      key={idx + 1}
                      className={`quick-slot-v2 ${selectedQuick.has(idx + 1) ? 'selected' : ''}`}
                      onClick={() => toggleQuickSlot(idx + 1)}
                    >
                      <span className="quick-slot-v2-check">{selectedQuick.has(idx + 1) ? '\u2713' : ''}</span>
                      <span className="quick-slot-v2-label">{slot.label.replace('Saturday ', 'Sat ').replace('Sunday ', 'Sun ')}</span>
                    </button>
                  ))}
                </div>
              </div>

              {detailedSlots.length > 0 && (
                <div className="quick-presets-slots-preview">
                  <div className="quick-presets-slots-label">{detailedSlots.length} time slot{detailedSlots.length !== 1 ? 's' : ''} added</div>
                  <ul className="detailed-slot-list">
                    {detailedSlots.map((s, i) => (
                      <li key={i} className="detailed-slot-item">
                        <span>{DAYS.find(d => d.key === s.day)?.label} {formatHourCompact(s.startHour)}-{formatHourCompact(s.endHour)}</span>
                        <button className="btn-icon" onClick={() => removeDetailedSlot(i)}>{'\u2715'}</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <>
              {detailedSlots.length > 0 && (
                <ul className="detailed-slot-list">
                  {detailedSlots.map((s, i) => (
                    <li key={i} className="detailed-slot-item">
                      <span>{DAYS.find(d => d.key === s.day)?.label} {formatHourCompact(s.startHour)}–{formatHourCompact(s.endHour)}</span>
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
                  {START_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <span>-</span>
                <select value={addingEnd} onChange={e => setAddingEnd(Number(e.target.value))}>
                  {END_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <button className="btn" onClick={addDetailedSlot} disabled={!addingDay || addingStart >= addingEnd}>
                  Add
                </button>
              </div>
            </>
          )}
        </div>

        {/* Live feedback — matchable count + social proof nudge */}
        <div className={`avail-feedback ${hasSlots ? 'visible' : ''}`}>
          {matchableCount > 0 && (
            <div className="avail-feedback-row">
              <span className="avail-feedback-count">{matchableCount}</span>
              <span className="avail-feedback-label">players match your times</span>
            </div>
          )}
          {hasSlots && slotCount < 3 && (
            <p className="avail-nudge">Players who pick 3+ slots get matched 2× faster</p>
          )}
          {matchableCount >= 5 && (
            <p className="avail-nudge avail-nudge--positive">Enough for a full tournament group!</p>
          )}
        </div>

        {/* Compact weekly cap — inline row */}
        <div className="avail-cap-row">
          <span className="avail-cap-label">Matches / week</span>
          <div className="avail-cap-pills">
            {([1, 2, 3] as const).map(cap => (
              <button
                key={cap}
                className={`avail-cap-pill ${weeklyCap === cap ? 'selected' : ''}`}
                onClick={() => setWeeklyCap(cap)}
              >
                {cap}
              </button>
            ))}
          </div>
          <span className="avail-cap-duration">{capDurationLabels[weeklyCap]}</span>
        </div>

        <div className="availability-actions">
          <button
            className="btn btn-primary btn-large"
            onClick={() => handleFinish(false)}
            disabled={!hasSlots}
          >
            Start Competing
          </button>
        </div>
      </div>
    </div>
  )
}

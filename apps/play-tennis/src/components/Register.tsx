import { formatHourCompact } from '../dateUtils'
import { useState, useEffect, useRef } from 'react'
import { createProfile, saveAvailability, getLobbyByCounty, getAvailability } from '../store'
import { PlayerProfile, AvailabilitySlot, DayOfWeek, SkillLevel, Gender } from '../types'
import { searchCounties } from '../counties'
import { sendOtp, verifyOtp, getSession, onAuthStateChange } from '../supabase'
import { apiFetchProfile, apiSaveProfile } from '../api'

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

type Step = 'onboard-1' | 'onboard-2' | 'onboard-3' | 'email' | 'verify' | 'welcome-back' | 'signup' | 'skill-gender' | 'availability' | 'confirmed'

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

  // Shared helper: try to restore a returning user's profile from the server
  const tryRestoreProfile = async (userId: string, userEmail: string) => {
    try {
      const serverProfile = await apiFetchProfile()
      if (serverProfile) {
        const restored: PlayerProfile = {
          id: serverProfile.id,
          authId: serverProfile.authId,
          email: userEmail,
          name: serverProfile.name,
          county: serverProfile.county,
          skillLevel: (serverProfile.skillLevel as SkillLevel) ?? undefined,
          gender: (serverProfile.gender as Gender) ?? undefined,
          weeklyCap: (serverProfile.weeklyCap as PlayerProfile['weeklyCap']) ?? 2,
          createdAt: serverProfile.createdAt,
        }
        localStorage.setItem('play-tennis-profile', JSON.stringify(restored))
        setCreatedProfile(restored)
        setStep('welcome-back')
        setTimeout(() => onRegistered(restored), 1500)
        return true
      }
    } catch {
      // Server unreachable — fall through to signup form
    }
    return false
  }

  // Check for existing session on mount + listen for magic link auth
  useEffect(() => {
    // Check if already authenticated (e.g. page refresh with valid session)
    getSession().then(async session => {
      if (session) {
        setAuthUserId(session.userId)
        setEmail(session.email)
        const restored = await tryRestoreProfile(session.userId, session.email)
        if (!restored) setStep('signup')
      }
    })

    // Listen for magic link redirect (tokens arrive via URL hash)
    const unsub = onAuthStateChange(async (event, userId, userEmail) => {
      if (event === 'SIGNED_IN' && userId) {
        setAuthUserId(userId)
        if (userEmail) setEmail(userEmail)
        const restored = await tryRestoreProfile(userId, userEmail ?? '')
        if (!restored) setStep('signup')
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
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

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

    // Save full profile to server so returning users can be restored
    apiSaveProfile({
      playerName: fullName,
      county,
      email: email || undefined,
      skillLevel: skillLevel || undefined,
      gender: gender || undefined,
      weeklyCap,
    }).catch(() => { /* offline — profile will be saved on next lobby join */ })

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


  // --- Onboarding Screens ---
  const isOnboarding = step === 'onboard-1' || step === 'onboard-2' || step === 'onboard-3'
  const onboardIdx = step === 'onboard-1' ? 0 : step === 'onboard-2' ? 1 : step === 'onboard-3' ? 2 : -1

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const screens: Step[] = ['onboard-1', 'onboard-2', 'onboard-3']
      if (dx < 0 && onboardIdx < 2) setStep(screens[onboardIdx + 1])
      else if (dx > 0 && onboardIdx > 0) setStep(screens[onboardIdx - 1])
    }
  }

  if (isOnboarding) {
    const titles = [
      'Scheduling tennis shouldn\'t take 20 messages',
      'Matches are scheduled automatically',
      'Compete in your local ladder',
    ]
    const subtitles = [
      'Rally handles the back-and-forth for you.',
      'Set your availability. Rally does the rest.',
      'Play matches. Climb the rankings.',
    ]

    const visuals = [
      <div key="chat" className="onboard-chat onboard-chat-chaotic">
        <div className="onboard-chat-bubble onboard-chat-out">Can you play Tuesday?</div>
        <div className="onboard-chat-bubble onboard-chat-in">Maybe Wednesday?</div>
        <div className="onboard-chat-bubble onboard-chat-out">Next week?</div>
        <div className="onboard-chat-bubble onboard-chat-in">Let me check...</div>
      </div>,
      <div key="match" className="onboard-match-visual">
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
      </div>,
      <div key="lb" className="onboard-leaderboard">
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
      </div>,
    ]

    return (
      <div
        className="onboard-screen"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="onboard-content">
          <div className="onboard-visual" key={step}>
            {visuals[onboardIdx]}
          </div>
          <h1 className="onboard-title">{titles[onboardIdx]}</h1>
          <p className="onboard-subtitle">{subtitles[onboardIdx]}</p>
        </div>

        <div className="onboard-actions">
          <div className="onboard-dots">
            {[0, 1, 2].map(i => (
              <span key={i} className={`onboard-dot ${i === onboardIdx ? 'active' : ''}`} />
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
        // Check if this is a returning user with a full profile on the server
        const restored = await tryRestoreProfile(result.userId, email.trim().toLowerCase())
        if (!restored) setStep('signup')
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
  // --- Welcome Back Screen (returning user) ---
  if (step === 'welcome-back') {
    const welcomeName = createdProfile?.name?.split(' ')[0] || 'back'
    return (
      <div className="onboard-screen">
        <div className="onboard-content confirmed-content">
          <div className="confirmed-check">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="24" fill="var(--color-positive-primary)" className="confirmed-circle" />
              <path d="M14 24l7 7 13-13" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="confirmed-path" />
            </svg>
          </div>
          <h1 className="onboard-title">Welcome back, {welcomeName}!</h1>
          <p className="onboard-subtitle">Good to see you again.</p>
          <div className="confirmed-ball">🎾</div>
        </div>
      </div>
    )
  }

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

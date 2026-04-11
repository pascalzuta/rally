import { formatHourCompact, titleCase } from '../dateUtils'
import { useState, useEffect, useRef } from 'react'
import { createProfile, saveAvailability, getLobbyByCounty, getAvailability } from '../store'
import { PlayerProfile, AvailabilitySlot, DayOfWeek, SkillLevel, Gender } from '../types'
import { searchCounties } from '../counties'
import { sendOtp, verifyOtp, savePlayerProfile, signInWithGoogle, isTestEmail } from '../supabase'
import { analytics } from '../analytics'
import { useAuth } from '../context/AuthContext'

interface Props {
  onRegistered: (profile: PlayerProfile) => void
  inviteCounty?: string | null
  onCancel?: () => void
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

const QUICK_SLOTS: { label: string; time: string; slots: AvailabilitySlot[] }[] = [
  { label: 'Weekday evenings', time: 'Mon–Fri 6–9pm', slots: [
    { day: 'monday', startHour: 18, endHour: 21 },
    { day: 'tuesday', startHour: 18, endHour: 21 },
    { day: 'wednesday', startHour: 18, endHour: 21 },
    { day: 'thursday', startHour: 18, endHour: 21 },
    { day: 'friday', startHour: 18, endHour: 21 },
  ]},
  { label: 'Weekend mornings', time: 'Sat–Sun 8am–12pm', slots: [
    { day: 'saturday', startHour: 8, endHour: 12 },
    { day: 'sunday', startHour: 8, endHour: 12 },
  ]},
  { label: 'Weekend afternoons', time: 'Sat–Sun 1–5pm', slots: [
    { day: 'saturday', startHour: 13, endHour: 17 },
    { day: 'sunday', startHour: 13, endHour: 17 },
  ]},
  { label: 'Weekday mornings', time: 'Mon–Fri 8am–12pm', slots: [
    { day: 'monday', startHour: 8, endHour: 12 },
    { day: 'tuesday', startHour: 8, endHour: 12 },
    { day: 'wednesday', startHour: 8, endHour: 12 },
    { day: 'thursday', startHour: 8, endHour: 12 },
    { day: 'friday', startHour: 8, endHour: 12 },
  ]},
  { label: 'Weekday afternoons', time: 'Mon–Fri 1–5pm', slots: [
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

type Step = 'email' | 'verify' | 'welcome-back' | 'signup' | 'skill-gender' | 'availability' | 'confirmed'

// Persist auth flow progress so the step survives page reloads / component remounts
const AUTH_FLOW_KEY = 'rally-auth-flow'

function saveAuthFlow(data: { step: string; email?: string; authUserId?: string }) {
  try { sessionStorage.setItem(AUTH_FLOW_KEY, JSON.stringify(data)) } catch { /* ignore */ }
}

function loadAuthFlow(): { step: string; email?: string; authUserId?: string } | null {
  try {
    const raw = sessionStorage.getItem(AUTH_FLOW_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function clearAuthFlow() {
  try { sessionStorage.removeItem(AUTH_FLOW_KEY) } catch { /* ignore */ }
}

export default function Register({ onRegistered, inviteCounty, onCancel }: Props) {
  // Start at email step. Only restore mid-flow state if the page was reloaded
  // (sessionStorage persists across reloads but not across tabs).
  // We clear stale flow state on mount to prevent skipping to signup after a
  // previously abandoned attempt.
  const [step, setStepRaw] = useState<Step>(() => {
    const flow = loadAuthFlow()
    if (flow) {
      // Only restore verify step (user was mid-OTP). For signup or later steps,
      // start fresh — the user explicitly clicked "Sign up" again.
      if (flow.step === 'verify') {
        return 'verify'
      }
      // Clear stale state from previous abandoned flows
      clearAuthFlow()
    }
    return 'email'
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
      } else {
        // Backed past Register's history — return to home page
        onCancel?.()
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auth state — restore email/authUserId from sessionStorage if recovering from remount
  const savedFlow = loadAuthFlow()
  const [email, setEmail] = useState(savedFlow?.email ?? '')
  const [otpCode, setOtpCode] = useState('')
  const [otpSending, setOtpSending] = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [otpError, setOtpError] = useState<string | null>(null)
  const [resendCountdown, setResendCountdown] = useState(0)
  const [authUserId, setAuthUserId] = useState<string | null>(savedFlow?.authUserId ?? null)

  // React to auth state from AuthContext — handles magic link, OTP verify, and page refresh
  const { user: authUser, profile: authProfile, loading: authLoading } = useAuth()
  useEffect(() => {
    if (!authUser) return
    // Wait for AuthContext to finish loading — profile may still be fetching.
    // Without this, Google OAuth returning users get shown the signup form
    // because authUser is set before authProfile is resolved.
    if (authLoading) return
    if (authProfile) {
      // Returning user — AuthContext already restored profile, App will navigate away
      return
    }
    // Authenticated but no profile in DB — advance to signup form
    if (step === 'email' || step === 'verify') {
      const userEmail = authUser.email ?? ''
      setAuthUserId(authUser.id)
      setEmail(prev => prev || userEmail)
      saveAuthFlow({ step: 'signup', email: userEmail, authUserId: authUser.id })
      setStep('signup')
    }
  }, [authUser?.id, authProfile?.id, authLoading]) // eslint-disable-line react-hooks/exhaustive-deps

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
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const [skillLevel, setSkillLevel] = useState<SkillLevel | ''>('')
  const [gender, setGender] = useState<Gender | ''>('')

  const [selectedQuick, setSelectedQuick] = useState<Set<number>>(() => new Set([0]))
  const [showCustomTimes, setShowCustomTimes] = useState(false)
  const [detailedSlots, setDetailedSlots] = useState<AvailabilitySlot[]>(() => [...QUICK_SLOTS[0].slots])
  const [addingDay, setAddingDay] = useState<DayOfWeek | ''>('')
  const [addingStart, setAddingStart] = useState(18)
  const [addingEnd, setAddingEnd] = useState(21)
  const [weeklyCap, setWeeklyCap] = useState<1 | 2 | 3>(2)
  const [matchableCount, setMatchableCount] = useState(0)

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

  // Auto-verify test emails (skip OTP entry entirely)
  useEffect(() => {
    if (step !== 'verify' || !isTestEmail(email) || otpVerifying || authUserId) return
    setOtpVerifying(true)
    setOtpCode('000000')
    verifyOtp(email.trim().toLowerCase(), '000000').then(result => {
      setOtpVerifying(false)
      if (result.ok && result.userId) {
        setAuthUserId(result.userId)
        analytics.track('Lead')
      } else {
        setOtpError(result.error || 'Test auth failed')
      }
    })
  }, [step, email]) // eslint-disable-line react-hooks/exhaustive-deps

  const [createdProfile, setCreatedProfile] = useState<PlayerProfile | null>(null)

  async function handleFinish(skip: boolean) {
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
        await saveAvailability(p.id, slots, county, weeklyCap)
      }
    }

    // Save full profile to Supabase so returning users can be restored.
    // Awaited so the upsert completes while the auth session is still fresh —
    // firing and forgetting risks the session being torn down mid-request, and
    // the RLS check (auth_id = auth.uid()) would then silently reject the row.
    if (authUserId) {
      try {
        const ok = await savePlayerProfile(authUserId, {
          name: fullName,
          county,
          email: email || undefined,
          skillLevel: skillLevel || undefined,
          gender: gender || undefined,
          weeklyCap,
        })
        if (!ok) {
          console.warn('[Rally] savePlayerProfile returned false — players row was NOT written for', authUserId)
        }
      } catch (err) {
        console.warn('[Rally] savePlayerProfile threw:', err)
      }
    } else {
      console.warn('[Rally] handleFinish: no authUserId — skipping savePlayerProfile. Player will only exist locally.')
    }

    setCreatedProfile(p)
    clearAuthFlow()
    setStep('confirmed')
    analytics.track('CompleteRegistration', { userId: p.id, properties: { county: p.county, skillLevel: p.skillLevel, gender: p.gender } })
    analytics.identify(p.id, { county: p.county, skill_level: p.skillLevel, gender: p.gender })
    setTimeout(() => onRegistered(p), 1500)
  }

  // Social proof number (deterministic based on county)
  function getPlayerCount(c: string): number {
    if (!c) return 0
    let hash = 0
    for (let i = 0; i < c.length; i++) hash = ((hash << 5) - hash + c.charCodeAt(i)) | 0
    return 80 + Math.abs(hash % 400)
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
        if (result.autoVerified) {
          // Test email: session already established, skip OTP screen
          // AuthContext will fire SIGNED_IN → profile check → land on signup step
          return
        }
        setResendCountdown(60)
        saveAuthFlow({ step: 'verify', email: email.trim().toLowerCase() })
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
            <h1 className="signup-title">Join Rally</h1>
            <p className="signup-desc">Find local opponents and let us handle the scheduling. Join 2,400+ active players on Rally for free.</p>
          </div>

          <div className="auth-card">
            {/* Social login first — Strava pattern: lowest friction path on top */}
            <button
              type="button"
              className="sh-btn-signup sh-btn-google"
              onClick={() => signInWithGoogle()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Sign Up with Google
            </button>

            <div className="auth-divider">
              <span className="auth-divider-line" />
              <span className="auth-divider-text">or</span>
              <span className="auth-divider-line" />
            </div>

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
                {otpSending ? 'Sending...' : 'Sign Up with Email'}
              </button>
            </form>

            <p className="signup-social-proof auth-helper-copy">
              No password. No spam. We only email you about matches.
            </p>

            <p className="auth-terms">
              By signing up, you agree to Rally's <a href="/support/">Terms of Service</a> and <a href="/support/">Privacy Policy</a>.
            </p>

            <p className="auth-switch">
              Already a member? <a href="/login" className="sh-link">Log In</a>
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
      if (otpCode.length < 6 || otpVerifying) return
      setOtpError(null)
      setOtpVerifying(true)
      const result = await verifyOtp(email.trim().toLowerCase(), otpCode)
      setOtpVerifying(false)
      if (result.ok && result.userId) {
        setAuthUserId(result.userId)
        // AuthContext's onAuthStateChange (SIGNED_IN) will fetch the profile and
        // update state — the useEffect above advances the step accordingly
        // Fire analytics Lead event optimistically (new user path)
        analytics.track('Lead')
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
              We sent a sign-in link to <strong>{email}</strong>. Click it to continue.
            </p>
            <p className="signup-desc" style={{ marginTop: 8, opacity: 0.7, fontSize: '0.9em' }}>
              If you received a numeric code instead, enter it below.
            </p>
          </div>

          <div className="auth-card">
            <form onSubmit={handleVerifyOtp} className="signup-form">
              <label className="field auth-field">
                <span className="field-label">Code (optional)</span>
                <input
                  className="auth-input auth-input--otp"
                  type="text"
                  value={otpCode}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 8)
                    setOtpCode(val)
                    setOtpError(null)
                  }}
                  placeholder="12345678"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                />
              </label>

              {otpError && (
                <p className="otp-error">{otpError}</p>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-large signup-cta auth-cta"
                disabled={otpCode.length < 6 || otpVerifying}
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
                <input type="text" value={titleCase(county)} readOnly />
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
              <span className="field-hint">We'll match you with players in your county.</span>
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
              <p className="skill-reassurance">
                Not sure? Pick whatever feels closest — your rating adjusts after a few matches.
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
          <p className="onboard-subtitle">Next: join your county's tournament and we'll auto-schedule your matches.</p>
          <div className="confirmed-ball">🎾</div>
        </div>
      </div>
    )
  }

  // --- Step: Availability ---
  const hasSlots = detailedSlots.length > 0
  const slotGroupCount = selectedQuick.size + (detailedSlots.filter(s =>
    !QUICK_SLOTS.some(qs => qs.slots.some(qss => qss.day === s.day && qss.startHour === s.startHour && qss.endHour === s.endHour))
  ).length > 0 ? 1 : 0)

  return (
    <div className="onboard-screen avail-screen">
      <div className="signup-content">
        {/* Header */}
        <div className="avail-header">
          <h1 className="signup-title">When do you want to play?</h1>
          <p className="avail-value-prop">
            Pick your times. <span className="avail-value-highlight">We handle the scheduling.</span>
          </p>
        </div>

        {/* Frequency question */}
        <div className="avail-frequency">
          <span className="avail-frequency-label">How often?</span>
          <div className="avail-frequency-options">
            {([
              { cap: 1 as const, label: '1–2×/week' },
              { cap: 2 as const, label: '2–3×/week' },
              { cap: 3 as const, label: '3+/week' },
            ]).map(opt => (
              <button
                key={opt.cap}
                className={`avail-frequency-pill ${weeklyCap === opt.cap ? 'selected' : ''}`}
                onClick={() => setWeeklyCap(opt.cap)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick-slot chips — primary input */}
        <div className="quick-slots-v2">
          {QUICK_SLOTS.map((qs, idx) => (
            <button
              key={idx}
              className={`quick-slot-v2 ${selectedQuick.has(idx) ? 'selected' : ''}`}
              onClick={() => toggleQuickSlot(idx)}
            >
              <span className="quick-slot-v2-check">{selectedQuick.has(idx) ? '\u2713' : ''}</span>
              <span className="quick-slot-v2-label">{qs.label}</span>
              <span className="quick-slot-v2-time">{qs.time}</span>
            </button>
          ))}
        </div>

        {/* Progressive disclosure — custom times */}
        {!showCustomTimes ? (
          <button className="avail-add-custom-link" onClick={() => setShowCustomTimes(true)}>
            + Add specific times
          </button>
        ) : (
          <div className="avail-custom-section">
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
              <span>–</span>
              <select value={addingEnd} onChange={e => setAddingEnd(Number(e.target.value))}>
                {END_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <button className="btn btn-small" onClick={addDetailedSlot} disabled={!addingDay || addingStart >= addingEnd}>
                Add
              </button>
            </div>
            {detailedSlots.filter(s =>
              !QUICK_SLOTS.some(qs => qs.slots.some(qss => qss.day === s.day && qss.startHour === s.startHour && qss.endHour === s.endHour))
            ).length > 0 && (
              <ul className="detailed-slot-list">
                {detailedSlots.filter(s =>
                  !QUICK_SLOTS.some(qs => qs.slots.some(qss => qss.day === s.day && qss.startHour === s.startHour && qss.endHour === s.endHour))
                ).map((s, i) => (
                  <li key={i} className="detailed-slot-item">
                    <span>{DAYS.find(d => d.key === s.day)?.label} {formatHourCompact(s.startHour)}–{formatHourCompact(s.endHour)}</span>
                    <button className="btn-icon" onClick={() => {
                      const idx = detailedSlots.findIndex(ds => ds.day === s.day && ds.startHour === s.startHour && ds.endHour === s.endHour)
                      if (idx >= 0) removeDetailedSlot(idx)
                    }}>✕</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Live feedback */}
        <div className={`avail-feedback ${hasSlots ? 'visible' : ''}`}>
          {hasSlots && (
            <p className="avail-threshold">
              {slotGroupCount >= 2
                ? `${detailedSlots.length} time slots — great coverage for auto-scheduling`
                : `${detailedSlots.length} time slot${detailedSlots.length !== 1 ? 's' : ''} — enough to start matching!`}
            </p>
          )}
          {matchableCount > 0 && (
            <div className="avail-feedback-row">
              <span className="avail-feedback-count">{matchableCount}</span>
              <span className="avail-feedback-label">player{matchableCount !== 1 ? 's' : ''} share your times</span>
            </div>
          )}
          {matchableCount >= 5 && (
            <p className="avail-nudge avail-nudge--positive">Enough for a full tournament group!</p>
          )}
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

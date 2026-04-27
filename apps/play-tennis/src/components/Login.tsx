import { useState, useEffect } from 'react'
import { sendOtp, verifyOtp, signInWithGoogle } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { analytics } from '../analytics'

interface Props {
  onSignUp: () => void
}

export default function Login({ onSignUp }: Props) {
  const [step, setStep] = useState<'email' | 'verify'>('email')
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendCountdown, setResendCountdown] = useState(0)
  const { user: authUser, profile: authProfile } = useAuth()

  // If user becomes authenticated with a profile, App will handle navigation
  useEffect(() => {
    if (authUser && authProfile) {
      // AuthContext restored profile — App will navigate away
    }
  }, [authUser, authProfile])

  useEffect(() => {
    if (resendCountdown <= 0) return
    const timer = setTimeout(() => setResendCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCountdown])

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || sending) return
    setError(null)
    setSending(true)
    const result = await sendOtp(email.trim().toLowerCase())
    setSending(false)
    if (result.ok) {
      if (result.autoVerified) {
        // Test email: session already established, AuthContext handles the rest
        return
      }
      setResendCountdown(60)
      setStep('verify')
    } else {
      const err = (result.error ?? '').toLowerCase()
      const isRateLimit = err.includes('rate limit') || err.includes('once every 60 seconds') || result.status === 429
      setError(
        isRateLimit
          ? 'Too many tries. Wait a minute and try again.'
          : "Couldn't send your code. Try again."
      )
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (otpCode.length < 6 || verifying) return
    setError(null)
    setVerifying(true)
    const result = await verifyOtp(email.trim().toLowerCase(), otpCode)
    setVerifying(false)
    if (result.ok) {
      analytics.track('Login')
    } else {
      setError("That code didn't work. Try again or resend.")
      setOtpCode('')
    }
  }

  async function handleResend() {
    if (resendCountdown > 0) return
    setError(null)
    const result = await sendOtp(email.trim().toLowerCase())
    if (result.ok) setResendCountdown(60)
    else setError("Couldn't resend. Wait a moment and try again.")
  }

  return (
    <div className="b-page">
      <nav className="b-page-nav">
        <div className="b-page-nav-logo">
          <img src="/rally-logo.svg" alt="Rally" />
        </div>
        <div className="b-page-nav-right">
          <a href="/blog/">Blog</a>
        </div>
      </nav>

      <div className="b-page-content">
        <div className="b-page-title-block">
          <h1 className="b-page-title">Log <em className="bg-em">in.</em></h1>
          <p className="b-page-subtitle">Good to see you again.</p>
        </div>

        <button
          type="button"
          className="b-btn-outline"
          onClick={() => signInWithGoogle()}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Log in with Google
        </button>

        <div className="b-or-divider">OR</div>

        {step === 'email' ? (
          <form onSubmit={handleSendOtp}>
            <div className="b-field">
              <label className="b-field-label" htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                className="b-input"
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(null) }}
                placeholder="you@example.com"
                autoFocus
                autoComplete="email"
                inputMode="email"
              />
            </div>

            {error && <p className="b-helper" style={{ color: 'var(--danger)' }}>{error}</p>}

            <button
              type="submit"
              className="b-btn-block"
              disabled={!email.trim() || sending}
              style={{ marginTop: 14 }}
            >
              {sending ? 'Sending…' : 'Continue'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify}>
            <p className="b-helper" style={{ marginBottom: 14 }}>
              We sent a sign-in code to <strong style={{ color: 'var(--ink)' }}>{email}</strong>
            </p>
            <div className="b-field">
              <label className="b-field-label" htmlFor="login-code">Verification code</label>
              <input
                id="login-code"
                className="b-input"
                type="text"
                value={otpCode}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 8)
                  setOtpCode(val)
                  setError(null)
                }}
                placeholder="1 2 3 4 5 6 7 8"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                autoFocus
                style={{ textAlign: 'center', letterSpacing: '0.4em', fontSize: 18 }}
              />
            </div>

            {error && <p className="b-helper" style={{ color: 'var(--danger)' }}>{error}</p>}

            <button
              type="submit"
              className="b-btn-block"
              disabled={otpCode.length < 6 || verifying}
              style={{ marginTop: 12 }}
            >
              {verifying ? 'Verifying…' : 'Log in'}
            </button>

            <button type="button" className="b-btn-text" style={{ color: 'var(--blue)', marginTop: 8 }} onClick={handleResend} disabled={resendCountdown > 0}>
              {resendCountdown > 0 ? `Resend code (${resendCountdown}s)` : 'Resend code'}
            </button>
            <button type="button" className="b-btn-text" style={{ color: 'var(--blue)' }} onClick={() => { setStep('email'); setOtpCode(''); setError(null) }}>
              Use a different email
            </button>
          </form>
        )}

        <p className="b-terms">
          By logging in, you agree to Rally's <a href="/support/">Terms of Service</a> and <a href="/support/">Privacy Policy</a>.
        </p>

        <p className="b-switch">
          New to Rally? <button onClick={onSignUp}>Sign up — it's free</button>
        </p>
      </div>
    </div>
  )
}

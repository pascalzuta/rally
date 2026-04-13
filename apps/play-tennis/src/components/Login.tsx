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
          ? 'Too many sign-in attempts. Try again in a few minutes.'
          : 'Could not send verification code. Please try again.'
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
      setError('Invalid or expired code. Please try again.')
      setOtpCode('')
    }
  }

  async function handleResend() {
    if (resendCountdown > 0) return
    setError(null)
    const result = await sendOtp(email.trim().toLowerCase())
    if (result.ok) setResendCountdown(60)
    else setError('Could not resend code. Please wait a moment.')
  }

  return (
    <div className="login-page">
      <div className="login-layout">
        {/* Form side */}
        <div className="login-form-side">
          <div className="login-form-wrapper">
            <div className="login-logo">
              <img height="40" src="/rally-logo.svg" alt="Rally" />
            </div>

            <h1 className="login-title">Log In</h1>
            <p className="login-subtitle">Welcome back to Rally.</p>

            {/* Google login — Strava pattern: social first */}
            <button
              type="button"
              className="sh-btn-signup sh-btn-google"
              onClick={() => signInWithGoogle()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Log In with Google
            </button>

            <div className="auth-divider">
              <span className="auth-divider-line" />
              <span className="auth-divider-text">or</span>
              <span className="auth-divider-line" />
            </div>

            {step === 'email' ? (
              <form onSubmit={handleSendOtp} className="signup-form">
                <label className="field auth-field">
                  <span className="field-label">Email address</span>
                  <input
                    className="auth-input"
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(null) }}
                    placeholder="you@example.com"
                    autoFocus
                    autoComplete="email"
                    inputMode="email"
                  />
                </label>

                {error && <p className="otp-error">{error}</p>}

                <button
                  type="submit"
                  className="btn btn-primary btn-large signup-cta auth-cta"
                  disabled={!email.trim() || sending}
                >
                  {sending ? 'Sending...' : 'Continue'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerify} className="signup-form">
                <p className="login-verify-msg">
                  We sent a code to <strong>{email}</strong>
                </p>
                <label className="field auth-field">
                  <span className="field-label">Verification code</span>
                  <input
                    className="auth-input auth-input--otp"
                    type="text"
                    value={otpCode}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 8)
                      setOtpCode(val)
                      setError(null)
                    }}
                    placeholder="12345678"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={8}
                    autoFocus
                  />
                </label>

                {error && <p className="otp-error">{error}</p>}

                <button
                  type="submit"
                  className="btn btn-primary btn-large signup-cta auth-cta"
                  disabled={otpCode.length < 6 || verifying}
                >
                  {verifying ? 'Verifying...' : 'Log In'}
                </button>

                <div className="otp-actions">
                  <button className="btn-link" onClick={handleResend} disabled={resendCountdown > 0}>
                    {resendCountdown > 0 ? `Resend code (${resendCountdown}s)` : 'Resend code'}
                  </button>
                  <button className="btn-link" onClick={() => { setStep('email'); setOtpCode(''); setError(null) }}>
                    Use a different email
                  </button>
                </div>
              </form>
            )}

            <p className="auth-terms">
              By logging in, you agree to Rally's <a href="/support/">Terms of Service</a> and <a href="/support/">Privacy Policy</a>.
            </p>

            <p className="auth-switch">
              New to Rally? <button className="sh-link" onClick={onSignUp}>Create a Free Account</button>
            </p>
          </div>
        </div>

        {/* Image side — Strava pattern: lifestyle imagery on right */}
        <div className="login-image-side">
          <img
            src="https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&h=1000&fit=crop&crop=center"
            alt="Tennis on court"
            className="login-image"
            loading="eager"
          />
          <div className="login-image-overlay">
            <div className="login-image-quote">
              <p className="login-quote-text">"Rally scheduled 12 matches for me in my first week. Zero texts."</p>
              <p className="login-quote-attr">— Sarah P., San Mateo County</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

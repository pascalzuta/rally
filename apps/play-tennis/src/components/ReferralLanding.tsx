import { useState, useEffect } from 'react'
import { searchCounties } from '../counties'
import { createProfile, saveAvailability } from '../store'
import { trackReferralSignup, trackReferralClick, getReferralBySlug, createViralReferral } from '../referralStore'
import { PlayerProfile } from '../types'

interface Props {
  slug: string
  onRegistered: (profile: PlayerProfile) => void
}

export default function ReferralLanding({ slug, onRegistered }: Props) {
  const [referral, setReferral] = useState<{ creatorName?: string; county?: string; signups: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [county, setCounty] = useState('')
  const [countySuggestions, setCountySuggestions] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getReferralBySlug(slug).then(r => {
      setReferral(r)
      if (r?.county) setCounty(r.county)
      setLoading(false)
    })
    // Track the click
    trackReferralClick(slug).catch(() => {})
  }, [slug])

  function handleCountyChange(val: string) {
    setCounty(val)
    if (val.length >= 2) {
      setCountySuggestions(searchCounties(val).slice(0, 5))
    } else {
      setCountySuggestions([])
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !county.trim()) {
      setError('Please fill in all fields.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const profile = createProfile(
        `${firstName.trim()} ${lastName.trim()}`,
        county.trim(),
        { email: email.trim() },
      )
      // Save minimal availability so app doesn't gate
      saveAvailability(profile.id, [])
      // Track referral signup
      await trackReferralSignup(slug, profile.id)
      // Auto-create viral referral for new user
      await createViralReferral(profile.id).catch(() => {})
      onRegistered(profile)
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>Loading...</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 20px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo / brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎾</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Rally Tennis</div>
          <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
            Auto-scheduled local tournaments
          </div>
        </div>

        {/* Referral badge */}
        {referral && (
          <div style={{
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            marginBottom: 20,
            borderLeft: '3px solid var(--color-positive-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <div style={{ fontSize: 24 }}>👋</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {referral.creatorName
                  ? `${referral.creatorName} invited you to Rally`
                  : 'You were invited to Rally'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                {referral.signups > 0
                  ? `${referral.signups} player${referral.signups !== 1 ? 's' : ''} joined this month`
                  : "Join your county's first tournament"}
              </div>
            </div>
          </div>
        )}

        {/* Sign-up form */}
        <div style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-md)',
          padding: '20px 16px',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Create your account</div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>First name</label>
                <input
                  className="input"
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Alex"
                  required
                  disabled={submitting}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Last name</label>
                <input
                  className="input"
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Smith"
                  required
                  disabled={submitting}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="alex@example.com"
                required
                disabled={submitting}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: 16, position: 'relative' }}>
              <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>County</label>
              <input
                className="input"
                type="text"
                value={county}
                onChange={e => handleCountyChange(e.target.value)}
                placeholder="e.g. Marin County, CA"
                required
                disabled={submitting}
                style={{ width: '100%' }}
              />
              {countySuggestions.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-divider)',
                  borderRadius: 'var(--radius-sm)',
                  zIndex: 10,
                  boxShadow: 'var(--shadow-sm)',
                }}>
                  {countySuggestions.map(s => (
                    <div
                      key={s}
                      onClick={() => { setCounty(s); setCountySuggestions([]) }}
                      style={{
                        padding: '10px 12px',
                        fontSize: 13,
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--color-divider)',
                      }}
                    >
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div style={{ color: 'var(--color-negative-primary)', fontSize: 13, marginBottom: 12 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={submitting}
            >
              {submitting ? 'Joining...' : 'Join Rally Tennis'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--color-text-secondary)' }}>
          Free to join. Tournaments auto-fill when 6+ players are in your county.
        </div>
      </div>
    </div>
  )
}

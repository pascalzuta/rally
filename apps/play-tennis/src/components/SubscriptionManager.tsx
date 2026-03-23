import { useState } from 'react'
import { Subscription } from '../types'
import { getSubscription, isPro, isTrialActive, getTrialMatchesRemaining, startTrial, createCheckoutSession } from '../subscriptionStore'

interface Props {
  onSubscriptionChanged?: () => void
}

function formatDate(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function PlanLabel({ sub }: { sub: Subscription | null }) {
  if (!sub || sub.plan === 'free') return <span style={{ color: 'var(--color-text-secondary)' }}>Free</span>
  if (sub.plan === 'trial') return <span style={{ color: '#8b5cf6' }}>Trial ({getTrialMatchesRemaining()} matches left)</span>
  if (sub.plan === 'pro_monthly') return <span style={{ color: '#8b5cf6', fontWeight: 700 }}>Rally Pro — Monthly</span>
  if (sub.plan === 'pro_annual') return <span style={{ color: '#8b5cf6', fontWeight: 700 }}>Rally Pro — Annual</span>
  return <span>Free</span>
}

export default function SubscriptionManager({ onSubscriptionChanged }: Props) {
  const [sub, setSub] = useState<Subscription | null>(getSubscription)
  const [loading, setLoading] = useState(false)

  const pro = isPro()
  const trial = isTrialActive()

  async function handleStartTrial() {
    setLoading(true)
    try {
      const updated = await startTrial()
      setSub(updated)
      onSubscriptionChanged?.()
    } finally {
      setLoading(false)
    }
  }

  async function handleUpgrade(plan: 'monthly' | 'annual') {
    setLoading(true)
    try {
      const url = await createCheckoutSession(plan)
      if (url) window.location.href = url
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '0 0 8px' }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Subscription</div>

      {/* Current plan */}
      <div style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
        marginBottom: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 2 }}>Current plan</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}><PlanLabel sub={sub} /></div>
          {(pro || trial) && sub?.currentPeriodEnd && (
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {sub.cancelAtPeriodEnd ? 'Cancels' : 'Renews'} {formatDate(sub.currentPeriodEnd)}
            </div>
          )}
          {trial && sub?.trialEndsAt && (
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              Trial ends {formatDate(sub.trialEndsAt)}
            </div>
          )}
        </div>
        {pro && (
          <button
            style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', fontSize: 12, cursor: 'pointer' }}
            onClick={() => {}}
          >
            Cancel
          </button>
        )}
      </div>

      {/* Upgrade cards — shown when not pro */}
      {!pro && (
        <>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
            {trial
              ? 'Upgrade before your trial runs out to keep access.'
              : 'Unlock algorithmic matching, priority scheduling, and more.'}
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            {/* Monthly card */}
            <div style={{
              flex: 1,
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 12px',
              boxShadow: 'var(--shadow-sm)',
              border: '1px solid var(--color-divider)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Monthly</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', fontVariantNumeric: 'tabular-nums' }}>
                $9.99
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>per month</div>
              <button
                className="btn btn-secondary"
                style={{ marginTop: 6, fontSize: 12, borderColor: '#8b5cf6', color: '#8b5cf6' }}
                onClick={() => handleUpgrade('monthly')}
                disabled={loading}
              >
                Choose Monthly
              </button>
            </div>

            {/* Annual card */}
            <div style={{
              flex: 1,
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 12px',
              boxShadow: 'var(--shadow-sm)',
              border: '2px solid #8b5cf6',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute',
                top: -10,
                right: 10,
                background: '#8b5cf6',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 20,
                textTransform: 'uppercase',
              }}>
                Save 33%
              </div>
              <div style={{ fontSize: 12, color: '#8b5cf6', fontWeight: 600 }}>Annual</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', fontVariantNumeric: 'tabular-nums' }}>
                $79.99
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>per year (~$6.67/mo)</div>
              <button
                className="btn btn-primary"
                style={{ marginTop: 6, fontSize: 12, background: '#8b5cf6', borderColor: '#8b5cf6' }}
                onClick={() => handleUpgrade('annual')}
                disabled={loading}
              >
                Choose Annual
              </button>
            </div>
          </div>

          {/* Trial CTA — only for free users who haven't started trial */}
          {!trial && (
            <button
              className="btn btn-secondary"
              style={{ width: '100%', fontSize: 13 }}
              onClick={handleStartTrial}
              disabled={loading}
            >
              {loading ? 'Starting...' : 'Start 5-Match Free Trial'}
            </button>
          )}
        </>
      )}
    </div>
  )
}

/**
 * NotificationPrimer — Pre-permission priming screen
 *
 * Shows BEFORE the iOS system permission dialog to maximize opt-in rate.
 * Appears once after tournament creation (the "aha moment").
 *
 * Key UX decisions:
 * - Benefit-first headline: "Never miss a match"
 * - Concrete frequency commitment: "1-2 per day, max"
 * - Visual preview of what a notification looks like
 * - "Maybe later" is de-emphasized but always accessible
 * - No X button — force a deliberate choice
 *
 * Product manager note: This screen is worth more polish than
 * any other notification-related feature. A good primer doubles opt-in rate.
 */
import { useState } from 'react'
import { requestPushPermission } from '../native/push'
import { isNative } from '../native/platform'

interface NotificationPrimerProps {
  /** Player's name for the preview notification */
  playerName?: string
  /** Called after user makes a choice (enable or skip) */
  onComplete: (granted: boolean) => void
}

export default function NotificationPrimer({ playerName, onComplete }: NotificationPrimerProps) {
  const [loading, setLoading] = useState(false)

  if (!isNative) {
    // On web, skip the primer entirely
    onComplete(false)
    return null
  }

  async function handleEnable() {
    setLoading(true)
    const result = await requestPushPermission()
    setLoading(false)
    onComplete(result === 'granted')
  }

  function handleSkip() {
    onComplete(false)
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '20px',
        padding: '32px 24px',
        maxWidth: '340px',
        width: '100%',
        textAlign: 'center',
      }}>
        {/* Notification preview mockup */}
        <div style={{
          background: '#f8f9fa',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '24px',
          textAlign: 'left',
          border: '1px solid #e9ecef',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '4px',
          }}>
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '4px',
              background: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
            }}>
              <span style={{ color: '#fff', fontWeight: 700 }}>R</span>
            </div>
            <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>
              Rally
            </span>
            <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: 'auto' }}>
              now
            </span>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#111' }}>
            Match in 2 hours
          </div>
          <div style={{ fontSize: '13px', color: '#4b5563', marginTop: '2px' }}>
            You play Jordan Lee today at 4:00 PM. Good luck out there.
          </div>
        </div>

        {/* Headline */}
        <h2 style={{
          fontSize: '22px',
          fontWeight: 700,
          color: '#111',
          margin: '0 0 8px 0',
        }}>
          Never miss a match
        </h2>

        {/* Value proposition */}
        <p style={{
          fontSize: '15px',
          color: '#4b5563',
          margin: '0 0 8px 0',
          lineHeight: 1.5,
        }}>
          Your tournament is set. We'll send you reminders before your matches
          and let you know when opponents report scores.
        </p>

        {/* Trust line — specific frequency commitment */}
        <p style={{
          fontSize: '13px',
          color: '#9ca3af',
          margin: '0 0 24px 0',
        }}>
          1-2 notifications per day, max. No spam.
        </p>

        {/* Primary CTA */}
        <button
          onClick={handleEnable}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '12px',
            border: 'none',
            background: '#16a34a',
            color: '#fff',
            fontSize: '16px',
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.7 : 1,
            marginBottom: '12px',
          }}
        >
          {loading ? 'Enabling...' : 'Enable notifications'}
        </button>

        {/* De-emphasized skip — plain text, not a button */}
        <div
          onClick={handleSkip}
          style={{
            fontSize: '14px',
            color: '#9ca3af',
            cursor: 'pointer',
            padding: '4px',
          }}
        >
          Maybe later
        </div>
      </div>
    </div>
  )
}

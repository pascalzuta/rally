import { useState, useEffect } from 'react'
import {
  checkPushPermission,
  requestPushPermission,
  registerDeviceToken,
  canOpenSettings,
  openAppSettings,
} from '../pushRegistration'
import { analytics } from '../analytics'

interface Props {
  playerId: string
  onComplete: () => void
  onDismiss: () => void
}

type Step = 'prompt' | 'declined-warning' | 'denied-settings' | 'requesting' | 'registering'

export default function NotificationPermission({ playerId, onComplete, onDismiss }: Props) {
  const [step, setStep] = useState<Step>('prompt')
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    analytics.track('notification_prompt_shown', { properties: { playerId } })
  }, [playerId])

  async function handleEnable() {
    setStep('requesting')
    setError(null)

    const permission = await requestPushPermission()

    if (permission === 'granted') {
      analytics.track('notification_prompt_granted', { properties: { playerId } })
      setStep('registering')

      const registered = await registerDeviceToken(playerId)
      if (registered) {
        analytics.track('notification_token_registered', { properties: { playerId } })
        onComplete()
      } else {
        if (retryCount < 3) {
          setError("Couldn't save your preference. Tap to retry.")
          setRetryCount(r => r + 1)
          analytics.track('notification_token_failed', { properties: { playerId, retryCount: retryCount + 1 } })
          setStep('prompt')
        } else {
          // Give up on registration, let them proceed
          onComplete()
        }
      }
    } else if (permission === 'denied') {
      analytics.track('notification_prompt_denied', { properties: { playerId } })
      if (canOpenSettings()) {
        setStep('denied-settings')
      } else {
        // Web: can't re-prompt, show warning and let them proceed
        setStep('declined-warning')
      }
    } else {
      // 'default' or dismissed — treat as skipped
      analytics.track('notification_prompt_skipped', { properties: { playerId } })
      setStep('declined-warning')
    }
  }

  function handleNotNow() {
    analytics.track('notification_prompt_skipped', { properties: { playerId } })
    setStep('declined-warning')
  }

  function handleJoinAnyway() {
    onComplete()
  }

  function handleGoBack() {
    onDismiss()
  }

  async function handleOpenSettings() {
    await openAppSettings()
    // When they come back, check if they enabled it
    const permission = await checkPushPermission()
    if (permission === 'granted') {
      setStep('registering')
      const registered = await registerDeviceToken(playerId)
      if (registered) {
        analytics.track('notification_token_registered', { properties: { playerId } })
      }
      onComplete()
    }
  }

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-label="Enable notifications">
      <div style={panelStyle}>
        {step === 'prompt' && (
          <>
            <h2 style={titleStyle}>Stay in the game</h2>
            <p style={subtitleStyle}>Notifications keep your tournament moving:</p>
            <div style={examplesStyle}>
              <div style={exampleRow}>
                <span style={iconStyle}>⏰</span>
                <span>Confirm your match time (24h deadline)</span>
              </div>
              <div style={exampleRow}>
                <span style={iconStyle}>✓</span>
                <span>Verify the score your opponent reported</span>
              </div>
              <div style={exampleRow}>
                <span style={iconStyle}>📅</span>
                <span>Reminder: you play tomorrow at 6pm</span>
              </div>
            </div>
            {error && <p style={errorStyle}>{error}</p>}
            <button style={primaryButtonStyle} onClick={handleEnable}>
              Enable Notifications
            </button>
            <button style={secondaryButtonStyle} onClick={handleNotNow}>
              Not now
            </button>
          </>
        )}

        {step === 'requesting' && (
          <>
            <h2 style={titleStyle}>Stay in the game</h2>
            <button style={{ ...primaryButtonStyle, opacity: 0.6 }} disabled>
              Requesting...
            </button>
          </>
        )}

        {step === 'registering' && (
          <>
            <h2 style={titleStyle}>Stay in the game</h2>
            <button style={{ ...primaryButtonStyle, opacity: 0.6 }} disabled>
              Saving...
            </button>
          </>
        )}

        {step === 'declined-warning' && (
          <>
            <h2 style={titleStyle}>You can still join, but you might miss updates</h2>
            <p style={subtitleStyle}>
              Without notifications, you'll need to check the app regularly.
              Your opponents may be waiting on you to confirm matches or scores.
            </p>
            <button style={primaryButtonStyle} onClick={handleEnable}>
              Enable Notifications
            </button>
            <button style={secondaryButtonStyle} onClick={handleJoinAnyway}>
              Join Anyway
            </button>
            <button style={tertiaryButtonStyle} onClick={handleGoBack}>
              Go Back
            </button>
          </>
        )}

        {step === 'denied-settings' && (
          <>
            <h2 style={titleStyle}>Notifications are blocked in your phone's settings</h2>
            <p style={subtitleStyle}>
              Tap below to open Settings, then enable notifications for Rally.
            </p>
            <button style={primaryButtonStyle} onClick={handleOpenSettings}>
              Open Settings
            </button>
            <button style={secondaryButtonStyle} onClick={handleJoinAnyway}>
              Join Anyway
            </button>
            <button style={tertiaryButtonStyle} onClick={handleGoBack}>
              Go Back
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// Inline styles matching the app's design system
const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  zIndex: 9999,
  animation: 'fadeIn 200ms ease-out',
}

const panelStyle: React.CSSProperties = {
  background: 'var(--color-surface, #fff)',
  borderRadius: '16px 16px 0 0',
  padding: '32px 24px',
  paddingBottom: 'max(32px, env(safe-area-inset-bottom))',
  width: '100%',
  maxWidth: '480px',
  animation: 'slideUp 200ms ease-out',
}

const titleStyle: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: 700,
  margin: '0 0 8px',
  color: 'var(--color-text, #1a1a1a)',
}

const subtitleStyle: React.CSSProperties = {
  fontSize: '15px',
  color: 'var(--color-text-secondary, #666)',
  margin: '0 0 20px',
  lineHeight: 1.5,
}

const examplesStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  marginBottom: '24px',
}

const exampleRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  fontSize: '14px',
  color: 'var(--color-text, #1a1a1a)',
}

const iconStyle: React.CSSProperties = {
  fontSize: '18px',
  width: '24px',
  textAlign: 'center',
  flexShrink: 0,
}

const primaryButtonStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '14px',
  fontSize: '16px',
  fontWeight: 600,
  border: 'none',
  borderRadius: 'var(--radius-md, 12px)',
  background: 'var(--color-primary, #2563eb)',
  color: '#fff',
  cursor: 'pointer',
  minHeight: '48px',
  marginBottom: '8px',
}

const secondaryButtonStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '12px',
  fontSize: '15px',
  fontWeight: 500,
  border: 'none',
  borderRadius: 'var(--radius-md, 12px)',
  background: 'transparent',
  color: 'var(--color-text-secondary, #666)',
  cursor: 'pointer',
  minHeight: '44px',
}

const tertiaryButtonStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '10px',
  fontSize: '14px',
  border: 'none',
  background: 'transparent',
  color: 'var(--color-text-tertiary, #999)',
  cursor: 'pointer',
  minHeight: '44px',
}

const errorStyle: React.CSSProperties = {
  color: '#dc2626',
  fontSize: '14px',
  marginBottom: '12px',
}

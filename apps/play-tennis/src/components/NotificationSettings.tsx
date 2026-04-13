/**
 * NotificationSettings — Push notification preferences UI
 *
 * Accessible from the Profile/Availability tab.
 * Shows:
 * - Push permission status + toggle/redirect
 * - Per-type notification toggles (score reminders, match reminders, etc.)
 * - Quiet hours configuration
 *
 * Reads/writes to Supabase notification_preferences table.
 */
import { useState, useEffect, useCallback } from 'react'
import { isNative } from '../native/platform'
import { checkPushPermission, requestPushPermission, type PushPermissionStatus } from '../native/push'
import { getClient } from '../supabase'
import { useAuth } from '../context/AuthContext'

interface NotificationPrefs {
  pushEnabled: boolean
  emailEnabled: boolean
  disabledTypes: string[]
  quietStart: number | null
  quietEnd: number | null
  timezone: string
}

const DEFAULT_PREFS: NotificationPrefs = {
  pushEnabled: true,
  emailEnabled: true,
  disabledTypes: [],
  quietStart: 22,
  quietEnd: 7,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
}

const NOTIFICATION_TYPES = [
  { code: 'N-01', label: 'Tournament created', group: 'Tournament' },
  { code: 'N-02', label: 'Tournament starting soon', group: 'Tournament' },
  { code: 'N-30', label: 'Match confirmed', group: 'Matches' },
  { code: 'N-40', label: 'Score reported by opponent', group: 'Scores' },
  { code: 'N-41', label: 'Score confirmation needed', group: 'Scores' },
  { code: 'N-44', label: 'Score confirmed', group: 'Scores' },
  { code: 'N-10', label: 'Scheduling reminders', group: 'Scheduling' },
]

export default function NotificationSettings() {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS)
  const [permissionStatus, setPermissionStatus] = useState<PushPermissionStatus>('prompt')
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Load preferences
  useEffect(() => {
    if (!user?.id) return
    void loadPrefs()
  }, [user?.id])

  // Check native permission status
  useEffect(() => {
    if (isNative) {
      checkPushPermission().then(setPermissionStatus)
    }
  }, [])

  async function loadPrefs() {
    if (!user?.id) return
    const { data } = await getClient()!
      .from('notification_preferences')
      .select('*')
      .eq('player_id', user.id)
      .maybeSingle()

    if (data) {
      setPrefs({
        pushEnabled: data.push_enabled ?? true,
        emailEnabled: data.email_enabled ?? true,
        disabledTypes: data.disabled_types ?? [],
        quietStart: data.quiet_start,
        quietEnd: data.quiet_end,
        timezone: data.timezone ?? DEFAULT_PREFS.timezone,
      })
    }
    setLoaded(true)
  }

  const savePrefs = useCallback(async (updated: NotificationPrefs) => {
    if (!user?.id) return
    setSaving(true)
    await getClient()!
      .from('notification_preferences')
      .upsert({
        player_id: user.id,
        push_enabled: updated.pushEnabled,
        email_enabled: updated.emailEnabled,
        disabled_types: updated.disabledTypes,
        quiet_start: updated.quietStart,
        quiet_end: updated.quietEnd,
        timezone: updated.timezone,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'player_id' })
    setSaving(false)
  }, [user?.id])

  function toggleType(code: string) {
    const newDisabled = prefs.disabledTypes.includes(code)
      ? prefs.disabledTypes.filter(c => c !== code)
      : [...prefs.disabledTypes, code]
    const updated = { ...prefs, disabledTypes: newDisabled }
    setPrefs(updated)
    void savePrefs(updated)
  }

  function togglePush() {
    const updated = { ...prefs, pushEnabled: !prefs.pushEnabled }
    setPrefs(updated)
    void savePrefs(updated)
  }

  async function handleEnablePush() {
    const result = await requestPushPermission()
    setPermissionStatus(result)
  }

  if (!loaded) {
    return <div style={{ padding: '16px', color: '#9ca3af', fontSize: '14px' }}>Loading...</div>
  }

  return (
    <div style={{ padding: '0 16px 24px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '16px 0 12px', color: '#111' }}>
        Notifications
      </h3>

      {/* Push permission status (native only) */}
      {isNative && (
        <div style={{
          background: '#f8f9fa',
          borderRadius: '12px',
          padding: '14px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#111' }}>
              Push Notifications
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
              {permissionStatus === 'granted'
                ? 'Enabled — you\'ll get alerts on this device'
                : permissionStatus === 'denied'
                ? 'Blocked — tap to open Settings'
                : 'Not yet enabled'}
            </div>
          </div>
          {permissionStatus === 'granted' ? (
            <ToggleSwitch checked={prefs.pushEnabled} onChange={togglePush} />
          ) : (
            <button
              onClick={handleEnablePush}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: '#16a34a',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Enable
            </button>
          )}
        </div>
      )}

      {/* Quiet hours */}
      <div style={{
        background: '#f8f9fa',
        borderRadius: '12px',
        padding: '14px 16px',
        marginBottom: '16px',
      }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: '#111', marginBottom: '8px' }}>
          Quiet Hours
        </div>
        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>
          No notifications between these hours
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <TimeSelect
            value={prefs.quietStart}
            onChange={(v) => {
              const updated = { ...prefs, quietStart: v }
              setPrefs(updated)
              void savePrefs(updated)
            }}
          />
          <span style={{ color: '#9ca3af', fontSize: '13px' }}>to</span>
          <TimeSelect
            value={prefs.quietEnd}
            onChange={(v) => {
              const updated = { ...prefs, quietEnd: v }
              setPrefs(updated)
              void savePrefs(updated)
            }}
          />
        </div>
      </div>

      {/* Per-type toggles */}
      <div style={{
        background: '#f8f9fa',
        borderRadius: '12px',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 16px 8px', fontSize: '14px', fontWeight: 500, color: '#111' }}>
          Notification Types
        </div>
        {NOTIFICATION_TYPES.map((nt, i) => (
          <div
            key={nt.code}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              borderTop: i === 0 ? 'none' : '1px solid #e9ecef',
            }}
          >
            <span style={{ fontSize: '13px', color: '#374151' }}>{nt.label}</span>
            <ToggleSwitch
              checked={!prefs.disabledTypes.includes(nt.code)}
              onChange={() => toggleType(nt.code)}
            />
          </div>
        ))}
      </div>

      {saving && (
        <div style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', marginTop: '8px' }}>
          Saving...
        </div>
      )}
    </div>
  )
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <div
      onClick={onChange}
      style={{
        width: '44px',
        height: '26px',
        borderRadius: '13px',
        background: checked ? '#16a34a' : '#d1d5db',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <div style={{
        width: '22px',
        height: '22px',
        borderRadius: '11px',
        background: '#fff',
        position: 'absolute',
        top: '2px',
        left: checked ? '20px' : '2px',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </div>
  )
}

function TimeSelect({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{
        padding: '6px 10px',
        borderRadius: '8px',
        border: '1px solid #d1d5db',
        fontSize: '13px',
        color: '#374151',
        background: '#fff',
      }}
    >
      {Array.from({ length: 24 }, (_, i) => (
        <option key={i} value={i}>
          {i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}
        </option>
      ))}
    </select>
  )
}

/**
 * Messages / notifications / sign-out preview screens (handoff 3, 20–23).
 *
 * Exports MESSAGES_SCREENS for the parent /dev/screens registry to consume.
 * Screens 20 + 21 render the real Inbox / MessagePanel components against
 * seeded mock data. Screens 22 + 23 are static compositions demonstrating
 * the Baseline target — the real notifications surface and the user-menu
 * dropdown still need to be migrated in App.tsx / styles.css.
 */

import { ReactNode } from 'react'
import Inbox from '../components/Inbox'
import MessagePanel from '../components/MessagePanel'
import { MOCK_PROFILE, MOCK_TOURNAMENT } from './mockData'
import {
  seedMockConversation,
  MOCK_OTHER_PLAYER_ID,
  MOCK_OTHER_PLAYER_NAME,
} from './mockMessages'
import './css/baseline-messages.css'

export interface ScreenDef {
  id: string
  label: string
  number: string
  render: () => JSX.Element
}

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div style={{
      width: 375, minHeight: 600, margin: '0 auto',
      background: 'var(--bg-2)', border: '1px solid var(--line)',
      borderRadius: 24, overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(11,13,16,0.10)',
    }}>{children}</div>
  )
}

/* ---------- Screen 20: Messages list ---------- */

function MessagesListScreen() {
  // Seed a conversation so the list isn't empty.
  seedMockConversation()
  return (
    <PhoneFrame>
      <div style={{ height: 600, display: 'flex', flexDirection: 'column' }}>
        <Inbox
          currentPlayerId={MOCK_PROFILE.id}
          currentPlayerName={MOCK_PROFILE.name}
          county={MOCK_PROFILE.county}
          tournaments={[MOCK_TOURNAMENT]}
          onClose={() => {}}
        />
      </div>
    </PhoneFrame>
  )
}

/* ---------- Screen 21: Messages thread ---------- */

function MessagesThreadScreen() {
  seedMockConversation()
  return (
    <PhoneFrame>
      <div style={{ height: 600, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        {/* Mimic Inbox's open-conversation header so the screen matches when
            opened via the parent flow, but keep it standalone for preview. */}
        <div className="chat-conv-header">
          <button className="chat-back-btn" aria-label="Back">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 4L7 10l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="chat-conv-avatar">T</div>
          <div className="chat-conv-header-info">
            <span className="chat-conv-header-name">Taylor Kim</span>
            <span className="chat-conv-header-sub">Mineral County, CO Open #2 · Thursday 6pm</span>
          </div>
          <button className="chat-close-btn" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <MessagePanel
            currentPlayerId={MOCK_PROFILE.id}
            currentPlayerName={MOCK_PROFILE.name}
            otherPlayerId={MOCK_OTHER_PLAYER_ID}
            otherPlayerName={MOCK_OTHER_PLAYER_NAME}
            onClose={() => {}}
            embedded
          />
        </div>
      </div>
    </PhoneFrame>
  )
}

/* ---------- Screen 22: Notifications (static composition) ---------- */

function NotifRow({
  title,
  opponent,
  tournament,
  tone = 'blue',
}: {
  title: string
  opponent: string
  tournament: string
  tone?: 'blue' | 'amber'
}) {
  return (
    <div className={`bm-notif-row ${tone === 'amber' ? 'bm-notif-row--amber' : ''}`}>
      <div className="bm-notif-icon">
        {tone === 'blue' ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 5v3.2l2 1.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <div className="bm-notif-body">
        <div className="bm-notif-title">{title}</div>
        <div className="bm-notif-line bm-notif-line--strong">{opponent}</div>
        <div className="bm-notif-line">{tournament}</div>
      </div>
    </div>
  )
}

function NotificationsScreen() {
  return (
    <PhoneFrame>
      <div style={{ minHeight: 600, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <div className="bm-header" style={{ paddingBottom: 16, borderBottom: '1px solid var(--line)' }}>
          <h2 className="bm-header-title">Notifications</h2>
          <button className="bm-close" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="bm-notif-list">
          <NotifRow title="Ready to score" opponent="vs Alex Rivera" tournament="Mineral County, CO Open #2" />
          <NotifRow title="Ready to score" opponent="vs Jordan Chen" tournament="Mineral County, CO Open #2" />
          <NotifRow title="Ready to score" opponent="vs Sam Patel" tournament="Mineral County, CO Open #2" />
          <NotifRow title="Ready to score" opponent="vs Taylor Kim" tournament="Mineral County, CO Open #2" />
          <NotifRow
            title="Casey Brooks proposed a time"
            opponent="vs Casey Brooks"
            tournament="Mineral County, CO Open #2"
            tone="amber"
          />
        </div>
      </div>
    </PhoneFrame>
  )
}

/* ---------- Screen 23: Sign-out menu (static composition) ---------- */

function SignOutMenuScreen() {
  return (
    <PhoneFrame>
      <div style={{ minHeight: 600, display: 'flex', flexDirection: 'column', background: 'var(--bg-2)' }}>
        {/* Top bar */}
        <div className="bm-topbar">
          <div className="bm-topbar-logo">Rally</div>
          <div className="bm-topbar-actions">
            <button className="bm-topbar-icon" aria-label="Messages">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M22 7l-10 7L2 7" />
              </svg>
            </button>
            <button className="bm-topbar-icon" aria-label="Notifications">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="bm-topbar-badge">5</span>
            </button>
            <button className="bm-avatar-circle" aria-label="Account">PR</button>
          </div>
        </div>

        {/* Faded behind-content + dropdown */}
        <div className="bm-dropdown-wrap" style={{ flex: 1 }}>
          <div className="bm-faded-behind">
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
              <div style={{
                background: 'var(--bg)', border: '1px solid var(--line)',
                borderRadius: 999, padding: '8px 18px',
                fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 700,
                color: 'var(--ink)',
              }}>My Matches</div>
            </div>
            <div style={{ marginTop: 18, paddingLeft: 4, fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--blue-soft)' }} />
              <span>This week</span>
            </div>
            <div style={{
              marginTop: 12, background: 'var(--bg)', border: '1px solid var(--line)',
              borderRadius: 16, padding: '14px 16px',
            }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--blue-soft)' }} />
                <span style={{
                  background: 'var(--blue-soft)', color: 'var(--blue)',
                  fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 500,
                  padding: '3px 9px', borderRadius: 999,
                }}>Confirmed · Thu, Apr 30 5pm</span>
              </div>
              <div style={{
                marginTop: 10, fontFamily: 'Inter, sans-serif', fontSize: 18,
                fontWeight: 700, color: 'var(--ink-2)',
              }}>vs Taylor Kim</div>
            </div>
          </div>

          {/* The dropdown itself, anchored under the avatar */}
          <div className="bm-dropdown">
            <button className="bm-dropdown-item">Sign out</button>
          </div>
        </div>
      </div>
    </PhoneFrame>
  )
}

export const MESSAGES_SCREENS: ScreenDef[] = [
  { id: 'messages-list',   number: '20', label: 'Messages — list',     render: MessagesListScreen },
  { id: 'messages-thread', number: '21', label: 'Messages — thread',   render: MessagesThreadScreen },
  { id: 'notifications',   number: '22', label: 'Notifications',       render: NotificationsScreen },
  { id: 'sign-out-menu',   number: '23', label: 'Sign-out menu',       render: SignOutMenuScreen },
]

import { useState } from 'react'
import { getConversationList, markConversationRead, sendMessage, RALLY_SYSTEM_ID } from '../store'
import { Tournament } from '../types'
import MessagePanel from './MessagePanel'
import WelcomeMessage from './WelcomeMessage'

interface Props {
  currentPlayerId: string
  currentPlayerName: string
  county: string
  tournaments: Tournament[]
  onClose: () => void
}

/** Find the next upcoming match between two players across tournaments */
function findMatchContext(
  tournaments: Tournament[],
  playerId: string,
  otherPlayerId: string
): { tournamentName: string; matchDate: string | null } | null {
  for (const t of tournaments) {
    const isP1 = t.players.some(p => p.id === playerId)
    const isP2 = t.players.some(p => p.id === otherPlayerId)
    if (!isP1 || !isP2) continue
    const match = t.matches.find(
      m =>
        (m.player1Id === playerId && m.player2Id === otherPlayerId) ||
        (m.player1Id === otherPlayerId && m.player2Id === playerId)
    )
    if (!match) continue
    const slot = match.schedule?.confirmedSlot
    const dateStr = slot
      ? `${slot.day.charAt(0).toUpperCase() + slot.day.slice(1)} ${slot.startHour % 12 || 12}${slot.startHour >= 12 ? 'pm' : 'am'}`
      : null
    return { tournamentName: t.name, matchDate: dateStr }
  }
  return null
}

/** Generate a consistent color from a player name using Rally palette tones */
function avatarColor(name: string): string {
  const colors = [
    '#2A5BD7', '#1F9D55', '#D97706', '#D64545', '#7c3aed',
    '#0891b2', '#374151', '#c026d3', '#059669', '#ea580c'
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export default function Inbox({ currentPlayerId, currentPlayerName, county, tournaments, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'current' | 'past'>('current')
  const [openConversation, setOpenConversation] = useState<{ playerId: string; playerName: string } | null>(null)

  const conversations = getConversationList(currentPlayerId)

  // Split conversations by whether the other player is in an active or past tournament
  const activeTournamentPlayerIds = new Set<string>()

  for (const t of tournaments) {
    const isParticipant = t.players.some(p => p.id === currentPlayerId)
    if (!isParticipant) continue
    for (const p of t.players) {
      if (p.id === currentPlayerId) continue
      if (t.status === 'in-progress' || t.status === 'setup') {
        activeTournamentPlayerIds.add(p.id)
      }
    }
  }

  const currentConversations = conversations.filter(c => activeTournamentPlayerIds.has(c.otherPlayerId) || c.otherPlayerId === RALLY_SYSTEM_ID)
  const pastConversations = conversations.filter(c => !activeTournamentPlayerIds.has(c.otherPlayerId) && c.otherPlayerId !== RALLY_SYSTEM_ID)

  const displayedConversations = activeTab === 'current' ? currentConversations : pastConversations

  function formatTime(iso: string): string {
    const d = new Date(iso)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    if (isToday) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' })
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  // --- Conversation view ---
  if (openConversation) {
    // System conversation renders the full styled "How does Rally work?" view
    if (openConversation.playerId === RALLY_SYSTEM_ID) {
      return (
        <WelcomeMessage
          currentPlayerId={currentPlayerId}
          county={county}
          onBack={() => setOpenConversation(null)}
          onClose={onClose}
        />
      )
    }

    return (
      <div className="chat-fullscreen">
        <div className="chat-conv-header">
          <button className="chat-back-btn" onClick={() => setOpenConversation(null)}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 4L7 10l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div
            className="chat-conv-avatar"
            style={{ background: avatarColor(openConversation.playerName) }}
          >
            {openConversation.playerName[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="chat-conv-header-info">
            <span className="chat-conv-header-name">{openConversation.playerName}</span>
            {(() => {
              const ctx = findMatchContext(tournaments, currentPlayerId, openConversation.playerId)
              return ctx ? (
                <span className="chat-conv-header-sub">
                  {ctx.tournamentName}{ctx.matchDate && ` \u00B7 ${ctx.matchDate}`}
                </span>
              ) : null
            })()}
          </div>
          <button className="chat-close-btn" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="chat-conv-body">
          <MessagePanel
            currentPlayerId={currentPlayerId}
            currentPlayerName={currentPlayerName}
            otherPlayerId={openConversation.playerId}
            otherPlayerName={openConversation.playerName}
            onClose={() => setOpenConversation(null)}
            embedded
          />
        </div>
      </div>
    )
  }

  // --- Conversation list ---
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0)

  return (
    <div className="chat-fullscreen">
      <div className="chat-list-header">
        <div className="chat-list-header-top">
          <span className="chat-list-title">
            Messages
            {totalUnread > 0 && <span className="chat-list-badge">{totalUnread > 99 ? '99+' : totalUnread}</span>}
          </span>
          <button className="chat-close-btn" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="chat-tabs">
          <button
            className={`chat-tab ${activeTab === 'current' ? 'active' : ''}`}
            onClick={() => setActiveTab('current')}
          >
            Current Tournament
          </button>
          <button
            className={`chat-tab ${activeTab === 'past' ? 'active' : ''}`}
            onClick={() => setActiveTab('past')}
          >
            Past Tournaments
          </button>
        </div>
      </div>

      <div className="chat-list">
        {displayedConversations.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <rect x="4" y="8" width="40" height="28" rx="6" stroke="currentColor" strokeWidth="2" fill="none" />
                <path d="M4 30l16-10 4 3 4-3 16 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </div>
            <p>
              {activeTab === 'current'
                ? 'No messages in your current tournament yet'
                : 'No messages from past tournaments'}
            </p>
            {activeTab === 'current' && (
              <span className="chat-empty-hint">Tap the chat icon on a match to start a conversation</span>
            )}
          </div>
        ) : (
          displayedConversations.map(conv => {
            const isSystem = conv.otherPlayerId === RALLY_SYSTEM_ID
            const matchCtx = isSystem ? null : findMatchContext(tournaments, currentPlayerId, conv.otherPlayerId)
            const isUnread = conv.unreadCount > 0
            return (
              <button
                key={conv.otherPlayerId}
                className={`chat-card ${isUnread ? 'chat-card-unread' : ''}`}
                onClick={() => {
                  markConversationRead(currentPlayerId, conv.otherPlayerId)
                  setOpenConversation({ playerId: conv.otherPlayerId, playerName: conv.otherPlayerName })
                }}
              >
                <div className="chat-card-avatar-wrap">
                  {isSystem ? (
                    <div className="chat-card-avatar chat-card-avatar--system">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M2.5 12c0-1.5 4-5.5 9.5-5.5s9.5 4 9.5 5.5-4 5.5-9.5 5.5S2.5 13.5 2.5 12z" />
                      </svg>
                    </div>
                  ) : (
                    <div
                      className="chat-card-avatar"
                      style={{ background: avatarColor(conv.otherPlayerName) }}
                    >
                      {conv.otherPlayerName[0]?.toUpperCase() ?? '?'}
                    </div>
                  )}
                </div>
                <div className="chat-card-body">
                  <div className="chat-card-row">
                    <span className="chat-card-name">{conv.otherPlayerName}</span>
                    <span className="chat-card-time">{formatTime(conv.lastMessage.createdAt)}</span>
                  </div>
                  {isSystem && (
                    <div className="chat-card-context">How does Rally work?</div>
                  )}
                  {matchCtx && (
                    <div className="chat-card-context">
                      {matchCtx.tournamentName}
                      {matchCtx.matchDate && <span> &middot; {matchCtx.matchDate}</span>}
                    </div>
                  )}
                  <div className="chat-card-preview">
                    {conv.lastMessage.senderId === currentPlayerId ? 'You: ' : ''}
                    {conv.lastMessage.text.length > 55
                      ? conv.lastMessage.text.slice(0, 55) + '...'
                      : conv.lastMessage.text}
                  </div>
                </div>
                {isUnread && (
                  <span className="chat-card-badge">{conv.unreadCount}</span>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

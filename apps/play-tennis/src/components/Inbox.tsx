import { useState } from 'react'
import { getConversationList, markConversationRead } from '../store'
import { Tournament } from '../types'
import MessagePanel from './MessagePanel'

interface Props {
  currentPlayerId: string
  currentPlayerName: string
  tournaments: Tournament[]
  onClose: () => void
}

export default function Inbox({ currentPlayerId, currentPlayerName, tournaments, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'current' | 'past'>('current')
  const [openConversation, setOpenConversation] = useState<{ playerId: string; playerName: string } | null>(null)

  const conversations = getConversationList(currentPlayerId)

  // Split conversations by whether the other player is in an active or past tournament
  const activeTournamentPlayerIds = new Set<string>()
  const pastTournamentPlayerIds = new Set<string>()

  for (const t of tournaments) {
    const isParticipant = t.players.some(p => p.id === currentPlayerId)
    if (!isParticipant) continue
    for (const p of t.players) {
      if (p.id === currentPlayerId) continue
      if (t.status === 'in-progress' || t.status === 'setup') {
        activeTournamentPlayerIds.add(p.id)
      } else {
        pastTournamentPlayerIds.add(p.id)
      }
    }
  }

  const currentConversations = conversations.filter(c => activeTournamentPlayerIds.has(c.otherPlayerId))
  const pastConversations = conversations.filter(c => !activeTournamentPlayerIds.has(c.otherPlayerId))

  const displayedConversations = activeTab === 'current' ? currentConversations : pastConversations

  function formatTime(iso: string): string {
    const d = new Date(iso)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    if (isToday) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  if (openConversation) {
    return (
      <div className="inbox-overlay" onClick={onClose}>
        <div className="inbox-panel" onClick={e => e.stopPropagation()}>
          <div className="inbox-header">
            <button className="inbox-back-btn" onClick={() => setOpenConversation(null)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="inbox-title">Messages</span>
            <button className="inbox-close-btn" onClick={onClose} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="inbox-conversation-view">
            <MessagePanel
              currentPlayerId={currentPlayerId}
              currentPlayerName={currentPlayerName}
              otherPlayerId={openConversation.playerId}
              otherPlayerName={openConversation.playerName}
              onClose={() => setOpenConversation(null)}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="inbox-overlay" onClick={onClose}>
      <div className="inbox-panel" onClick={e => e.stopPropagation()}>
        <div className="inbox-header">
          <span className="inbox-title">Messages</span>
          <button className="inbox-close-btn" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="inbox-tabs">
          <button
            className={`inbox-tab ${activeTab === 'current' ? 'active' : ''}`}
            onClick={() => setActiveTab('current')}
          >
            Current Tournament
          </button>
          <button
            className={`inbox-tab ${activeTab === 'past' ? 'active' : ''}`}
            onClick={() => setActiveTab('past')}
          >
            Past Tournaments
          </button>
        </div>

        <div className="inbox-list">
          {displayedConversations.length === 0 ? (
            <div className="inbox-empty">
              {activeTab === 'current'
                ? 'No messages in current tournament'
                : 'No messages from past tournaments'}
            </div>
          ) : (
            displayedConversations.map(conv => (
              <button
                key={conv.otherPlayerId}
                className={`inbox-card ${conv.unreadCount > 0 ? 'inbox-card-unread' : ''}`}
                onClick={() => {
                  markConversationRead(currentPlayerId, conv.otherPlayerId)
                  setOpenConversation({ playerId: conv.otherPlayerId, playerName: conv.otherPlayerName })
                }}
              >
                <div className="inbox-card-avatar">
                  {conv.otherPlayerName[0]?.toUpperCase() ?? '?'}
                  {conv.unreadCount > 0 && <span className="inbox-card-dot" />}
                </div>
                <div className="inbox-card-content">
                  <div className="inbox-card-top">
                    <span className="inbox-card-name">{conv.otherPlayerName}</span>
                    <span className="inbox-card-time">{formatTime(conv.lastMessage.createdAt)}</span>
                  </div>
                  <div className="inbox-card-preview">
                    {conv.lastMessage.senderId === currentPlayerId ? 'You: ' : ''}
                    {conv.lastMessage.text.length > 60
                      ? conv.lastMessage.text.slice(0, 60) + '...'
                      : conv.lastMessage.text}
                  </div>
                </div>
                {conv.unreadCount > 0 && (
                  <span className="inbox-card-badge">{conv.unreadCount}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { getConversation, sendMessage, markConversationRead } from '../store'
import { DirectMessage } from '../types'
import '../dev/css/baseline-messages.css'

interface Props {
  currentPlayerId: string
  currentPlayerName: string
  otherPlayerId: string
  otherPlayerName: string
  onClose: () => void
  /** When true, rendered inside Inbox full-screen view (hides own header) */
  embedded?: boolean
}

const QUICK_MESSAGES = ['Running late', 'What court?', 'Looking forward to it!']

export default function MessagePanel({ currentPlayerId, currentPlayerName, otherPlayerId, otherPlayerName, onClose, embedded }: Props) {
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [text, setText] = useState('')
  const [showQuick, setShowQuick] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasMountedRef = useRef(false)

  useEffect(() => {
    refresh()
    inputRef.current?.focus({ preventScroll: true })
  }, [currentPlayerId, otherPlayerId])

  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    body.scrollTo({
      top: body.scrollHeight,
      behavior: hasMountedRef.current ? 'smooth' : 'auto',
    })
    hasMountedRef.current = true
  }, [messages.length])

  function refresh() {
    const conv = getConversation(currentPlayerId, otherPlayerId)
    setMessages(conv)
    markConversationRead(currentPlayerId, otherPlayerId)
  }

  function handleSend(msgText?: string) {
    const toSend = (msgText ?? text).trim()
    if (!toSend) return
    sendMessage(currentPlayerId, currentPlayerName, otherPlayerId, otherPlayerName, toSend)
    if (!msgText) setText('')
    setShowQuick(false)
    refresh()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function formatTime(iso: string): string {
    const d = new Date(iso)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    if (isToday) return time
    const day = d.toLocaleDateString([], { weekday: 'short' })
    return `${day} ${time}`
  }

  /** Group consecutive messages from same sender */
  function groupMessages(msgs: DirectMessage[]): { msg: DirectMessage; isFirst: boolean; isLast: boolean }[] {
    return msgs.map((msg, i) => {
      const prev = msgs[i - 1]
      const next = msgs[i + 1]
      const isFirst = !prev || prev.senderId !== msg.senderId
      const isLast = !next || next.senderId !== msg.senderId
      return { msg, isFirst, isLast }
    })
  }

  const grouped = groupMessages(messages)

  return (
    <div className={`chat-messages-panel ${embedded ? 'chat-messages-embedded' : ''}`}>
      {/* Header only shown in standalone (non-embedded) mode */}
      {!embedded && (
        <div className="message-panel-header">
          <div className="message-panel-title-group">
            <div className="workflow-status workflow-status--slate">Message</div>
            <span className="message-panel-name">{otherPlayerName}</span>
          </div>
          <button className="message-panel-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* Messages */}
      <div ref={bodyRef} className="chat-messages-body">
        {messages.length === 0 && (
          <div className="chat-messages-empty">
            <div className="chat-messages-empty-avatar">
              {otherPlayerName[0]?.toUpperCase() ?? '?'}
            </div>
            <p className="chat-messages-empty-name">{otherPlayerName}</p>
            <p className="chat-messages-empty-hint">Send a message to start the conversation</p>
          </div>
        )}
        {grouped.map(({ msg, isFirst, isLast }) => {
          const isMine = msg.senderId === currentPlayerId
          return (
            <div
              key={msg.id}
              className={[
                'chat-bubble-row',
                isMine ? 'chat-bubble-mine' : 'chat-bubble-theirs',
                isFirst ? 'chat-bubble-first' : '',
                isLast ? 'chat-bubble-last' : '',
              ].join(' ')}
            >
              <div className="chat-bubble">
                <span className="chat-bubble-text">{msg.text}</span>
              </div>
              {isLast && (
                <span className="chat-bubble-time">{formatTime(msg.createdAt)}</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Quick replies */}
      {showQuick && (
        <div className="chat-quick-tray">
          {QUICK_MESSAGES.map(qm => (
            <button
              key={qm}
              className="chat-quick-btn"
              onClick={() => handleSend(qm)}
            >
              {qm}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="chat-input-bar">
        <button
          className={`chat-quick-toggle ${showQuick ? 'active' : ''}`}
          onClick={() => setShowQuick(!showQuick)}
          aria-label="Quick replies"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path d="M6 11.5a4 4 0 008 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            <circle cx="7.5" cy="8" r="1" fill="currentColor" />
            <circle cx="12.5" cy="8" r="1" fill="currentColor" />
          </svg>
        </button>
        <input
          ref={inputRef}
          type="text"
          placeholder="Message..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={500}
        />
        <button
          className="chat-send-btn"
          onClick={() => handleSend()}
          disabled={!text.trim()}
          aria-label="Send"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M3 10l14-7-7 14v-7H3z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  )
}

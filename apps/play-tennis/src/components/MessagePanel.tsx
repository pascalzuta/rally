import { useState, useEffect, useRef } from 'react'
import { getConversation, sendMessage, markConversationRead } from '../store'
import { DirectMessage } from '../types'

interface Props {
  currentPlayerId: string
  currentPlayerName: string
  otherPlayerId: string
  otherPlayerName: string
  onClose: () => void
}

const QUICK_MESSAGES = ['Running late', 'What court?', 'Looking forward to it!']

export default function MessagePanel({ currentPlayerId, currentPlayerName, otherPlayerId, otherPlayerName, onClose }: Props) {
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [text, setText] = useState('')
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

  function handleSend() {
    const trimmed = text.trim()
    if (!trimmed) return
    sendMessage(currentPlayerId, currentPlayerName, otherPlayerId, otherPlayerName, trimmed)
    setText('')
    refresh()
  }

  function handleQuickMessage(msg: string) {
    sendMessage(currentPlayerId, currentPlayerName, otherPlayerId, otherPlayerName, msg)
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

  return (
    <div className="message-panel">
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
      <div ref={bodyRef} className="message-panel-body">
        {messages.length === 0 && (
          <p className="message-panel-empty">No messages yet. Say hi!</p>
        )}
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`message-bubble ${msg.senderId === currentPlayerId ? 'message-mine' : 'message-theirs'}`}
          >
            <div className="message-text">{msg.text}</div>
            <div className="message-time">{formatTime(msg.createdAt)}</div>
          </div>
        ))}
      </div>
      <div className="quick-messages">
        {QUICK_MESSAGES.map(qm => (
          <button
            key={qm}
            className="quick-msg-btn"
            onClick={() => handleQuickMessage(qm)}
          >
            {qm}
          </button>
        ))}
      </div>
      <div className="message-panel-input">
        <input
          ref={inputRef}
          type="text"
          placeholder="Type a message..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={500}
        />
        <button
          className="message-send-btn"
          onClick={handleSend}
          disabled={!text.trim()}
          aria-label="Send"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M2 9l14-7-7 14v-7H2z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  )
}

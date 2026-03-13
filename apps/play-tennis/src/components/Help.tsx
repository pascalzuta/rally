import { useState } from 'react'

interface FAQItem {
  question: string
  answer: string
}

const SECTIONS: { title: string; items: FAQItem[] }[] = [
  {
    title: 'How Tournaments Work',
    items: [
      {
        question: 'How do I join a tournament?',
        answer: 'From the Home tab, tap "Join Lobby" to enter the waiting pool for your county. Once enough players join (minimum 4), a tournament is automatically created and matches are scheduled.',
      },
      {
        question: 'What tournament formats are available?',
        answer: 'Rally supports three formats: Single Elimination (knockout), Round Robin (everyone plays everyone), and Group + Knockout (group stage followed by semifinals and a final). The format is chosen automatically based on the number of players.',
      },
      {
        question: 'How are matches scheduled?',
        answer: 'Rally uses your availability preferences to find times that work for both players. When a match is created, the system proposes time slots based on overlapping availability. You can accept, suggest alternatives, or use the "Play Now" feature to find an immediate match.',
      },
      {
        question: 'What happens if I can\'t make a scheduled match?',
        answer: 'If a match isn\'t played within the deadline, the scheduling system escalates — first with reminders, then with a final deadline. If neither player responds, the match may be resolved as a walkover or cancellation.',
      },
    ],
  },
  {
    title: 'How Ratings Work',
    items: [
      {
        question: 'What is my rating?',
        answer: 'Rally uses an Elo rating system, similar to chess. New players start at 1500 (adjusted by experience level). Your rating goes up when you win and down when you lose. Beating higher-rated players earns more points.',
      },
      {
        question: 'How are ratings calculated?',
        answer: 'After each match, ratings are adjusted based on the expected outcome. If you beat someone rated much higher than you, you gain more points because the upset was unlikely. The system finds your true skill level over time.',
      },
      {
        question: 'What do the rating tiers mean?',
        answer: 'Pro (2200+), Semi-pro (2000-2199), Elite (1800-1999), Strong (1600-1799), Club (1400-1599), Beginner (1200-1399), Newcomer (below 1200). These tiers help you understand where you stand relative to other players.',
      },
    ],
  },
  {
    title: 'Scheduling & Playing',
    items: [
      {
        question: 'How do I enter a match score?',
        answer: 'After your match, go to the Tournament tab and tap on your match. Use the score entry to input set scores (e.g. 6-4, 7-5). The system validates tennis scoring rules automatically.',
      },
      {
        question: 'What is "Find Match"?',
        answer: 'Find Match lets you broadcast your availability for an immediate game. Other players in your tournament can see when you\'re free and claim the slot, instantly scheduling a match.',
      },
      {
        question: 'Can I play someone from a different county?',
        answer: 'Tournaments are organized by county to keep matches local and convenient. You can only join the lobby for your registered county.',
      },
    ],
  },
  {
    title: 'Account & Data',
    items: [
      {
        question: 'How do I change my availability?',
        answer: 'Go to the Profile tab, find the availability section, and tap "Edit". You can choose from quick presets like "Weekday evenings" or set specific time slots.',
      },
      {
        question: 'Can I leave a tournament?',
        answer: 'Yes. From the Tournament tab, tap the overflow menu (···) and select "Leave tournament". If the tournament is in progress, your remaining matches will be forfeited.',
      },
      {
        question: 'Is my data stored locally?',
        answer: 'Rally stores your profile and match data both locally on your device and synced to the cloud. This means you can use the app offline and your data will sync when you reconnect.',
      },
    ],
  },
]

export default function Help({ onBack }: { onBack: () => void }) {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set())

  function toggleItem(key: string) {
    const next = new Set(openItems)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setOpenItems(next)
  }

  return (
    <div className="help-content">
      <div className="help-header">
        <button className="score-fs-close" onClick={onBack}>✕</button>
        <h2>Help & FAQ</h2>
      </div>

      {SECTIONS.map((section, si) => (
        <div key={si} className="card faq-section">
          <h3 className="faq-section-title">{section.title}</h3>
          {section.items.map((item, qi) => {
            const key = `${si}-${qi}`
            const isOpen = openItems.has(key)
            return (
              <div key={qi} className="faq-item">
                <button className="faq-question" onClick={() => toggleItem(key)}>
                  <span>{item.question}</span>
                  <span className={`faq-chevron ${isOpen ? 'open' : ''}`}>›</span>
                </button>
                {isOpen && (
                  <div className="faq-answer">{item.answer}</div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

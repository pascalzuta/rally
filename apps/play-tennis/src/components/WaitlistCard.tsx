interface Props {
  county: string
  onUpdateAvailability: () => void
  onFindMatch: () => void
}

export default function WaitlistCard({ county, onUpdateAvailability, onFindMatch }: Props) {
  // Next cycle is next Monday
  const today = new Date()
  const daysUntilMonday = (8 - today.getDay()) % 7 || 7
  const nextMonday = new Date(today)
  nextMonday.setDate(today.getDate() + daysUntilMonday)
  const nextCycleDate = nextMonday.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

  return (
    <div className="waitlist-container">
      {/* Status card */}
      <div className="card waitlist-status-card">
        <div className="waitlist-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12,6 12,12 16,14" />
          </svg>
        </div>
        <div className="waitlist-title">We're finding you a group</div>
        <div className="waitlist-body">
          Your schedule didn't overlap enough with this round's groups. We'll match you in the next round.
        </div>
        <div className="waitlist-next">
          <span className="waitlist-next-label">Next round starts</span>
          <span className="waitlist-next-date">{nextCycleDate}</span>
        </div>
      </div>

      {/* Availability improvement prompt */}
      <div className="card waitlist-improve-card">
        <div className="waitlist-improve-title">Want to match faster?</div>
        <div className="waitlist-improve-body">
          Players with flexible schedules get matched 3x faster. Adding just one more time slot could put you in a group.
        </div>
        <div className="waitlist-improve-suggestion">
          Most players in {county.split(',')[0]} are free Saturday mornings.
        </div>
        <button className="btn btn-primary" onClick={onUpdateAvailability}>
          Update availability
        </button>
      </div>

      {/* Find Match fallback */}
      <div className="card waitlist-findmatch-card">
        <div className="waitlist-findmatch-title">Play this weekend instead?</div>
        <div className="waitlist-findmatch-body">
          Find a one-off match while you wait for the next tournament round.
        </div>
        <button className="btn btn-primary" onClick={onFindMatch}>
          Find a Match
        </button>
      </div>
    </div>
  )
}

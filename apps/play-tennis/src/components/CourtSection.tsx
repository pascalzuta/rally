import { useState } from 'react'
import { Match, MatchCourt, PlayerProfile, Court } from '../types'
import {
  getProfileCourts, setMatchCourt, confirmMatchCourt,
  claimBooking, confirmBooking, addCourt,
} from '../store'

interface Props {
  match: Match
  tournamentId: string
  currentPlayerId: string
  opponentName: string
  opponentProfile?: PlayerProfile
  onUpdated: () => void
}

type ChipState = 'empty' | 'suggested' | 'confirmed' | 'conflict'

function getChipState(court?: MatchCourt): ChipState {
  if (!court) return 'empty'
  if (court.confirmed) return 'confirmed'
  return 'suggested'
}

export default function CourtSection({
  match, tournamentId, currentPlayerId, opponentName, opponentProfile, onUpdated
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [inlineVenue, setInlineVenue] = useState('')
  const [inlineNotes, setInlineNotes] = useState('')
  const [saveToProfile, setSaveToProfile] = useState(false)
  const [showSuggestDifferent, setShowSuggestDifferent] = useState(false)

  const court = match.court
  const chipState = getChipState(court)
  const myCourts = getProfileCourts()

  // Check if both players have "always play here" (conflict)
  const myAlways = myCourts.find(c => c.always_play_here)
  const opponentAlways = (opponentProfile?.courts ?? []).find(c => c.always_play_here)
  const isConflict = !court && myAlways && opponentAlways
  const effectiveState: ChipState = isConflict ? 'conflict' : chipState

  async function handleSetInlineCourt() {
    const trimmed = inlineVenue.trim()
    if (!trimmed) return

    const now = new Date().toISOString()
    const newCourt: MatchCourt = {
      venue_name: trimmed.slice(0, 100),
      source: 'player',
      suggested_by: currentPlayerId,
      confirmed: false,
      booking_needed: false,
      booking_claimed: false,
      booking_confirmed: false,
      cost_applies: false,
      covers_guests: false,
      notes: inlineNotes.trim().slice(0, 300) || undefined,
      created_at: now,
      updated_at: now,
    }

    if (saveToProfile && myCourts.length < 3) {
      addCourt({
        venue_name: newCourt.venue_name,
        booking_needed: false,
        cost_applies: false,
        covers_guests: false,
        always_play_here: false,
        notes: newCourt.notes,
      })
    }

    await setMatchCourt(tournamentId, match.id, newCourt)
    setInlineVenue('')
    setInlineNotes('')
    setSaveToProfile(false)
    onUpdated()
  }

  async function handlePickProfileCourt(court: Court) {
    const now = new Date().toISOString()
    const mc: MatchCourt = {
      venue_name: court.venue_name,
      label: court.label,
      court_id: court.id,
      source: 'player',
      suggested_by: currentPlayerId,
      confirmed: false,
      booking_needed: court.booking_needed,
      booking_claimed: false,
      booking_confirmed: false,
      cost_applies: court.cost_applies,
      cost_description: court.cost_description,
      covers_guests: court.covers_guests,
      guest_instructions: court.guest_instructions,
      notes: court.notes,
      directions_url: court.directions_url,
      created_at: now,
      updated_at: now,
    }
    await setMatchCourt(tournamentId, match.id, mc)
    setShowSuggestDifferent(false)
    onUpdated()
  }

  async function handleConfirm() {
    await confirmMatchCourt(tournamentId, match.id, currentPlayerId)
    onUpdated()
  }

  async function handleClaimBooking() {
    await claimBooking(tournamentId, match.id, currentPlayerId)
    onUpdated()
  }

  async function handleConfirmBooking() {
    await confirmBooking(tournamentId, match.id)
    onUpdated()
  }

  function handleSuggestDifferent() {
    setShowSuggestDifferent(true)
  }

  // Determine who suggested the court (for display)
  const suggestedByMe = court?.suggested_by === currentPlayerId
  const sourceLabel = court?.source === 'auto'
    ? 'Auto-suggested based on your profiles'
    : suggestedByMe
      ? 'You suggested this court'
      : `${opponentName} suggested this court`

  // Booking state
  const bookingState = !court ? 'not_needed'
    : !court.booking_needed ? 'not_needed'
    : court.booking_confirmed ? 'confirmed'
    : court.booking_claimed ? 'claimed'
    : court.court_id && court.suggested_by ? 'implicit_owner'
    : 'unclaimed'

  const isBooker = court?.booking_claimed_by === currentPlayerId ||
    (bookingState === 'implicit_owner' && court?.suggested_by === currentPlayerId)

  return (
    <div className="court-section" onClick={e => e.stopPropagation()}>
      {/* Chip */}
      <button
        className={`court-chip court-chip--${effectiveState}`}
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="court-chip-icon">
          {effectiveState === 'empty' && '○'}
          {effectiveState === 'suggested' && '◐'}
          {effectiveState === 'confirmed' && '●'}
          {effectiveState === 'conflict' && '◑'}
        </span>
        <span className="court-chip-text">
          {effectiveState === 'empty' && 'No court yet'}
          {effectiveState === 'suggested' && `Suggested: ${court!.venue_name}`}
          {effectiveState === 'confirmed' && `${court!.venue_name} \u2713`}
          {effectiveState === 'conflict' && 'Both have home courts \u2014 pick one'}
        </span>
        <span className={`court-chip-chevron ${expanded ? 'court-chip-chevron--open' : ''}`}>
          ›
        </span>
      </button>

      {/* Expanded area */}
      {expanded && (
        <div className="court-expanded">
          {/* STATE: Empty */}
          {effectiveState === 'empty' && !showSuggestDifferent && (
            <div className="court-empty-state">
              <p className="court-empty-hint">
                Chat with {opponentName} to pick a court, or add one here.
              </p>

              {myCourts.length > 0 && (
                <div className="court-profile-picks">
                  <span className="court-picks-label">Your courts:</span>
                  {myCourts.map(c => (
                    <button
                      key={c.id}
                      className="court-pick-pill"
                      onClick={() => handlePickProfileCourt(c)}
                    >
                      {c.venue_name}
                    </button>
                  ))}
                </div>
              )}

              <div className="court-inline-form">
                <input
                  type="text"
                  value={inlineVenue}
                  onChange={e => setInlineVenue(e.target.value)}
                  placeholder="Venue name"
                  maxLength={100}
                />
                <input
                  type="text"
                  value={inlineNotes}
                  onChange={e => setInlineNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  maxLength={300}
                />
                <label className="court-save-check">
                  <input
                    type="checkbox"
                    checked={saveToProfile}
                    onChange={e => setSaveToProfile(e.target.checked)}
                  />
                  Save to my profile
                </label>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSetInlineCourt}
                  disabled={!inlineVenue.trim()}
                >
                  Set Court
                </button>
              </div>
            </div>
          )}

          {/* STATE: Suggested */}
          {effectiveState === 'suggested' && !showSuggestDifferent && court && (
            <div className="court-suggestion">
              <p className="court-source-label">{sourceLabel}</p>
              <CourtDetails court={court} opponentName={opponentName} />

              {/* Booking responsibility */}
              {court.booking_needed && bookingState === 'unclaimed' && (
                <div className="court-booking-prompt">
                  <span>Who's booking?</span>
                  <button className="btn btn-sm btn-primary" onClick={handleClaimBooking}>I'll handle it</button>
                </div>
              )}

              <div className="court-suggestion-actions">
                <button className="btn btn-primary btn-sm" onClick={handleConfirm}>Confirm</button>
                <button className="btn btn-sm" onClick={handleSuggestDifferent}>Suggest Different</button>
              </div>
            </div>
          )}

          {/* STATE: Confirmed */}
          {effectiveState === 'confirmed' && court && (
            <div className="court-confirmed">
              <p className="court-confirmed-label">Court confirmed ✓</p>
              <CourtDetails court={court} opponentName={opponentName} />

              {/* Booking state */}
              <BookingStatus
                bookingState={bookingState}
                court={court}
                isBooker={isBooker}
                opponentName={opponentName}
                onClaimBooking={handleClaimBooking}
                onConfirmBooking={handleConfirmBooking}
              />

              <div className="court-confirmed-actions">
                {court.directions_url && (
                  <a href={court.directions_url} target="_blank" rel="noopener noreferrer" className="court-directions-link">
                    Directions ↗
                  </a>
                )}
                <button className="btn btn-xs court-change-link" onClick={handleSuggestDifferent}>
                  Change Court
                </button>
              </div>
            </div>
          )}

          {/* STATE: Conflict */}
          {effectiveState === 'conflict' && myAlways && opponentAlways && (
            <div className="court-conflict">
              <p className="court-conflict-label">You both have home courts</p>
              <p className="court-conflict-hint">Pick one, or chat to decide:</p>

              <div className="court-conflict-options">
                <div className="court-conflict-card">
                  <div className="court-conflict-name">{myAlways.venue_name} (yours)</div>
                  <div className="court-conflict-meta">
                    {myAlways.booking_needed ? 'Booking needed' : 'No booking'}
                    {myAlways.cost_applies ? ` · ${myAlways.cost_description}` : ''}
                  </div>
                  <button className="btn btn-sm btn-primary" onClick={() => handlePickProfileCourt(myAlways)}>Pick</button>
                </div>

                <div className="court-conflict-card">
                  <div className="court-conflict-name">{opponentAlways.venue_name} ({opponentName}'s)</div>
                  <div className="court-conflict-meta">
                    {opponentAlways.booking_needed ? 'Booking needed' : 'No booking'}
                    {opponentAlways.cost_applies ? ` · ${opponentAlways.cost_description}` : ''}
                  </div>
                  <button className="btn btn-sm" onClick={() => handlePickProfileCourt(opponentAlways)}>Pick</button>
                </div>
              </div>

              <button className="court-different-link" onClick={() => setShowSuggestDifferent(true)}>
                Or suggest a different court
              </button>
            </div>
          )}

          {/* Suggest Different overlay */}
          {showSuggestDifferent && (
            <div className="court-suggest-different">
              {myCourts.length > 0 && (
                <div className="court-profile-picks">
                  <span className="court-picks-label">Your courts:</span>
                  {myCourts.map(c => (
                    <button
                      key={c.id}
                      className="court-pick-pill"
                      onClick={() => handlePickProfileCourt(c)}
                    >
                      {c.venue_name}
                    </button>
                  ))}
                </div>
              )}

              <div className="court-inline-form">
                <input
                  type="text"
                  value={inlineVenue}
                  onChange={e => setInlineVenue(e.target.value)}
                  placeholder="Venue name"
                  maxLength={100}
                />
                <input
                  type="text"
                  value={inlineNotes}
                  onChange={e => setInlineNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  maxLength={300}
                />
                <label className="court-save-check">
                  <input
                    type="checkbox"
                    checked={saveToProfile}
                    onChange={e => setSaveToProfile(e.target.checked)}
                  />
                  Save to my profile
                </label>
                <div className="court-inline-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSetInlineCourt}
                    disabled={!inlineVenue.trim()}
                  >
                    Set Court
                  </button>
                  <button className="btn btn-sm" onClick={() => setShowSuggestDifferent(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* Sub-components */

function CourtDetails({ court, opponentName }: { court: MatchCourt; opponentName: string }) {
  return (
    <div className="court-details">
      <div className="court-details-name">{court.venue_name}</div>
      {court.label && <div className="court-details-label">{court.label}</div>}

      <div className="court-details-meta">
        {court.booking_needed ? 'Booking required' : 'No booking needed'}
        {court.cost_applies && court.cost_description && ` · ${court.cost_description}`}
      </div>

      {court.cost_applies && court.covers_guests && (
        <span className="court-cost-badge">
          {court.cost_description}{court.covers_guests ? ` · Covers your fee` : ''}
        </span>
      )}

      {court.guest_instructions && (
        <div className="court-guest-info">
          <span className="court-guest-label">Guest info</span>
          <span>{court.guest_instructions}</span>
        </div>
      )}

      {court.notes && (
        <div className="court-notes">"{court.notes}"</div>
      )}

      {court.directions_url && (
        <a href={court.directions_url} target="_blank" rel="noopener noreferrer" className="court-directions-link">
          Directions ↗
        </a>
      )}
    </div>
  )
}

function BookingStatus({
  bookingState,
  court,
  isBooker,
  opponentName,
  onClaimBooking,
  onConfirmBooking,
}: {
  bookingState: string
  court: MatchCourt
  isBooker: boolean
  opponentName: string
  onClaimBooking: () => void
  onConfirmBooking: () => void
}) {
  if (bookingState === 'not_needed') return null

  if (bookingState === 'confirmed') {
    return <div className="court-booking-line court-booking-done">Booking confirmed ✓</div>
  }

  if (bookingState === 'claimed' || bookingState === 'implicit_owner') {
    const name = isBooker ? 'You' : opponentName
    return (
      <div className="court-booking-line">
        <span>{name} {isBooker ? 'are' : 'is'} handling the booking</span>
        {isBooker && (
          <button className="btn btn-xs btn-primary" onClick={onConfirmBooking}>
            Confirm booking done
          </button>
        )}
      </div>
    )
  }

  if (bookingState === 'unclaimed') {
    return (
      <div className="court-booking-prompt">
        <span>Who's booking?</span>
        <button className="btn btn-sm btn-primary" onClick={onClaimBooking}>I'll handle it</button>
      </div>
    )
  }

  return null
}

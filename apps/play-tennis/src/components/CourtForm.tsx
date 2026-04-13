import { useState } from 'react'
import { Court } from '../types'

interface Props {
  court?: Court
  onSave: (data: Omit<Court, 'id' | 'sort_order' | 'created_at' | 'updated_at'>) => void
  onCancel: () => void
  onDelete?: () => void
}

export default function CourtForm({ court, onSave, onCancel, onDelete }: Props) {
  const [venueName, setVenueName] = useState(court?.venue_name ?? '')
  const [label, setLabel] = useState(court?.label ?? '')
  const [bookingNeeded, setBookingNeeded] = useState(court?.booking_needed ?? false)
  const [costApplies, setCostApplies] = useState(court?.cost_applies ?? false)
  const [costDescription, setCostDescription] = useState(court?.cost_description ?? '')
  const [coversGuests, setCoversGuests] = useState(court?.covers_guests ?? false)
  const [guestInstructions, setGuestInstructions] = useState(court?.guest_instructions ?? '')
  const [notes, setNotes] = useState(court?.notes ?? '')
  const [directionsUrl, setDirectionsUrl] = useState(court?.directions_url ?? '')
  const [alwaysPlayHere, setAlwaysPlayHere] = useState(court?.always_play_here ?? false)
  const [venueError, setVenueError] = useState('')
  const [urlError, setUrlError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  function handleSave() {
    const trimmed = venueName.trim()
    if (!trimmed) {
      setVenueError('Enter a venue name')
      return
    }
    onSave({
      venue_name: trimmed.slice(0, 100),
      label: label.trim().slice(0, 50) || undefined,
      booking_needed: bookingNeeded,
      cost_applies: costApplies,
      cost_description: costApplies ? costDescription.trim().slice(0, 100) || undefined : undefined,
      covers_guests: costApplies ? coversGuests : false,
      guest_instructions: guestInstructions.trim().slice(0, 300) || undefined,
      notes: notes.trim().slice(0, 300) || undefined,
      directions_url: directionsUrl.trim().slice(0, 500) || undefined,
      always_play_here: alwaysPlayHere,
    })
  }

  function validateUrl() {
    const val = directionsUrl.trim()
    if (val && !val.match(/^https?:\/\/.+/)) {
      setUrlError('Enter a valid URL')
    } else {
      setUrlError('')
    }
  }

  return (
    <div className="court-form-overlay" onClick={onCancel}>
      <div className="court-form-sheet" onClick={e => e.stopPropagation()}>
        <div className="court-form-header">
          <h3>{court ? 'Edit Court' : 'Add Court'}</h3>
          <button className="court-form-close" onClick={onCancel} aria-label="Close">&times;</button>
        </div>

        <div className="court-form-body">
          <div className="court-field">
            <label>Venue name *</label>
            <input
              type="text"
              value={venueName}
              onChange={e => { setVenueName(e.target.value); setVenueError('') }}
              placeholder="e.g. Riverside Park Courts"
              maxLength={100}
              autoFocus
            />
            {venueError && <span className="court-field-error">{venueError}</span>}
          </div>

          <div className="court-field">
            <label>Label (optional)</label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder='e.g. Court 3 (the shaded one)'
              maxLength={50}
            />
          </div>

          <div className="court-toggle-row">
            <span>Booking needed</span>
            <button
              type="button"
              className={`court-toggle ${bookingNeeded ? 'court-toggle--on' : ''}`}
              onClick={() => setBookingNeeded(!bookingNeeded)}
              role="switch"
              aria-checked={bookingNeeded}
            >
              <span className="court-toggle-thumb" />
            </button>
          </div>

          <div className="court-toggle-row">
            <span>Does this cost anything?</span>
            <button
              type="button"
              className={`court-toggle ${costApplies ? 'court-toggle--on' : ''}`}
              onClick={() => setCostApplies(!costApplies)}
              role="switch"
              aria-checked={costApplies}
            >
              <span className="court-toggle-thumb" />
            </button>
          </div>

          {costApplies && (
            <>
              <div className="court-field court-field--indent">
                <label>Cost description</label>
                <input
                  type="text"
                  value={costDescription}
                  onChange={e => setCostDescription(e.target.value)}
                  placeholder="e.g. $8/hr per person"
                  maxLength={100}
                />
              </div>

              <div className="court-toggle-row court-field--indent">
                <span>I cover guests</span>
                <button
                  type="button"
                  className={`court-toggle ${coversGuests ? 'court-toggle--on' : ''}`}
                  onClick={() => setCoversGuests(!coversGuests)}
                  role="switch"
                  aria-checked={coversGuests}
                >
                  <span className="court-toggle-thumb" />
                </button>
              </div>
            </>
          )}

          <div className="court-field">
            <label>Guest instructions (optional)</label>
            <textarea
              value={guestInstructions}
              onChange={e => setGuestInstructions(e.target.value)}
              placeholder='e.g. Meet me in lobby at 9:45, I sign you in'
              maxLength={300}
              rows={2}
            />
            <span className="court-char-count">{guestInstructions.length}/300</span>
          </div>

          <div className="court-field">
            <label>Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder='e.g. Bring water, no fountain nearby'
              maxLength={300}
              rows={2}
            />
            <span className="court-char-count">{notes.length}/300</span>
          </div>

          <div className="court-field">
            <label>Directions link (optional)</label>
            <input
              type="url"
              value={directionsUrl}
              onChange={e => { setDirectionsUrl(e.target.value); setUrlError('') }}
              onBlur={validateUrl}
              placeholder="Paste a Google Maps or Apple Maps link"
              maxLength={500}
            />
            {urlError && <span className="court-field-error">{urlError}</span>}
          </div>

          <div className="court-toggle-row">
            <span>I always want to play here</span>
            <button
              type="button"
              className={`court-toggle ${alwaysPlayHere ? 'court-toggle--on' : ''}`}
              onClick={() => setAlwaysPlayHere(!alwaysPlayHere)}
              role="switch"
              aria-checked={alwaysPlayHere}
            >
              <span className="court-toggle-thumb" />
            </button>
          </div>
        </div>

        <div className="court-form-actions">
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!venueName.trim()}
          >
            Save
          </button>
          <button className="btn" onClick={onCancel}>Cancel</button>
          {court && onDelete && (
            <>
              {showDeleteConfirm ? (
                <div className="court-delete-confirm">
                  <span>Remove {court.venue_name}?</span>
                  <button className="btn btn-danger-sm" onClick={onDelete}>Remove</button>
                  <button className="btn btn-sm" onClick={() => setShowDeleteConfirm(false)}>Keep</button>
                </div>
              ) : (
                <button className="btn btn-danger-text" onClick={() => setShowDeleteConfirm(true)}>Delete</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

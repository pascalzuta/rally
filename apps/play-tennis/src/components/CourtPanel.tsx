import { useState } from 'react'
import { Match, Tournament } from '../types'
import {
  claimCaptain,
  initLegacyCourt,
  requestCaptainDelegation,
  respondCaptainDelegation,
  withdrawCaptainDelegation,
  setCourtSecured,
  setCourtVenue,
} from '../store'
import {
  MarinVenue,
  getVenue,
  defaultVenues,
  allSelectableVenues,
} from '../marinVenues'
import { ConfirmationTone } from './Toast'

interface Props {
  tournament: Tournament
  match: Match
  currentPlayerId: string
  onUpdated: () => void
  onAction?: (message: string, tone: ConfirmationTone) => void
}

function firstName(name: string | undefined): string {
  return name?.split(' ')[0] ?? 'Player'
}

/** Selection-list caption per reservation method. */
function methodCaption(v: MarinVenue): string {
  switch (v.reservationMethod) {
    case 'walk-on': return v.feeNote ?? 'Free · first-come, first-served'
    case 'reserve-online': return v.isPaid ? (v.feeNote ?? 'Paid — captain pays') : (v.feeNote ?? 'Free · reservable online')
    case 'key-required': return `Annual key required — ${v.keyNote ?? 'key needed'}`
    case 'members-only': return 'Private club — members only'
    case 'school-walk-on': return v.feeNote ?? 'Public when not in class use'
  }
}

/** Honest helper/barrier copy the captain sees for the chosen venue. */
function captainHelper(v: MarinVenue | undefined): string | null {
  if (!v) return null
  switch (v.reservationMethod) {
    case 'walk-on': return 'Walk-on court — no reservation. Whoever gets there first holds it.'
    case 'school-walk-on': return 'Open to the public sunrise–sunset when not reserved for classes.'
    case 'reserve-online': return v.isPaid
      ? `Paid court — the captain covers it (${v.feeNote ?? 'fee applies'}). Rally doesn't handle payment yet.`
      : 'Reserve through the site, then mark it secured here.'
    case 'key-required': return `This court needs an annual key (${v.keyNote ?? 'key required'}). Only pick it if the captain has a key.`
    case 'members-only': return 'Members-only club. Only pick it if the captain is a member.'
  }
}

/** What the non-captain sees about the court. */
function nonCaptainStatusLine(v: MarinVenue | undefined, venueLabel: string | undefined, captainName: string): string {
  if (!v) return venueLabel ? `${captainName} chose ${venueLabel}.` : 'No court chosen yet.'
  switch (v.reservationMethod) {
    case 'walk-on':
    case 'school-walk-on': return `${captainName} will grab a court on arrival.`
    case 'reserve-online': return v.isPaid
      ? `${captainName} is booking a paid court (${v.feeNote ?? 'fee applies'}).`
      : `${captainName} is reserving this court online.`
    case 'key-required': return `${captainName} — this court needs a key (${v.keyNote ?? 'key required'}).`
    case 'members-only': return `${captainName} — members-only club.`
  }
}

function secureLabel(v: MarinVenue | undefined): string {
  if (v && (v.reservationMethod === 'walk-on' || v.reservationMethod === 'school-walk-on')) {
    return "I'll arrive first — mark secured"
  }
  return 'Mark court secured'
}

export default function CourtPanel({ tournament, match, currentPlayerId, onUpdated, onAction }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [otherText, setOtherText] = useState('')
  const [busy, setBusy] = useState(false)

  const schedule = match.schedule
  if (!schedule) return null

  const me = currentPlayerId
  const p1 = match.player1Id
  const p2 = match.player2Id
  const isParticipant = me === p1 || me === p2
  const otherId = me === p1 ? p2 : p1
  const nameOf = (id: string | null | undefined) =>
    firstName(tournament.players.find(p => p.id === id)?.name)

  const court = schedule.court
  const captainId = court?.captainId ?? null
  const captainIsParticipant = !!captainId && (captainId === p1 || captainId === p2)
  const isCaptain = !!captainId && captainId === me
  const captainName = nameOf(captainId)
  const opponentName = nameOf(otherId)
  const neg = court?.negotiation?.status === 'pending' ? court.negotiation : undefined
  const venue = getVenue(court?.venueId)
  const venueName = venue?.name ?? (court?.venueId === 'other' ? court?.venueLabel : undefined)
  const secured = court?.status === 'secured'
  const isCompleted = Boolean(match.completed || match.scoreReportedBy || match.scoreConfirmedAt)

  function notify(message: string, tone: ConfirmationTone) {
    if (onAction) onAction(message, tone)
    else onUpdated()
  }

  async function run(fn: () => Promise<unknown>, done?: () => void) {
    if (busy) return
    setBusy(true)
    try {
      await fn()
      done?.()
    } catch (err) {
      console.error('[Court] action failed:', err)
    } finally {
      setBusy(false)
      onUpdated()
    }
  }

  async function handlePickVenue(venueId: string, label?: string) {
    await run(
      () => setCourtVenue(tournament.id, match.id, me, venueId, label),
      () => {
        setPickerOpen(false)
        setOtherText('')
        const name = venueId === 'other' ? (label ?? 'your court') : (getVenue(venueId)?.name ?? 'court')
        notify(`Court set: ${name}.`, 'blue')
      }
    )
  }

  async function handleClaim() {
    await run(async () => {
      const res = await claimCaptain(tournament.id, match.id, me)
      if (!res.ok) {
        const winner = nameOf(res.winnerId)
        notify(`${winner} already volunteered to be captain.`, 'blue')
      } else {
        notify("You're the court captain.", 'green')
      }
    })
  }

  async function handleInitLegacy() {
    await run(async () => {
      const res = await initLegacyCourt(tournament.id, match.id, me)
      if (res.ok) notify("You're the court captain.", 'green')
    })
  }

  async function handleDelegate() {
    await run(
      () => requestCaptainDelegation(tournament.id, match.id, me),
      () => notify(`Asked ${opponentName} to secure the court.`, 'blue')
    )
  }

  async function handleRespond(response: 'accept' | 'decline') {
    await run(
      () => respondCaptainDelegation(tournament.id, match.id, me, response),
      () => notify(response === 'accept' ? 'You took over as court captain.' : 'You passed on captain duty.', response === 'accept' ? 'green' : 'blue')
    )
  }

  async function handleWithdraw() {
    await run(() => withdrawCaptainDelegation(tournament.id, match.id, me))
  }

  async function handleSecure(next: boolean) {
    await run(
      () => setCourtSecured(tournament.id, match.id, me, next),
      () => notify(next ? 'Court secured ✓' : 'Court marked not secured.', next ? 'green' : 'blue')
    )
  }

  function openReservation() {
    if (venue?.reservationUrl) window.open(venue.reservationUrl, '_blank', 'noopener,noreferrer')
  }

  // ---- Read-only summary for non-participants ----
  if (!isParticipant) {
    if (!court || !captainIsParticipant) return null
    return (
      <div className="court-panel court-panel--readonly">
        <div className="court-line">
          <span className="court-captain-name">{captainName}</span> is securing the court
          {venueName ? <> · {venueName}</> : null}
          {secured ? <span className="court-secured-check"> · secured ✓</span> : null}
        </div>
      </div>
    )
  }

  // ---- Legacy / orphaned: no valid captain yet ----
  if (!court || !captainIsParticipant) {
    return (
      <div className="court-panel">
        <div className="court-empty">
          <div className="court-empty-title">Who's securing the court?</div>
          <div className="court-empty-copy">Pick a court and take charge of getting it.</div>
          <button className="btn btn-primary btn-small" disabled={busy} onClick={(e) => { e.stopPropagation(); handleInitLegacy() }}>
            I'll secure the court
          </button>
        </div>
      </div>
    )
  }

  const helper = captainHelper(venue)

  return (
    <div className="court-panel">
      {/* Venue row */}
      <div className="court-venue-row">
        <span className="court-venue-label">Court</span>
        <span className="court-venue-value">{venueName ?? 'Not chosen yet'}</span>
        {!isCompleted && (
          <button className="btn-link court-change" disabled={busy} onClick={(e) => { e.stopPropagation(); setPickerOpen(o => !o) }}>
            {venueName ? 'Change' : 'Choose'}
          </button>
        )}
      </div>

      {pickerOpen && !isCompleted && (
        <div className="court-picker">
          <div className="court-picker-list">
            {(showAll ? allSelectableVenues() : defaultVenues()).map(v => (
              <button
                key={v.id}
                className={`court-venue-option ${court?.venueId === v.id ? 'is-selected' : ''}`}
                disabled={busy}
                onClick={(e) => { e.stopPropagation(); handlePickVenue(v.id) }}
              >
                <span className="cvo-name">{v.name}</span>
                <span className="cvo-city">{v.city}</span>
                <span className="cvo-caption">{methodCaption(v)}</span>
              </button>
            ))}
          </div>
          {!showAll && (
            <button className="btn-link court-showall" disabled={busy} onClick={(e) => { e.stopPropagation(); setShowAll(true) }}>
              Show all courts (incl. paid, key & members-only)
            </button>
          )}
          <div className="court-other">
            <input
              className="court-other-input"
              placeholder="Other court…"
              value={otherText}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setOtherText(e.target.value)}
            />
            <button
              className="btn btn-small"
              disabled={busy || otherText.trim().length === 0}
              onClick={(e) => { e.stopPropagation(); handlePickVenue('other', otherText.trim()) }}
            >
              Use
            </button>
          </div>
        </div>
      )}

      {/* Captain row */}
      <div className="court-captain-row">
        {neg && neg.requestedTo === me ? (
          <>
            <div className="court-captain-line">
              <span className="court-captain-name">{captainName}</span> asked you to secure the court.
            </div>
            {!isCompleted && (
              <div className="court-actions">
                <button className="btn btn-primary btn-small" disabled={busy} onClick={(e) => { e.stopPropagation(); handleRespond('accept') }}>Accept</button>
                <button className="btn btn-small" disabled={busy} onClick={(e) => { e.stopPropagation(); handleRespond('decline') }}>Decline</button>
              </div>
            )}
          </>
        ) : neg && neg.requestedBy === me ? (
          <>
            <div className="court-captain-line">Waiting for {opponentName} to accept captain duty.</div>
            {!isCompleted && (
              <button className="btn btn-small" disabled={busy} onClick={(e) => { e.stopPropagation(); handleWithdraw() }}>Cancel request</button>
            )}
          </>
        ) : isCaptain ? (
          <>
            <div className="court-captain-line">
              <span className="court-captain-badge">You're captain</span>
              {secured ? <span className="court-secured-check"> · Court secured ✓</span> : null}
            </div>
            {helper && !secured ? <div className="court-helper">{helper}</div> : null}
            {!isCompleted && (
              <div className="court-actions">
                {!venue && !venueName ? (
                  <button className="btn btn-primary btn-small" disabled={busy} onClick={(e) => { e.stopPropagation(); setPickerOpen(true) }}>Choose where you'll play</button>
                ) : secured ? (
                  <button className="btn btn-small" disabled={busy} onClick={(e) => { e.stopPropagation(); handleSecure(false) }}>Un-secure</button>
                ) : (
                  <>
                    {venue?.reservationMethod === 'reserve-online' && (
                      <button className="btn btn-small" disabled={busy} onClick={(e) => { e.stopPropagation(); openReservation() }}>
                        {venue.isPaid ? `Reserve online (you'll pay ${venue.feeNote ?? 'a fee'})` : 'Reserve online'}
                      </button>
                    )}
                    <button className="btn btn-primary btn-small" disabled={busy} onClick={(e) => { e.stopPropagation(); handleSecure(true) }}>{secureLabel(venue)}</button>
                  </>
                )}
                <button className="btn-link court-handoff" disabled={busy} onClick={(e) => { e.stopPropagation(); handleDelegate() }}>Ask {opponentName} to take it</button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="court-captain-line">
              <span className="court-captain-name">{captainName}</span> is captain.
              {secured ? <span className="court-secured-check"> Court secured ✓</span> : null}
            </div>
            <div className="court-helper">{nonCaptainStatusLine(venue, court?.venueLabel, captainName)}</div>
            {!isCompleted && !secured && (
              <button className="btn btn-small court-takeover" disabled={busy} onClick={(e) => { e.stopPropagation(); handleClaim() }}>I'll take it instead</button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

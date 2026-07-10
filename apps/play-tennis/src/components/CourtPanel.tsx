import { useState } from 'react'
import { Match, Tournament } from '../types'
import { getItem, setItem } from '../memoryStore'
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

/** Shown once per device, the first time a player is getting the court. */
const COURT_EXPLAINER_KEY = 'rally-court-getter-explainer-seen'

function firstName(name: string | undefined): string {
  return name?.split(' ')[0] ?? 'Player'
}

/** Selection-list caption: access first, venue facts appended. */
function methodCaption(v: MarinVenue): string {
  const facts = v.feeNote ? ` · ${v.feeNote}` : ''
  switch (v.reservationMethod) {
    case 'walk-on': return `Free · first-come${facts}`
    case 'reserve-online': return v.isPaid
      ? `Paid · ${v.feeNote ?? 'whoever gets the court pays'}`
      : `Free · reservable online${facts}`
    case 'key-required': return `Annual key required — ${v.keyNote ?? 'key needed'}`
    case 'members-only': return 'Private club — members only'
    case 'school-walk-on': return `Public when not in class${facts}`
  }
}

/** Honest helper/barrier copy the court-getter sees for the chosen venue. */
function captainHelper(v: MarinVenue | undefined): string | null {
  if (!v) return null
  switch (v.reservationMethod) {
    case 'walk-on': return 'Walk-on court — no reservation. Whoever gets there first holds it.'
    case 'school-walk-on': return 'Open to the public sunrise–sunset when not reserved for classes.'
    case 'reserve-online': return v.isPaid
      ? `Paid court — you'll cover it (${v.feeNote ?? 'fee applies'}). Rally doesn't handle payment yet.`
      : 'Reserve through the site, then mark it secured here.'
    case 'key-required': return `This court needs an annual key (${v.keyNote ?? 'key required'}). Only pick it if you have a key.`
    case 'members-only': return "Members-only club. Only pick it if you're a member."
  }
}

/** What the other player sees about the court (renders under "{name} is getting the court"). */
function nonCaptainStatusLine(v: MarinVenue | undefined, venueLabel: string | undefined): string {
  if (!v) return venueLabel ? `Custom court: ${venueLabel}.` : 'No court picked yet.'
  switch (v.reservationMethod) {
    case 'walk-on':
    case 'school-walk-on': return "They'll grab a court on arrival."
    case 'reserve-online': return v.isPaid
      ? `They're booking a paid court (${v.feeNote ?? 'fee applies'}).`
      : "They're reserving this court online."
    case 'key-required': return `Heads up — this court needs a key (${v.keyNote ?? 'key required'}).`
    case 'members-only': return 'Heads up — members-only club.'
  }
}

function secureLabel(v: MarinVenue | undefined): string {
  if (v && (v.reservationMethod === 'walk-on' || v.reservationMethod === 'school-walk-on')) {
    return "I'll grab the court"
  }
  return 'Mark court secured'
}

/**
 * The COURT section of the expanded confirmed card (approved variant A′):
 * flat — the labeled section is the group, no nested box. Status is carried
 * by text color (amber = not picked, green = secured), never a rail.
 */
export default function CourtPanel({ tournament, match, currentPlayerId, onUpdated, onAction }: Props) {
  // Deep-link from "Pick a court" on the collapsed card: when the panel opens
  // with a captain assigned but no venue chosen, start with the picker open.
  const [pickerOpen, setPickerOpen] = useState(() => {
    const c = match.schedule?.court
    return Boolean(c && !c.venueId && (currentPlayerId === match.player1Id || currentPlayerId === match.player2Id))
  })
  const [showAll, setShowAll] = useState(false)
  const [otherText, setOtherText] = useState('')
  const [busy, setBusy] = useState(false)
  // First-run explainer: shown once (ever, per device) the first time you're
  // the one getting the court, so "You're getting the court" is never a mystery.
  const [explainerDismissed, setExplainerDismissed] = useState(() => {
    try { return getItem(COURT_EXPLAINER_KEY) === '1' } catch { return false }
  })
  function dismissExplainer() {
    setExplainerDismissed(true)
    try { setItem(COURT_EXPLAINER_KEY, '1') } catch { /* ignore */ }
  }

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
  const showExplainer = isCaptain && !explainerDismissed
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
        notify(`${winner} is already getting the court.`, 'blue')
      } else {
        notify("You're getting the court.", 'green')
      }
    })
  }

  async function handleInitLegacy() {
    await run(async () => {
      const res = await initLegacyCourt(tournament.id, match.id, me)
      if (res.ok) notify("You're getting the court.", 'green')
    })
  }

  async function handleDelegate() {
    await run(
      () => requestCaptainDelegation(tournament.id, match.id, me),
      () => notify(`Asked ${opponentName} to get the court.`, 'blue')
    )
  }

  async function handleRespond(response: 'accept' | 'decline') {
    await run(
      () => respondCaptainDelegation(tournament.id, match.id, me, response),
      () => notify(response === 'accept' ? "You're getting the court now." : 'You passed on getting the court.', response === 'accept' ? 'green' : 'blue')
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

  function sectionHead(action?: { label: string; onClick: () => void }) {
    return (
      <div className="sched-sect-head">
        <span className="sched-sect-title">Court</span>
        {action && !isCompleted ? (
          <button className="sched-sect-action" disabled={busy} onClick={(e) => { e.stopPropagation(); action.onClick() }}>
            {action.label}
          </button>
        ) : null}
      </div>
    )
  }

  // ---- Read-only summary for non-participants ----
  if (!isParticipant) {
    if (!court || !captainIsParticipant) return null
    return (
      <div className="sched-sect court-sect">
        {sectionHead()}
        <div className="court-line">
          <span className="court-captain-name">{captainName}</span> is getting the court
          {venueName ? <> · {venueName}</> : null}
          {secured ? <span className="court-secured-check"> · secured ✓</span> : null}
        </div>
      </div>
    )
  }

  // ---- Legacy / orphaned: no valid captain yet ----
  if (!court || !captainIsParticipant) {
    return (
      <div className="sched-sect court-sect">
        {sectionHead()}
        <div className="court-empty">
          <div className="court-empty-title">Who's getting the court?</div>
          <div className="court-empty-copy">One of you grabs a free walk-on court on arrival, or reserves one. Rally doesn't book it for you.</div>
          <button className="btn btn-primary btn-small" disabled={busy} onClick={(e) => { e.stopPropagation(); handleInitLegacy() }}>
            I'll get the court
          </button>
        </div>
      </div>
    )
  }

  const helper = captainHelper(venue)

  return (
    <div className="sched-sect court-sect">
      {sectionHead(venueName ? { label: 'Change court', onClick: () => setPickerOpen(o => !o) } : undefined)}

      {/* Venue line: settled fact once picked, amber status until then. */}
      {venueName ? (
        <div className="court-venue-line">
          <b>{venueName}</b>
          {venue?.city ? <span className="court-venue-city"> · {venue.city}</span> : null}
        </div>
      ) : (
        <div className="court-status-unset">Not picked yet</div>
      )}

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
              Show all courts
            </button>
          )}
          <div className="court-other">
            <input
              type="text"
              className="court-other-input"
              placeholder="Other court…"
              aria-label="Other court name"
              value={otherText}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setOtherText(e.target.value)}
            />
            <button
              className="btn btn-secondary btn-small"
              disabled={busy || otherText.trim().length === 0}
              onClick={(e) => { e.stopPropagation(); handlePickVenue('other', otherText.trim()) }}
            >
              Set
            </button>
          </div>
        </div>
      )}

      {/* Captain row */}
      <div className="court-captain-row">
        {neg && neg.requestedTo === me ? (
          <>
            <div className="court-captain-line">
              <span className="court-captain-name">{captainName}</span> asked if you can get the court.
            </div>
            {!isCompleted && (
              <div className="court-actions">
                <button className="btn btn-primary btn-small" disabled={busy} onClick={(e) => { e.stopPropagation(); handleRespond('accept') }}>Accept</button>
                <button className="btn btn-outline btn-small" disabled={busy} onClick={(e) => { e.stopPropagation(); handleRespond('decline') }}>Decline</button>
              </div>
            )}
          </>
        ) : neg && neg.requestedBy === me ? (
          <>
            <div className="court-captain-line">Waiting for {opponentName} to take it over.</div>
            {!isCompleted && (
              <button className="btn btn-outline btn-small" disabled={busy} onClick={(e) => { e.stopPropagation(); handleWithdraw() }}>Cancel request</button>
            )}
          </>
        ) : isCaptain ? (
          <>
            <div className="court-captain-line">
              <span className="court-captain-badge">You're getting the court</span>
              {secured ? <span className="court-secured-check"> · Court secured ✓</span> : null}
            </div>
            {showExplainer && (
              <div className="court-explainer">
                <div className="court-explainer-body">
                  That just means you'll make sure there's a court when you play — grab a free
                  walk-on court when you arrive, or reserve one if the venue needs it. Rally
                  doesn't book it for you. Not up for it? Hand it to {opponentName} in a tap.
                </div>
                <button
                  className="btn-link court-explainer-dismiss"
                  onClick={(e) => { e.stopPropagation(); dismissExplainer() }}
                >
                  Got it
                </button>
              </div>
            )}
            {!venueName && !secured ? (
              <div className="court-helper">Pick where you'll play.</div>
            ) : helper && !secured ? (
              <div className="court-helper">{helper}</div>
            ) : null}
            {!isCompleted && (
              <div className="court-actions">
                {!venue && !venueName ? (
                  !pickerOpen && (
                    <button className="btn btn-primary btn-small" disabled={busy} onClick={(e) => { e.stopPropagation(); setPickerOpen(true) }}>Pick a court</button>
                  )
                ) : secured ? (
                  <button className="btn btn-outline btn-small" disabled={busy} onClick={(e) => { e.stopPropagation(); handleSecure(false) }}>Undo</button>
                ) : venue?.reservationMethod === 'reserve-online' ? (
                  <>
                    {/* Reserve first (primary), then mark secured (secondary). */}
                    <button className="btn btn-primary btn-small" disabled={busy} onClick={(e) => { e.stopPropagation(); openReservation() }}>
                      Reserve online ↗
                    </button>
                    <button className="btn btn-secondary btn-small" disabled={busy} onClick={(e) => { e.stopPropagation(); handleSecure(true) }}>Mark court secured</button>
                  </>
                ) : (
                  <button className="btn btn-primary btn-small" disabled={busy} onClick={(e) => { e.stopPropagation(); handleSecure(true) }}>{secureLabel(venue)}</button>
                )}
                <button className="btn-link court-handoff" disabled={busy} onClick={(e) => { e.stopPropagation(); handleDelegate() }}>Ask {opponentName} to get it instead</button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="court-captain-line">
              <span className="court-captain-name">{captainName}</span> is getting the court.
              {secured ? <span className="court-secured-check"> Court secured ✓</span> : null}
            </div>
            <div className="court-helper">{nonCaptainStatusLine(venue, court?.venueLabel)}</div>
            {!isCompleted && !secured && (
              <button className="btn btn-secondary btn-small court-takeover" disabled={busy} onClick={(e) => { e.stopPropagation(); handleClaim() }}>I'll get it instead</button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

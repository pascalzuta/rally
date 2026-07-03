import { ReservationMethod, VenueAccessType } from './types'

// Court booking negotiation — Marin County venue directory (V1).
// Static bundled reference data (like counties.ts): no table, no migration.
// The array below is the single source of truth for the venue count.

export interface MarinVenue {
  id: string                    // slug, stored in court.venueId
  name: string
  city: string
  accessType: VenueAccessType
  reservationMethod: ReservationMethod
  reservationUrl?: string       // present for reserve-online
  feeNote?: string              // display copy only — never used for money semantics
  keyNote?: string              // present for key-required
  isPaid: boolean               // explicit money semantics (no regex sniffing of feeNote)
  inDefaults: boolean           // true only for free walk-on + free reserve-online
}

export const MARIN_VENUES: MarinVenue[] = [
  { id: 'albert-park', name: 'Albert Park', city: 'San Rafael', accessType: 'public-free', reservationMethod: 'walk-on', feeNote: '4 courts', isPaid: false, inDefaults: true },
  { id: 'freitas-park', name: 'Freitas Park', city: 'San Rafael', accessType: 'public-free', reservationMethod: 'walk-on', isPaid: false, inDefaults: true },
  { id: 'peacock-gap', name: 'Peacock Gap Park', city: 'San Rafael', accessType: 'public-free', reservationMethod: 'walk-on', feeNote: '2 courts', isPaid: false, inDefaults: true },
  { id: 'mcinnis-park', name: 'McInnis Park', city: 'San Rafael', accessType: 'public-reservable', reservationMethod: 'reserve-online', reservationUrl: 'https://reserve.marincountyparks.org', feeNote: '$13/hr · 2hr min', isPaid: true, inDefaults: false },
  { id: 'marin-tennis-club', name: 'Marin Tennis Club', city: 'San Rafael', accessType: 'private-club', reservationMethod: 'members-only', isPaid: false, inDefaults: false },
  { id: 'boyle-park', name: 'Boyle Park', city: 'Mill Valley', accessType: 'public-free', reservationMethod: 'walk-on', feeNote: '6 courts', isPaid: false, inDefaults: true },
  { id: 'eastwood-park', name: 'Eastwood Park', city: 'Mill Valley', accessType: 'public-free', reservationMethod: 'walk-on', feeNote: '2 courts · shared with pickleball', isPaid: false, inDefaults: true },
  { id: 'strawberry-rec', name: 'Strawberry Rec District', city: 'Mill Valley (Strawberry)', accessType: 'private-club', reservationMethod: 'members-only', isPaid: false, inDefaults: false },
  { id: 'pioneer-park', name: 'Pioneer Park', city: 'Novato', accessType: 'public-free', reservationMethod: 'walk-on', feeNote: 'Open 6a–10p', isPaid: false, inDefaults: true },
  { id: 'bay-club-rolling-hills', name: 'Bay Club Rolling Hills', city: 'Novato', accessType: 'private-club', reservationMethod: 'members-only', isPaid: false, inDefaults: false },
  { id: 'larkspur-courts', name: 'Larkspur Courts', city: 'Larkspur', accessType: 'public-free', reservationMethod: 'walk-on', feeNote: '8 courts', isPaid: false, inDefaults: true },
  { id: 'corte-madera-town-park', name: 'Corte Madera Town Park', city: 'Corte Madera', accessType: 'public-reservable', reservationMethod: 'reserve-online', reservationUrl: 'https://rec.us/cortemadera', feeNote: 'open play 10a–1p', isPaid: false, inDefaults: true },
  { id: 'granada-park', name: 'Granada Park', city: 'Corte Madera', accessType: 'public-reservable', reservationMethod: 'reserve-online', reservationUrl: 'https://rec.us/cortemadera', isPaid: false, inDefaults: true },
  { id: 'marinship-park', name: 'Marinship Park', city: 'Sausalito', accessType: 'public-reservable', reservationMethod: 'reserve-online', reservationUrl: 'https://www.sausalito.gov/departments/parks-recreation', feeNote: 'Paid · book up to 90 days ahead', isPaid: true, inDefaults: false },
  { id: 'the-ranch-tiburon', name: 'The Ranch', city: 'Tiburon', accessType: 'public-reservable', reservationMethod: 'key-required', keyNote: 'Annual key required to use online reservations', isPaid: false, inDefaults: false },
  { id: 'tiburon-linear-park', name: 'Tiburon Linear Park', city: 'Tiburon', accessType: 'public-free', reservationMethod: 'walk-on', isPaid: false, inDefaults: true },
  { id: 'tiburon-peninsula-club', name: 'Tiburon Peninsula Club', city: 'Tiburon', accessType: 'private-club', reservationMethod: 'members-only', isPaid: false, inDefaults: false },
  { id: 'belvedere-tennis-club', name: 'Belvedere Tennis Club', city: 'Belvedere/Tiburon', accessType: 'private-club', reservationMethod: 'members-only', isPaid: false, inDefaults: false },
  { id: 'memorial-park-sa', name: 'Memorial Park', city: 'San Anselmo', accessType: 'public-reservable', reservationMethod: 'key-required', keyNote: 'Annual key $41 resident / $98 non-resident, bought in person', isPaid: false, inDefaults: false },
  { id: 'robson-harrington', name: 'Robson Harrington Park', city: 'San Anselmo', accessType: 'public-reservable', reservationMethod: 'key-required', keyNote: 'Same annual key as Memorial Park', isPaid: false, inDefaults: false },
  { id: 'canon-swim-tennis', name: 'Canon Swim & Tennis Club', city: 'Fairfax', accessType: 'private-club', reservationMethod: 'members-only', isPaid: false, inDefaults: false },
  { id: 'ross-commons', name: 'Ross Commons', city: 'Ross', accessType: 'public-free', reservationMethod: 'walk-on', isPaid: false, inDefaults: true },
  { id: 'lagunitas-cc', name: 'Lagunitas Country Club', city: 'Ross', accessType: 'private-club', reservationMethod: 'members-only', isPaid: false, inDefaults: false },
  { id: 'bay-club-ross-valley', name: 'Bay Club Ross Valley', city: 'San Anselmo', accessType: 'private-club', reservationMethod: 'members-only', isPaid: false, inDefaults: false },
  { id: 'college-of-marin', name: 'College of Marin (Kentfield)', city: 'Kentfield', accessType: 'school', reservationMethod: 'school-walk-on', feeNote: '6 courts · sunrise–sunset', isPaid: false, inDefaults: true },
]

/** Match the exact stored county form ('Marin County, CA') plus defensive short forms. */
export function isMarinCounty(county: string | null | undefined): boolean {
  if (!county) return false
  const c = county.trim().toLowerCase()
  return c === 'marin county, ca' || c === 'marin' || c.startsWith('marin county')
}

export function getVenue(id: string | null | undefined): MarinVenue | undefined {
  if (!id || id === 'other') return undefined
  return MARIN_VENUES.find(v => v.id === id)
}

/** Default suggestions: free walk-on + free reserve-online only. */
export function defaultVenues(): MarinVenue[] {
  return MARIN_VENUES.filter(v => v.inDefaults)
}

/** Everything selectable behind "show all courts". */
export function allSelectableVenues(): MarinVenue[] {
  return MARIN_VENUES
}

/** True when the captain should expect to pay. Reads the explicit field — never parses feeNote. */
export function isPaidVenue(v: MarinVenue): boolean {
  return v.isPaid
}

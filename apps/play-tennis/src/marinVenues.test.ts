import { describe, it, expect } from 'vitest'
import { MARIN_VENUES, defaultVenues, allSelectableVenues, getVenue, isPaidVenue, isMarinCounty } from './marinVenues'

describe('marinVenues directory', () => {
  it('has 25 venues, 12 in defaults', () => {
    expect(allSelectableVenues().length).toBe(25)
    expect(defaultVenues().length).toBe(12)
  })

  it('no default venue is paid (locked decision #3)', () => {
    expect(defaultVenues().every(v => !v.isPaid)).toBe(true)
  })

  it('only McInnis and Marinship are paid', () => {
    const paid = MARIN_VENUES.filter(isPaidVenue).map(v => v.id).sort()
    expect(paid).toEqual(['marinship-park', 'mcinnis-park'])
  })

  it('getVenue resolves slugs and ignores other/null', () => {
    expect(getVenue('mcinnis-park')?.feeNote).toContain('$13')
    expect(getVenue('other')).toBeUndefined()
    expect(getVenue(null)).toBeUndefined()
    expect(getVenue('not-a-real-court')).toBeUndefined()
  })

  it('venue ids are unique', () => {
    const ids = MARIN_VENUES.map(v => v.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('isMarinCounty gate', () => {
  it('matches the stored census form and defensive short forms', () => {
    expect(isMarinCounty('Marin County, CA')).toBe(true)
    expect(isMarinCounty('marin')).toBe(true)
    expect(isMarinCounty('  Marin County  ')).toBe(true)
  })
  it('rejects other counties and empty', () => {
    expect(isMarinCounty('Napa County, CA')).toBe(false)
    expect(isMarinCounty('Sonoma County, CA')).toBe(false)
    expect(isMarinCounty(null)).toBe(false)
    expect(isMarinCounty(undefined)).toBe(false)
    expect(isMarinCounty('')).toBe(false)
  })
})

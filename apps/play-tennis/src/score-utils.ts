// Shared tennis score validation utilities

export type SetScores = Array<[string, string]>

export function isValidSet(s1: number, s2: number): boolean {
  // Standard set: one player reaches 6 with 2+ game lead
  if (s1 === 6 && s2 <= 4) return true
  if (s2 === 6 && s1 <= 4) return true
  // 7-5 is valid
  if (s1 === 7 && s2 === 5) return true
  if (s2 === 7 && s1 === 5) return true
  // Tiebreak: 7-6
  if (s1 === 7 && s2 === 6) return true
  if (s2 === 7 && s1 === 6) return true
  return false
}

export function getScores(sets: SetScores): { score1: number[]; score2: number[] } | null {
  const score1: number[] = []
  const score2: number[] = []
  for (const [s1, s2] of sets) {
    if (s1 === '' && s2 === '') continue
    const n1 = parseInt(s1, 10)
    const n2 = parseInt(s2, 10)
    if (isNaN(n1) || isNaN(n2) || n1 < 0 || n2 < 0) return null
    if (!isValidSet(n1, n2)) return null
    score1.push(n1)
    score2.push(n2)
  }
  return score1.length > 0 ? { score1, score2 } : null
}

export function determineWinnerIndex(score1: number[], score2: number[]): 0 | 1 | null {
  let sets1 = 0
  let sets2 = 0
  for (let i = 0; i < score1.length; i++) {
    if (score1[i] > score2[i]) sets1++
    else if (score2[i] > score1[i]) sets2++
  }
  if (sets1 >= 2) return 0
  if (sets2 >= 2) return 1
  return null
}

export function setValidation(sets: SetScores, setIndex: number): string | null {
  const [s1, s2] = sets[setIndex]
  if (s1 === '' && s2 === '') return null
  if (s1 === '' || s2 === '') return 'Enter both scores'
  const n1 = parseInt(s1, 10)
  const n2 = parseInt(s2, 10)
  if (isNaN(n1) || isNaN(n2)) return 'Invalid number'
  if (!isValidSet(n1, n2)) return 'Invalid score (e.g. 6-4, 7-5, 7-6)'
  return null
}

export function shouldShowThirdSet(sets: SetScores): boolean {
  const s1a = parseInt(sets[0][0], 10)
  const s1b = parseInt(sets[0][1], 10)
  const s2a = parseInt(sets[1][0], 10)
  const s2b = parseInt(sets[1][1], 10)
  if (isNaN(s1a) || isNaN(s1b) || isNaN(s2a) || isNaN(s2b)) return false
  if (!isValidSet(s1a, s1b) || !isValidSet(s2a, s2b)) return false
  return (s1a > s1b ? 1 : 2) !== (s2a > s2b ? 1 : 2)
}

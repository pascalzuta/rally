import { getReliabilityLevel, type ReliabilityLevel } from '../store'

interface Props {
  playerId: string
  isOrganizer: boolean
}

const LEVEL_TITLES: Record<Exclude<ReliabilityLevel, null>, string> = {
  green: 'Reliable player',
  yellow: 'Some reliability concerns',
  red: 'Low reliability',
}

export default function ReliabilityIndicator({ playerId, isOrganizer }: Props) {
  if (!isOrganizer) return null

  const level = getReliabilityLevel(playerId)
  if (!level) return null

  return (
    <span
      className={`reliability-dot reliability-dot--${level}`}
      title={LEVEL_TITLES[level]}
    />
  )
}

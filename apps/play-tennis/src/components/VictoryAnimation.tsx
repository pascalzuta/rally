import { useEffect, useState } from 'react'
import type { TrophyTier } from '../types'

interface Props {
  tier: TrophyTier
  tournamentName: string
  onDismiss: () => void
}

const TIER_CONFIG: Record<TrophyTier, {
  title: string
  subtitle: string
  colors: string[]
}> = {
  champion: {
    title: 'CHAMPION',
    subtitle: '',
    colors: ['#D4AF37', '#F6E27A', '#2A5BD7', '#E5E7EB'],
  },
  finalist: {
    title: 'FINALIST',
    subtitle: 'One match from the title',
    colors: ['#A0A5AD', '#C8CCD2', '#2A5BD7', '#E5E7EB'],
  },
  semifinalist: {
    title: 'SEMIFINALIST',
    subtitle: 'Top 4',
    colors: ['#B87333', '#D4956B', '#2A5BD7', '#E5E7EB'],
  },
}

function Particle({ color, delay, x }: { color: string; delay: number; x: number }) {
  const size = 4 + Math.random() * 4
  const shapes = ['circle', 'triangle'] as const
  const shape = shapes[Math.floor(Math.random() * shapes.length)]
  return (
    <div
      className="victory-particle"
      style={{
        left: `${x}%`,
        animationDelay: `${delay}s`,
        width: size,
        height: size,
        backgroundColor: shape === 'circle' ? color : 'transparent',
        borderLeft: shape === 'triangle' ? `${size / 2}px solid transparent` : undefined,
        borderRight: shape === 'triangle' ? `${size / 2}px solid transparent` : undefined,
        borderBottom: shape === 'triangle' ? `${size}px solid ${color}` : undefined,
        borderRadius: shape === 'circle' ? '50%' : '0',
      }}
    />
  )
}

export default function VictoryAnimation({ tier, tournamentName, onDismiss }: Props) {
  const [visible, setVisible] = useState(false)
  const config = TIER_CONFIG[tier]

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(onDismiss, 4000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const particles = Array.from({ length: 24 }, (_, i) => ({
    color: config.colors[i % config.colors.length],
    delay: Math.random() * 0.8,
    x: 10 + Math.random() * 80,
  }))

  return (
    <div className={`victory-overlay ${visible ? 'active' : ''}`} onClick={onDismiss}>
      {/* Confetti particles */}
      <div className="victory-particles">
        {particles.map((p, i) => (
          <Particle key={i} {...p} />
        ))}
      </div>

      {/* Trophy + text */}
      <div className={`victory-content ${visible ? 'active' : ''}`}>
        <div className={`victory-trophy ${tier}`}>
          <svg width="80" height="80" viewBox="0 0 40 40" fill="none">
            <defs>
              <linearGradient id="victory-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={config.colors[0]} />
                <stop offset="100%" stopColor={config.colors[1]} />
              </linearGradient>
            </defs>
            <path d="M10 8h20v4c0 7-4 12-10 14-6-2-10-7-10-14V8z" fill="url(#victory-grad)" />
            <path d="M10 10H7c0 4 1.5 7 3 8" stroke={config.colors[0]} strokeWidth="1.5" fill="none" />
            <path d="M30 10h3c0 4-1.5 7-3 8" stroke={config.colors[0]} strokeWidth="1.5" fill="none" />
            <rect x="18" y="26" width="4" height="5" rx="1" fill={config.colors[0]} opacity="0.7" />
            <rect x="13" y="31" width="14" height="3" rx="1.5" fill={config.colors[0]} />
            <ellipse cx="17" cy="14" rx="3" ry="5" fill="white" opacity="0.2" />
          </svg>
        </div>
        <div className="victory-title">{config.title}</div>
        <div className="victory-tournament">{tournamentName}</div>
        {config.subtitle && <div className="victory-subtitle">{config.subtitle}</div>}
      </div>
    </div>
  )
}

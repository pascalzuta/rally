import { ReactNode, HTMLAttributes } from 'react'

/**
 * Baseline design-system primitives.
 * Source of truth: apps/play-tennis/docs/DESIGN-SYSTEM.md
 *
 * Use these for any new UI. Existing components inherit Baseline
 * via baseline.css token + class overrides.
 */

type Tone = 'neutral' | 'blue' | 'amber' | 'ink'

export function BCard({
  children,
  className = '',
  ...rest
}: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`b-card ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function BPill({
  children,
  tone = 'neutral',
  className = '',
}: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={`b-pill b-pill--${tone} ${className}`}>{children}</span>
}

export function BStatusDot({ tone = 'blue', className = '' }: { tone?: 'blue' | 'amber' | 'ink'; className?: string }) {
  return <span aria-hidden="true" className={`b-status-dot b-status-dot--${tone} ${className}`} />
}

/** Status row: dot + pill. Replaces the old eyebrow-text pattern. */
export function BStatus({
  tone = 'blue',
  label,
  meta,
}: {
  tone?: 'blue' | 'amber' | 'ink'
  label: string
  meta?: string
}) {
  const pillTone: Tone = tone
  return (
    <div className="b-row">
      <BStatusDot tone={tone} />
      <BPill tone={pillTone}>
        {label}
        {meta ? <span className="b-ink-2"> · {meta}</span> : null}
      </BPill>
    </div>
  )
}

/** Italic-blue emphasis. Use inline within headings / body. */
export function BEm({ children }: { children: ReactNode }) {
  return <em className="bg-em">{children}</em>
}

/** Full-bleed divider inside a BCard. */
export function BDivider() {
  return <hr className="b-divider" />
}

/** Section title (h3 in Baseline scale). */
export function BTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h3 className={`text-title-sm ${className}`}>{children}</h3>
}

/** Secondary body copy (ink-2). */
export function BBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-body-md ${className}`}>{children}</p>
}

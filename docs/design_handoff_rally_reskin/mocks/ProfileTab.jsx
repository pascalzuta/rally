// ───────────────────────────────────────────────────────────
// Profile tab — 3 variants exploring the same information architecture
// through different editorial lenses.
//
//  A · "The Dossier"    — restrained, Linear-style. Density + clarity.
//  B · "The Scoreboard" — stats-heavy broadcast feel. Your year-in-rally.
//  C · "The Clubhouse"  — social, warm. Rivals have faces. Shareable.
//
// Shared primitives live in this file so the three variants stay
// on-system: ProfileTopBar, SectionTitle, a TabBarProfile, icons.
// ───────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════
// Shared primitives
// ═══════════════════════════════════════════════════════════

const pStroke = {
  fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round', strokeLinejoin: 'round',
};

function PTopBar({ title, rightIcon = 'gear' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '62px 20px 12px',
    }}>
      <div style={{ width: 36 }} />
      <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{title}</div>
      <button style={{
        width: 36, height: 36, borderRadius: 12, background: 'var(--surface)',
        border: '1px solid var(--hairline-2)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', cursor: 'pointer', color: 'var(--ink-2)',
      }}>
        {rightIcon === 'gear' ? (
          <svg width="14" height="14" viewBox="0 0 24 24" {...pStroke}>
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h0a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v0a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" {...pStroke}>
            <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
          </svg>
        )}
      </button>
    </div>
  );
}

function PSectionTitle({ children, right, note }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      }}>
        <div style={{
          fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 17,
          letterSpacing: -0.3, color: 'var(--ink)',
        }}>{children}</div>
        {right && (
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--rally-green)' }}>
            {right}
          </div>
        )}
      </div>
      {note && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{note}</div>}
    </div>
  );
}

function PTabBar({ active = 'profile' }) {
  const tabs = [
    { id: 'home', label: 'Home' },
    { id: 'bracket', label: 'Bracket' },
    { id: 'play', label: 'Play now' },
    { id: 'profile', label: 'Profile' },
  ];
  const icons = {
    home: <svg width="22" height="22" viewBox="0 0 24 24" {...pStroke}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1v-9.5Z"/></svg>,
    bracket: <svg width="22" height="22" viewBox="0 0 24 24" {...pStroke}><path d="M3 5h3v6h6m-6 0v6m0-6H3m0 6h3v6H3m6-6h4l3-6h5M15 14l3 6h3"/></svg>,
    play: <svg width="22" height="22" viewBox="0 0 24 24" {...pStroke}><circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5-6-3.5Z"/></svg>,
    profile: <svg width="22" height="22" viewBox="0 0 24 24" {...pStroke}><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>,
  };
  return (
    <div style={{
      position: 'absolute', left: 12, right: 12, bottom: 24,
      background: 'rgba(255,255,255,0.85)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      border: '1px solid var(--hairline-2)',
      borderRadius: 22, padding: '8px 6px',
      display: 'flex', boxShadow: '0 20px 40px -16px rgba(14,20,33,0.2)',
    }}>
      {tabs.map(t => (
        <div key={t.id} style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 2, padding: '6px 0',
          color: t.id === active ? 'var(--rally-green)' : 'var(--ink-3)',
        }}>
          <div style={{ height: 22 }}>{icons[t.id]}</div>
          <div style={{ fontSize: 10, fontWeight: 600 }}>{t.label}</div>
        </div>
      ))}
    </div>
  );
}

// Small trophy glyph used across variants — filled medal, cleaner than emoji.
function MedalGlyph({ size = 28, tier = 'champion' }) {
  const fills = {
    champion: ['#E5A838', '#F2C36A'],
    finalist: ['#9AA0AB', '#C6CBD4'],
    semi:     ['#B97548', '#D89C6F'],
  }[tier] || ['#E5A838', '#F2C36A'];
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id={`mg-${tier}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={fills[1]}/>
          <stop offset="100%" stopColor={fills[0]}/>
        </linearGradient>
      </defs>
      <path d="M10 5h12v3c0 5-3 8-6 9-3-1-6-4-6-9V5Z" fill={`url(#mg-${tier})`} />
      <rect x="14" y="17" width="4" height="4" fill={fills[0]} />
      <rect x="11" y="21" width="10" height="3" rx="1" fill={fills[0]} />
      <ellipse cx="13" cy="9" rx="1.4" ry="3" fill="#fff" opacity="0.35" />
    </svg>
  );
}

// Shared avatar atom — leans on brand Avatar; wraps it with optional ring.
function PAvatar({ name, size = 40, hue = 220, ring }) {
  return (
    <div style={{
      position: 'relative', width: size, height: size, flexShrink: 0,
      padding: ring ? 2 : 0, background: ring || 'transparent',
      borderRadius: size * 0.32 + (ring ? 2 : 0),
    }}>
      <Avatar name={name} size={ring ? size - 4 : size} hue={hue} />
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
// VARIANT A — THE DOSSIER (restrained, Linear density)
// ═══════════════════════════════════════════════════════════

function ProfileTabA() {
  return (
    <div style={{
      height: '100%', overflow: 'auto', background: 'var(--canvas)',
      paddingBottom: 120,
    }} className="no-scrollbar">
      <PTopBar title="Profile" />

      {/* Identity block — dense, no hero image */}
      <div style={{ padding: '4px 20px 0' }}>
        <div style={{
          background: 'var(--surface)', borderRadius: 18,
          border: '1px solid var(--hairline-2)',
          padding: 18,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar name="You" size={56} hue={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 20,
                letterSpacing: -0.4, color: 'var(--ink)',
              }}>Alex Mercier</div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>
                Hyde Park · Intermediate · Joined Mar '25
              </div>
            </div>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 0.08 * 10,
              textTransform: 'uppercase', color: 'var(--rally-green)',
              background: 'var(--rally-green-tint)',
              padding: '4px 8px', borderRadius: 6,
            }}>#8 in county</div>
          </div>

          {/* Vital stats row — Linear-style label:value pairs */}
          <div style={{
            marginTop: 16, paddingTop: 14,
            borderTop: '1px solid var(--hairline-2)',
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
          }}>
            <DossierStat label="Rating" value="1,392" />
            <DossierStat label="Record" value="9–5" />
            <DossierStat label="Trophies" value="3" />
            <DossierStat label="Streak" value="W3" accent />
          </div>
        </div>
      </div>

      {/* Rivals — this is the magic section */}
      <div style={{ padding: '24px 20px 0' }}>
        <PSectionTitle right="All opponents" note="People you've played 2+ times.">Rivals</PSectionTitle>
        <div style={{
          background: 'var(--surface)', borderRadius: 18,
          border: '1px solid var(--hairline-2)', overflow: 'hidden',
        }}>
          {[
            { name: 'Marcus Tate', w: 3, l: 2, hue: 200, last: 'W · Apr 15' },
            { name: 'Priya Sharma', w: 1, l: 3, hue: 280, last: 'L · Apr 12' },
            { name: 'James Liu', w: 4, l: 0, hue: 150, last: 'W · Apr 08' },
            { name: 'Nina Ramos', w: 2, l: 2, hue: 340, last: 'L · Apr 02' },
          ].map((r, i) => (
            <div key={r.name} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px',
              borderTop: i === 0 ? 'none' : '1px solid var(--hairline-2)',
            }}>
              <Avatar name={r.name} size={36} hue={r.hue} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{r.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 1 }}>{r.last}</div>
              </div>
              {/* H2H bar */}
              <div style={{ minWidth: 90, textAlign: 'right' }}>
                <div className="num" style={{
                  fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 15,
                  letterSpacing: -0.2,
                  color: r.w > r.l ? 'var(--confirmed)' : r.w < r.l ? 'var(--urgent)' : 'var(--ink-2)',
                }}>
                  {r.w}–{r.l}
                </div>
                <div style={{
                  marginTop: 3, height: 4, background: 'var(--hairline-2)', borderRadius: 999,
                  overflow: 'hidden', display: 'flex',
                }}>
                  <div style={{
                    width: `${(r.w / (r.w + r.l)) * 100}%`,
                    background: 'var(--rally-green)',
                  }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trophy cabinet — 3-col grid, empty slots included for invitation */}
      <div style={{ padding: '24px 20px 0' }}>
        <PSectionTitle right="3 of 8">Trophy cabinet</PSectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <DossierTrophy tier="champion" title="Hyde Park Summer" sub="Jul 2025" />
          <DossierTrophy tier="finalist" title="Clapham Open" sub="Jun 2025" />
          <DossierTrophy tier="semi" title="Battersea Cup" sub="May 2025" />
          <DossierTrophy empty title="Undefeated run" />
          <DossierTrophy empty title="10-match streak" />
          <DossierTrophy empty title="Perfect tournament" />
        </div>
      </div>

      {/* Year in Rally — editorial footer block */}
      <div style={{ padding: '24px 20px 0' }}>
        <PSectionTitle>Your year in Rally</PSectionTitle>
        <div style={{
          background: 'var(--ink)', color: '#fff', borderRadius: 18,
          padding: '16px 18px', display: 'grid', gap: 12,
        }}>
          <YearRow metric="Matches played" value="14" footnote="4 this month" />
          <YearRow metric="Hours on court" value="21.5" footnote="~1.5h per match" />
          <YearRow metric="Rating gained" value="+92" footnote="started at 1,300" />
          <YearRow metric="Best opponent beaten" value="Priya S." footnote="1,628 rating" />
        </div>
      </div>

      <PTabBar />
    </div>
  );
}

function DossierStat({ label, value, accent }) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: 0.04,
        textTransform: 'uppercase', color: 'var(--ink-3)',
      }}>{label}</div>
      <div className="num" style={{
        fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 18,
        letterSpacing: -0.3, marginTop: 3,
        color: accent ? 'var(--confirmed)' : 'var(--ink)',
      }}>{value}</div>
    </div>
  );
}

function DossierTrophy({ tier, title, sub, empty }) {
  return (
    <div style={{
      background: empty ? 'var(--surface)' : 'var(--surface)',
      border: empty ? '1px dashed var(--hairline)' : '1px solid var(--hairline-2)',
      borderRadius: 14, padding: 12, opacity: empty ? 0.6 : 1,
      display: 'flex', flexDirection: 'column', gap: 6,
      minHeight: 104,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10,
        background: empty ? 'var(--hairline-2)' : 'var(--rally-green-tint)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {empty
          ? <svg width="14" height="14" viewBox="0 0 24 24" {...pStroke} style={{color: 'var(--ink-4)'}}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
          : <MedalGlyph tier={tier} size={24} />
        }
      </div>
      <div style={{
        fontSize: 12, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2,
        letterSpacing: -0.1,
      }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{sub}</div>}
    </div>
  );
}

function YearRow({ metric, value, footnote }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
      <div style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.72)' }}>{metric}</div>
      <div className="num" style={{
        fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 18,
        letterSpacing: -0.3,
      }}>{value}</div>
      <div style={{ width: 90, textAlign: 'right', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{footnote}</div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
// VARIANT B — THE SCOREBOARD (stats-heavy broadcast)
// ═══════════════════════════════════════════════════════════

function ProfileTabB() {
  return (
    <div style={{
      height: '100%', overflow: 'auto', background: 'var(--canvas)',
      paddingBottom: 120,
    }} className="no-scrollbar">
      <PTopBar title="Profile" rightIcon="search" />

      {/* Hero scoreboard — dark tile with identity + 4-up stats */}
      <div style={{ padding: '4px 16px 0' }}>
        <div style={{
          background: 'var(--ink)', color: '#fff',
          borderRadius: 24, padding: '18px 18px 16px',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* ambient green wash */}
          <div style={{
            position: 'absolute', top: -80, right: -60,
            width: 240, height: 240, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(63,191,126,0.26), transparent 70%)',
            pointerEvents: 'none',
          }}/>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 62, height: 62, borderRadius: 18,
              background: 'oklch(0.72 0.12 30)', color: '#3a1e00',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 24,
              letterSpacing: -0.5,
              boxShadow: '0 2px 0 rgba(255,255,255,0.1) inset',
            }}>AM</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 22,
                letterSpacing: -0.5, lineHeight: 1.1,
              }}>Alex Mercier</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>
                @alexm · Hyde Park
              </div>
            </div>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 0.08 * 10,
              textTransform: 'uppercase', color: 'var(--confirmed)',
              background: 'rgba(21,183,107,0.18)', padding: '4px 8px', borderRadius: 6,
            }}>W3 hot</div>
          </div>

          {/* 4 scoreboard tiles */}
          <div style={{
            position: 'relative', marginTop: 20,
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            background: 'rgba(255,255,255,0.05)', borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <BoardStat label="Rating" value="1,392" delta="+52" />
            <BoardStat label="Win %" value="64" deltaLabel="9–5" divider />
            <BoardStat label="Rank" value="#8" deltaLabel="of 42" divider />
            <BoardStat label="Trophies" value="3" deltaLabel="1 champ" divider />
          </div>

          {/* pill row */}
          <div style={{ position: 'relative', display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <ScoreboardPill>Joined Mar '25</ScoreboardPill>
            <ScoreboardPill>Intermediate</ScoreboardPill>
            <ScoreboardPill>Singles · Competitive</ScoreboardPill>
          </div>
        </div>
      </div>

      {/* Season chart */}
      <div style={{ padding: '24px 20px 0' }}>
        <PSectionTitle right="All-time">This season</PSectionTitle>
        <div style={{
          background: 'var(--surface)', borderRadius: 18,
          border: '1px solid var(--hairline-2)', padding: '16px 16px 10px',
        }}>
          <SeasonChart />
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginTop: 6, fontSize: 10, color: 'var(--ink-3)',
          }}>
            <span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span>
          </div>
        </div>
      </div>

      {/* Rivalry cards — horizontal scroll, broadcast-style */}
      <div style={{ padding: '24px 0 0' }}>
        <div style={{ padding: '0 20px' }}>
          <PSectionTitle right="Find rival">Rivalries</PSectionTitle>
        </div>
        <div style={{
          display: 'flex', gap: 10, overflowX: 'auto',
          padding: '4px 20px 8px', scrollSnapType: 'x mandatory',
        }} className="no-scrollbar">
          <RivalryCard name="Marcus Tate" hue={200} you={3} them={2} last="W 6-4 6-3" hot />
          <RivalryCard name="Priya Sharma" hue={280} you={1} them={3} last="L 4-6 3-6" />
          <RivalryCard name="James Liu" hue={150} you={4} them={0} last="W 6-2 6-1" sweep />
          <RivalryCard name="Nina Ramos" hue={340} you={2} them={2} last="L 4-6 3-6" even />
        </div>
      </div>

      {/* Trophies — compact row */}
      <div style={{ padding: '24px 20px 0' }}>
        <PSectionTitle right="3 of 8">Trophy cabinet</PSectionTitle>
        <div style={{
          background: 'var(--surface)', borderRadius: 18,
          border: '1px solid var(--hairline-2)', padding: 14,
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
        }}>
          <ScoreboardTrophyChip tier="champion" label="Hyde Pk"/>
          <ScoreboardTrophyChip tier="finalist" label="Clapham"/>
          <ScoreboardTrophyChip tier="semi" label="Battersea"/>
          <ScoreboardTrophyChip empty />
        </div>
      </div>

      {/* Achievements grid */}
      <div style={{ padding: '24px 20px 0' }}>
        <PSectionTitle note="Tap to see progress.">Achievements</PSectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <AchChip icon="⚡" label="First win" done />
          <AchChip icon="🔥" label="3-win streak" done />
          <AchChip icon="★" label="Champion" done />
          <AchChip icon="◎" label="10 matches" progress="8 / 10" />
          <AchChip icon="↺" label="Comeback win" progress="0 / 1" />
          <AchChip icon="♦" label="Regular" progress="4 / 10" />
        </div>
      </div>

      <PTabBar />
    </div>
  );
}

function BoardStat({ label, value, delta, deltaLabel, divider }) {
  return (
    <div style={{
      padding: '12px 10px',
      borderLeft: divider ? '1px solid rgba(255,255,255,0.08)' : 'none',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: 0.04, textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.5)',
      }}>{label}</div>
      <div className="num" style={{
        fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 22,
        letterSpacing: -0.6, marginTop: 3, lineHeight: 1,
      }}>{value}</div>
      {delta && (
        <div className="num" style={{
          fontSize: 11, fontWeight: 700, color: 'var(--confirmed)', marginTop: 4,
        }}>▲ {delta}</div>
      )}
      {deltaLabel && (
        <div className="num" style={{
          fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4,
        }}>{deltaLabel}</div>
      )}
    </div>
  );
}

function ScoreboardPill({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)',
      background: 'rgba(255,255,255,0.08)', padding: '5px 9px', borderRadius: 999,
    }}>{children}</div>
  );
}

function SeasonChart() {
  // Same trajectory as RatingTab but rendered with month columns for scoreboard feel.
  const points = [1300, 1318, 1306, 1334, 1328, 1361, 1352, 1378, 1372, 1395, 1392];
  const min = 1280, max = 1420;
  const w = 320, h = 90;
  const path = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p - min) / (max - min)) * h;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const area = path + ` L${w},${h} L0,${h} Z`;
  const lastX = w, lastY = h - ((points[points.length - 1] - min) / (max - min)) * h;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 90 }}>
      <defs>
        <linearGradient id="sbArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1F7A4D" stopOpacity="0.26"/>
          <stop offset="100%" stopColor="#1F7A4D" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map(t => (
        <line key={t} x1="0" y1={h*t} x2={w} y2={h*t} stroke="var(--hairline-2)" strokeWidth="1"/>
      ))}
      <path d={area} fill="url(#sbArea)" />
      <path d={path} fill="none" stroke="var(--rally-green)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX - 2} cy={lastY} r="9" fill="var(--rally-green)" opacity="0.18" />
      <circle cx={lastX - 2} cy={lastY} r="4" fill="var(--rally-green)" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

function RivalryCard({ name, hue, you, them, last, hot, sweep, even }) {
  const flavor = hot ? { label: 'HOT', color: 'var(--urgent)', bg: 'var(--urgent-tint)' }
                 : sweep ? { label: 'SWEEP', color: 'var(--rally-green)', bg: 'var(--rally-green-tint)' }
                 : even ? { label: 'EVEN', color: 'var(--ink-3)', bg: 'var(--hairline-2)' }
                 : null;
  const edge = you > them ? 'up' : you < them ? 'down' : 'level';
  return (
    <div style={{
      flexShrink: 0, width: 168, background: 'var(--surface)',
      border: '1px solid var(--hairline-2)', borderRadius: 18, padding: 14,
      scrollSnapAlign: 'start',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar name={name} size={36} hue={hue} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: 'var(--ink)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{name}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>
            {you + them} matches
          </div>
        </div>
      </div>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 14,
      }}>
        <div className="num" style={{
          fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 28,
          letterSpacing: -0.8, color: edge === 'up' ? 'var(--confirmed)' : edge === 'down' ? 'var(--urgent)' : 'var(--ink)',
        }}>{you}</div>
        <div style={{ fontSize: 14, color: 'var(--ink-3)', fontWeight: 700 }}>–</div>
        <div className="num" style={{
          fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 28,
          letterSpacing: -0.8, color: 'var(--ink-3)',
        }}>{them}</div>
        {flavor && (
          <div style={{
            marginLeft: 'auto',
            fontSize: 10, fontWeight: 800, letterSpacing: 0.08 * 10,
            color: flavor.color, background: flavor.bg,
            padding: '3px 6px', borderRadius: 5,
          }}>{flavor.label}</div>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8 }} className="num">
        Last: {last}
      </div>
    </div>
  );
}

function ScoreboardTrophyChip({ tier, label, empty }) {
  if (empty) return (
    <div style={{
      aspectRatio: '1/1.1', borderRadius: 12, border: '1px dashed var(--hairline)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--ink-4)', fontSize: 18,
    }}>+</div>
  );
  return (
    <div style={{
      aspectRatio: '1/1.1', borderRadius: 12,
      background: 'linear-gradient(160deg, #FFF7E3, #F9E5B8)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 2, padding: 6,
    }}>
      <MedalGlyph tier={tier} size={28} />
      <div style={{ fontSize: 9, fontWeight: 700, color: '#8C6B1A', letterSpacing: 0.04 * 10, textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

function AchChip({ icon, label, done, progress }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--hairline-2)',
      borderRadius: 14, padding: 10, display: 'flex', flexDirection: 'column', gap: 4,
      opacity: done ? 1 : 0.82,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: done ? 'var(--rally-green-tint)' : 'var(--hairline-2)',
        color: done ? 'var(--rally-green)' : 'var(--ink-3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 800,
      }}>{icon}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>{label}</div>
      <div style={{ fontSize: 10, color: done ? 'var(--rally-green)' : 'var(--ink-3)', fontWeight: 600 }} className="num">
        {done ? 'Earned' : progress}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
// VARIANT C — THE CLUBHOUSE (social, personable)
// ═══════════════════════════════════════════════════════════

function ProfileTabC() {
  return (
    <div style={{
      height: '100%', overflow: 'auto', background: 'var(--canvas)',
      paddingBottom: 120,
    }} className="no-scrollbar">
      {/* Hero header — warm gradient, big avatar, bio, share button */}
      <div style={{
        background: 'linear-gradient(170deg, #E6F2EC 0%, #F7F5F2 60%)',
        paddingTop: 62, paddingBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px 10px' }}>
          <div style={{ width: 36 }} />
          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>Profile</div>
          <button style={{
            width: 36, height: 36, borderRadius: 12, background: 'rgba(255,255,255,0.7)',
            border: '1px solid var(--hairline-2)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'var(--ink-2)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" {...pStroke}>
              <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4m4-4v13"/>
            </svg>
          </button>
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '10px 20px 0', textAlign: 'center',
        }}>
          {/* avatar with court-green ring */}
          <div style={{
            padding: 3, borderRadius: 28,
            background: 'conic-gradient(from 120deg, var(--rally-green), #3FBF7E, var(--rally-green-deep), var(--rally-green))',
          }}>
            <div style={{ padding: 2, background: '#fff', borderRadius: 26 }}>
              <Avatar name="Alex Mercier" size={88} hue={30} />
            </div>
          </div>
          <div style={{
            fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 24,
            letterSpacing: -0.5, marginTop: 12, color: 'var(--ink)',
          }}>Alex Mercier</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>
            Hyde Park county · #8 · Joined Mar '25
          </div>

          <div style={{
            marginTop: 12, fontSize: 14, color: 'var(--ink-2)',
            lineHeight: 1.45, maxWidth: 280, textWrap: 'pretty',
          }}>
            "Lefty. One-handed backhand. Always looking for a proper 3-set battle on weekends."
          </div>

          {/* pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 }}>
            <CHPill>Singles</CHPill>
            <CHPill>Competitive</CHPill>
            <CHPill muted>Hyde Park LTC</CHPill>
            <CHPill muted>Battersea Park</CHPill>
          </div>
        </div>

        {/* quick stats strip */}
        <div style={{
          margin: '18px 16px 0', background: 'var(--surface)',
          border: '1px solid var(--hairline-2)', borderRadius: 18,
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        }}>
          {[
            { v: '1,392', l: 'Rating' },
            { v: '14', l: 'Matches' },
            { v: '64%', l: 'Wins' },
            { v: '3', l: 'Trophies' },
          ].map((s, i) => (
            <div key={s.l} style={{
              padding: '12px 4px', textAlign: 'center',
              borderLeft: i === 0 ? 'none' : '1px solid var(--hairline-2)',
            }}>
              <div className="num" style={{
                fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 18,
                letterSpacing: -0.3, color: 'var(--ink)',
              }}>{s.v}</div>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2, fontWeight: 600 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Trophy shelf — prominent, shareable */}
      <div style={{ padding: '22px 20px 0' }}>
        <PSectionTitle note="Your proudest moments on court.">Trophy shelf</PSectionTitle>
        <div style={{
          background: 'linear-gradient(170deg, #1B1411 0%, #0E1421 100%)',
          borderRadius: 20, padding: 18,
          position: 'relative', overflow: 'hidden',
        }}>
          {/* wood-grain-ish shelf line */}
          <div style={{
            position: 'absolute', left: 18, right: 18, bottom: 56,
            height: 1, background: 'rgba(255,255,255,0.08)',
          }}/>
          <div style={{
            position: 'absolute', left: 18, right: 18, bottom: 54,
            height: 4, background: 'linear-gradient(180deg, rgba(255,255,255,0.05), transparent)',
            borderRadius: 2,
          }}/>
          <div style={{
            display: 'flex', gap: 18, justifyContent: 'space-around',
            alignItems: 'flex-end', position: 'relative', paddingBottom: 46,
          }}>
            <ClubhouseTrophy tier="champion" title="Hyde Park" sub="Champion · Jul" />
            <ClubhouseTrophy tier="finalist" title="Clapham" sub="Finalist · Jun" />
            <ClubhouseTrophy tier="semi" title="Battersea" sub="Semi · May" />
          </div>
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 10,
            textAlign: 'center', fontSize: 11, fontWeight: 700,
            color: 'rgba(255,255,255,0.5)', letterSpacing: 0.08 * 10, textTransform: 'uppercase',
          }}>3 trophies · 5 slots open</div>
        </div>
      </div>

      {/* Rivals with faces */}
      <div style={{ padding: '24px 20px 0' }}>
        <PSectionTitle right="Challenge someone">Your rivals</PSectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <ClubhouseRival name="Marcus" full="Marcus Tate" hue={200} you={3} them={2} tag="Your nemesis" tagColor="var(--urgent)" />
          <ClubhouseRival name="Priya" full="Priya Sharma" hue={280} you={1} them={3} tag="Unfinished" tagColor="var(--response)" />
          <ClubhouseRival name="James" full="James Liu" hue={150} you={4} them={0} tag="Sweep" tagColor="var(--rally-green)" />
          <ClubhouseRival name="Nina" full="Nina Ramos" hue={340} you={2} them={2} tag="Dead even" tagColor="var(--ink-3)" />
        </div>
      </div>

      {/* Story cards — milestones, shareable */}
      <div style={{ padding: '24px 20px 0' }}>
        <PSectionTitle>Your Rally story</PSectionTitle>
        <div style={{ display: 'grid', gap: 8 }}>
          <StoryCard
            kind="milestone"
            icon={<MedalGlyph tier="champion" size={26}/>}
            title="First tournament won"
            body="You swept the Hyde Park Summer bracket — 5 matches, 3 of them in 2 sets."
            date="July 14"
          />
          <StoryCard
            kind="streak"
            icon="🔥"
            title="3 wins in a row"
            body="Your current streak. Marcus, James and Priya all went down."
            date="Running since Apr 08"
          />
          <StoryCard
            kind="upset"
            icon="⚡"
            title="Beat a player rated 236 above you"
            body="Your biggest upset — Priya Sharma (1,628) in straight sets."
            date="Apr 12"
          />
        </div>
      </div>

      <PTabBar />
    </div>
  );
}

function CHPill({ children, muted }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600,
      padding: '4px 10px', borderRadius: 999,
      background: muted ? 'rgba(255,255,255,0.55)' : 'var(--rally-green)',
      color: muted ? 'var(--ink-2)' : '#fff',
      border: muted ? '1px solid var(--hairline-2)' : 'none',
    }}>{children}</div>
  );
}

function ClubhouseTrophy({ tier, title, sub }) {
  const height = tier === 'champion' ? 82 : tier === 'finalist' ? 68 : 58;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 6, position: 'relative',
    }}>
      <div style={{ height, display: 'flex', alignItems: 'flex-end' }}>
        <MedalGlyph tier={tier} size={tier === 'champion' ? 56 : 44} />
      </div>
      {/* glow */}
      <div style={{
        position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
        width: 40, height: 8, background: 'rgba(255,210,120,0.2)', filter: 'blur(6px)',
      }}/>
      <div style={{
        fontSize: 11, fontWeight: 800, color: '#fff',
        letterSpacing: -0.1, whiteSpace: 'nowrap', position: 'relative',
      }}>{title}</div>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: 0.08 * 10,
        textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)',
        position: 'relative',
      }}>{sub}</div>
    </div>
  );
}

function ClubhouseRival({ name, full, hue, you, them, tag, tagColor }) {
  const edge = you > them ? 'up' : you < them ? 'down' : 'level';
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--hairline-2)',
      borderRadius: 16, padding: 14,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar name={full} size={40} hue={hue} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontWeight: 700, fontSize: 14, color: 'var(--ink)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{name}</div>
          <div style={{ fontSize: 11, color: tagColor, fontWeight: 700 }}>{tag}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="num" style={{
          fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 22,
          letterSpacing: -0.5,
          color: edge === 'up' ? 'var(--confirmed)' : edge === 'down' ? 'var(--urgent)' : 'var(--ink)',
        }}>
          {you}<span style={{ color: 'var(--ink-3)' }}>–</span>{them}
        </div>
        <div style={{
          flex: 1, height: 6, borderRadius: 999, background: 'var(--hairline-2)',
          overflow: 'hidden', display: 'flex',
        }}>
          <div style={{
            width: `${(you / (you + them || 1)) * 100}%`,
            background: 'var(--rally-green)',
          }} />
        </div>
      </div>
    </div>
  );
}

function StoryCard({ icon, title, body, date, kind }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--hairline-2)',
      borderRadius: 16, padding: 14,
      display: 'flex', gap: 12,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
        background: kind === 'milestone' ? '#FFF7E3' :
                    kind === 'streak'    ? 'var(--urgent-tint)' :
                                           'var(--rally-green-tint)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 700, color: 'var(--ink)',
          letterSpacing: -0.2, marginBottom: 3,
        }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.4 }}>{body}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6, fontWeight: 600 }}>{date}</div>
      </div>
      <div style={{
        width: 30, height: 30, borderRadius: 10,
        background: 'var(--hairline-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--ink-2)',
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" {...pStroke}>
          <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4m4-4v13"/>
        </svg>
      </div>
    </div>
  );
}


Object.assign(window, { ProfileTabA, ProfileTabB, ProfileTabC });

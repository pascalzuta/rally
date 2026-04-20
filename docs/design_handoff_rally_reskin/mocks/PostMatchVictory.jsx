// ───────────────────────────────────────────────────────────
// PostMatchVictory — the 5-second dopamine moment after submitting a win.
//
// The problem: every tennis app slaps "You won 🎉" and sends you to a
// boring results table. We treat this as the emotional core of the product.
//
// Layout:
//   • Top: confetti / subtle celebration (drawn, not emoji)
//   • BIG scoreline — broadcast-style tile
//   • Elo swing: +19 → new rating, with a "best day this month" tag if true
//   • Impact section: "Here's what changed" — rank up, streak, bracket advance
//   • Next: "Your semi is Sat 10:30 vs Marcus T" — a built-in forward motion
//   • Two CTAs: "Share" (secondary) + "See bracket" (primary)
//
// NO modals, NO trophies-spinning-in-3D. Confident restraint.
// ───────────────────────────────────────────────────────────

function PostMatchVictory() {
  return (
    <div style={{
      height: '100%', overflow: 'auto', background: 'var(--canvas)',
      paddingBottom: 140, position: 'relative',
    }} className="no-scrollbar">
      {/* subtle confetti */}
      <Confetti />

      {/* top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '60px 16px 8px', position: 'relative', zIndex: 2,
      }}>
        <button style={{
          width: 34, height: 34, borderRadius: 999, border: 'none',
          background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--ink)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" {...vStroke}>
            <path d="m6 6 12 12M18 6 6 18"/>
          </svg>
        </button>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 0.08 * 10,
          textTransform: 'uppercase', color: 'var(--ink-3)',
        }}>
          Hyde Park Spring · QF
        </div>
        <button style={{
          width: 34, height: 34, borderRadius: 999, border: 'none',
          background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--ink)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" {...vStroke}>
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>
          </svg>
        </button>
      </div>

      {/* HEADLINE */}
      <div style={{ padding: '10px 24px 20px', position: 'relative', zIndex: 2 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 999,
          background: 'var(--rally-green)', color: '#fff',
          fontSize: 10, fontWeight: 800, letterSpacing: 0.08 * 10,
          textTransform: 'uppercase',
          marginBottom: 12,
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff">
            <path d="m5 12 5 5 9-9-1.5-1.5L10 14l-3.5-3.5L5 12Z"/>
          </svg>
          Win
        </div>
        <div style={{
          fontFamily: 'var(--font-sans)', fontSize: 36, fontWeight: 800,
          letterSpacing: -1.4, lineHeight: 1.02, color: 'var(--ink)',
          textWrap: 'balance',
        }}>
          That's one step closer to the trophy.
        </div>
      </div>

      {/* SCORELINE CARD */}
      <div style={{ padding: '0 16px' }}>
        <ScorelineCard />
      </div>

      {/* ELO SWING */}
      <div style={{ padding: '14px 16px 0' }}>
        <EloSwingCard />
      </div>

      {/* WHAT CHANGED */}
      <div style={{ padding: '20px 20px 0' }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Here's what changed</div>
        <ChangeFeed />
      </div>

      {/* NEXT UP */}
      <div style={{ padding: '20px 16px 0' }}>
        <NextUpCard />
      </div>

      {/* STICKY CTAs */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '14px 16px 28px',
        background: 'linear-gradient(to top, var(--canvas) 60%, rgba(247,245,242,0))',
        display: 'flex', gap: 10,
      }}>
        <button style={{
          flex: '0 0 auto', height: 54, padding: '0 20px',
          borderRadius: 16, border: '1px solid var(--hairline)',
          background: 'var(--surface)', color: 'var(--ink)',
          fontFamily: 'var(--font-text)', fontSize: 15, fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" {...vStroke}>
            <path d="M12 3v13M7 8l5-5 5 5M5 21h14"/>
          </svg>
          Share
        </button>
        <button style={{
          flex: 1, height: 54, borderRadius: 16, border: 'none',
          background: 'var(--ink)', color: '#fff',
          fontFamily: 'var(--font-text)', fontSize: 16, fontWeight: 600,
          letterSpacing: -0.2, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: '0 10px 24px -8px rgba(14,20,33,0.35)',
        }} className="tappable">
          See bracket
          <svg width="14" height="14" viewBox="0 0 24 24" {...vStroke}>
            <path d="M5 12h14m-5-5 5 5-5 5"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ──────── scoreline ────────

function ScorelineCard() {
  return (
    <div style={{
      background: 'var(--ink)', color: '#fff',
      borderRadius: 22, padding: '18px 18px 14px',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(63,191,126,0.12), transparent 50%)',
      }}/>
      <div style={{
        position: 'absolute', top: 14, right: 16,
        fontSize: 10, fontWeight: 700, letterSpacing: 0.08 * 10,
        textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)',
      }}>Final · Best of 3</div>

      <div style={{ position: 'relative', marginTop: 8 }}>
        {/* you row */}
        <PlayerScoreRow
          name="You"
          avatarHue={30}
          sets={[6, 3, 6]}
          winner
          mine
        />
        <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '10px 0' }}/>
        {/* opp row */}
        <PlayerScoreRow
          name="James L."
          avatarHue={150}
          sets={[3, 6, 4]}
        />
      </div>

      {/* key moment */}
      <div style={{
        marginTop: 12, padding: '8px 12px',
        background: 'rgba(255,255,255,0.06)', borderRadius: 10,
        fontSize: 12, color: 'rgba(255,255,255,0.7)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="#3FBF7E">
          <path d="m13 2-10 13h7l-1 9 10-13h-7l1-9Z"/>
        </svg>
        Comeback from 1 set down · <span style={{ color: '#fff', fontWeight: 600 }} className="num">2h 04m</span> on court
      </div>
    </div>
  );
}

function PlayerScoreRow({ name, avatarHue, sets, winner, mine }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Avatar name={name} size={36} hue={avatarHue} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 700,
          color: winner ? '#fff' : 'rgba(255,255,255,0.75)',
          letterSpacing: -0.3,
        }}>
          {name}
          {winner && (
            <span style={{
              marginLeft: 8, fontSize: 10, fontWeight: 800, letterSpacing: 0.08 * 10,
              textTransform: 'uppercase', color: '#0E1421',
              background: '#3FBF7E', padding: '2px 6px', borderRadius: 4,
              verticalAlign: 'middle',
            }}>Win</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} className="num">
          {mine ? '1,287 → 1,306 Elo' : '1,294 → 1,275 Elo'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {sets.map((s, i) => {
          const isWinning = winner && s === Math.max(s, sets[i] === 6 ? 3 : 6);
          return (
            <div key={i} style={{
              width: 28, height: 36, borderRadius: 8,
              background: winner ? 'rgba(63,191,126,0.15)' : 'rgba(255,255,255,0.04)',
              border: winner ? '1px solid rgba(63,191,126,0.25)' : '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-sans)', fontSize: 20, fontWeight: 800,
              color: winner ? '#fff' : 'rgba(255,255,255,0.5)',
              letterSpacing: -0.5,
            }} className="num">
              {s}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────── Elo swing ────────

function EloSwingCard() {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 20,
      border: '1px solid var(--hairline-2)', overflow: 'hidden',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {/* left: swing */}
        <div style={{ flex: 1, padding: '16px 18px', borderRight: '1px solid var(--hairline-2)' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Elo change</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: 38, fontWeight: 800,
              color: 'var(--rally-green)', letterSpacing: -1.4, lineHeight: 1,
            }} className="num">+19</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
              <div className="num">1,287 → 1,306</div>
              <div style={{ color: 'var(--rally-green)', fontWeight: 600, marginTop: 2 }}>
                best day · 30 days
              </div>
            </div>
          </div>
        </div>
        {/* right: rank */}
        <div style={{ flex: 0.8, padding: '16px 18px' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Hyde Park rank</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: 38, fontWeight: 800,
              color: 'var(--ink)', letterSpacing: -1.4, lineHeight: 1,
            }} className="num">#8</div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 12, color: 'var(--rally-green)', fontWeight: 700,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--rally-green)">
                <path d="m12 4 8 8h-5v8h-6v-8H4l8-8Z"/>
              </svg>
              up 3
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────── feed ────────

function ChangeFeed() {
  const items = [
    {
      icon: 'bracket',
      title: 'You advanced to the semi-final',
      note: 'Hyde Park Spring · 4 players left',
    },
    {
      icon: 'streak',
      title: '3-match win streak',
      note: 'You haven\'t lost in 11 days',
    },
    {
      icon: 'rival',
      title: 'New rivalry unlocked vs Marcus T.',
      note: 'You\'ll likely meet him in the semi',
    },
  ];
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 18,
      border: '1px solid var(--hairline-2)', overflow: 'hidden',
    }}>
      {items.map((it, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 16px',
          borderTop: i === 0 ? 'none' : '1px solid var(--hairline-2)',
        }}>
          <FeedIcon kind={it.icon} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{it.title}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 1 }}>{it.note}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function FeedIcon({ kind }) {
  const wrap = {
    width: 34, height: 34, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  };
  if (kind === 'bracket') return <div style={{ ...wrap, background: 'var(--rally-green-tint)', color: 'var(--rally-green-deep)' }}>
    <svg width="16" height="16" viewBox="0 0 24 24" {...vStroke}>
      <path d="M4 6h5v5M4 18h5v-5M20 6v12M9 11h5v7h6M9 13h5V6h6"/>
    </svg>
  </div>;
  if (kind === 'streak') return <div style={{ ...wrap, background: 'var(--warn-tint)', color: 'var(--warn-ink)' }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2c1 5-5 6-5 12a5 5 0 1 0 10 0c0-3-2-4-2-8 3 1 5 4 5 8a8 8 0 1 1-16 0c0-6 8-7 8-12Z"/>
    </svg>
  </div>;
  return <div style={{ ...wrap, background: 'var(--response-tint)', color: 'var(--response)' }}>
    <svg width="16" height="16" viewBox="0 0 24 24" {...vStroke}>
      <path d="M6 18 18 6m0 12L6 6"/>
    </svg>
  </div>;
}

// ──────── next up ────────

function NextUpCard() {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 20,
      border: '1px solid var(--hairline-2)', overflow: 'hidden',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
        background: 'var(--rally-green)',
      }}/>
      <div style={{ padding: '14px 16px 16px', paddingLeft: 20 }}>
        <div className="eyebrow" style={{ color: 'var(--rally-green)', marginBottom: 6 }}>
          Next up · Semi-final
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, margin: '6px 0 10px',
        }}>
          <Avatar name="Marcus T" size={40} hue={200} />
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: 17, fontWeight: 700,
              color: 'var(--ink)', letterSpacing: -0.3,
            }}>vs Marcus Thompson</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }} className="num">
              Elo 1,321 · #3 seed
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', background: 'var(--canvas)', borderRadius: 12,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" {...vStroke} stroke="var(--ink-3)">
            <rect x="4" y="5" width="16" height="16" rx="2"/>
            <path d="M8 3v4M16 3v4M4 10h16"/>
          </svg>
          <div style={{ flex: 1, fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>
            Sat Apr 26 <span style={{ color: 'var(--ink-3)' }} className="num">· 10:30 – 12:00</span>
          </div>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.06, textTransform: 'uppercase',
            color: 'var(--rally-green)', padding: '3px 7px',
            background: 'var(--rally-green-tint)', borderRadius: 6,
          }}>Confirmed</span>
        </div>
      </div>
    </div>
  );
}

// ──────── confetti ────────

function Confetti() {
  // Deterministic "confetti" — geometric, not emoji. Lives in the top 180px.
  const pieces = [];
  const colors = ['#1F7A4D', '#3FBF7E', '#0E1421', '#2F6FEB', '#9AA0AB'];
  for (let i = 0; i < 22; i++) {
    const x = (i * 47) % 360;
    const y = (i * 31) % 160;
    const rot = (i * 73) % 360;
    const c = colors[i % colors.length];
    const w = 6 + (i % 4) * 2;
    const h = (i % 3 === 0) ? w : 3;
    pieces.push(
      <div key={i} style={{
        position: 'absolute', left: x, top: y + 30,
        width: w, height: h, background: c,
        transform: `rotate(${rot}deg)`,
        borderRadius: h < 4 ? 1 : 2,
        opacity: 0.75,
      }}/>
    );
  }
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 220,
      pointerEvents: 'none', overflow: 'hidden',
    }}>
      {pieces}
    </div>
  );
}

const vStroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

Object.assign(window, { PostMatchVictory });

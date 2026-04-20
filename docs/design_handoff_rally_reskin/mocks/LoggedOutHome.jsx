// ───────────────────────────────────────────────────────────
// LoggedOutHome — marketing landing inside an iPhone frame
// This is what a first-time visitor to play-rally.com sees.
// ───────────────────────────────────────────────────────────

function LoggedOutHome() {
  return (
    <div style={{
      height: '100%', overflow: 'auto', background: 'var(--canvas)',
      paddingBottom: 40,
    }} className="no-scrollbar">
      {/* Top nav — minimal, just logo + sign in */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '62px 20px 14px', position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--canvas)',
      }}>
        <RallyWordmark size={22} />
        <button style={{
          border: 'none', background: 'transparent', padding: '8px 2px',
          fontFamily: 'var(--font-text)', fontSize: 15, fontWeight: 600,
          color: 'var(--ink)', cursor: 'pointer',
        }}>Sign in</button>
      </div>

      {/* HERO — big type, one promise, one action */}
      <div style={{ padding: '12px 20px 28px' }}>
        <div style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 44, lineHeight: 1.02, fontWeight: 800,
          letterSpacing: -1.5, color: 'var(--ink)',
          textWrap: 'balance',
        }}>
          Tennis tournaments<br/>
          <span style={{ color: 'var(--rally-orange)' }}>in your county.</span><br/>
          No admin.
        </div>
        <div style={{
          marginTop: 14, fontSize: 16, lineHeight: 1.45, color: 'var(--ink-2)',
          maxWidth: 320,
        }}>
          Rally forms a 6-player bracket the moment six locals are ready to play. You schedule with one tap.
        </div>
      </div>

      {/* HERO CARD — a "peek" at a scheduled match, to show the product */}
      <div style={{ padding: '0 20px' }}>
        <PeekCard />
      </div>

      {/* Primary CTA — large, thumb-height */}
      <div style={{ padding: '24px 20px 8px' }}>
        <button style={{
          width: '100%', height: 56, border: 'none',
          background: 'var(--ink)', color: 'white',
          borderRadius: 18, fontFamily: 'var(--font-text)',
          fontSize: 17, fontWeight: 600, letterSpacing: -0.2,
          cursor: 'pointer',
          boxShadow: '0 1px 0 rgba(255,255,255,0.08) inset, 0 10px 24px -8px rgba(14,20,33,0.35)',
        }} className="tappable">
          Join your county lobby
        </button>
        <div style={{
          textAlign: 'center', marginTop: 12, fontSize: 13, color: 'var(--ink-3)',
        }}>
          Free · No credit card · UK & US counties
        </div>
      </div>

      {/* HOW IT WORKS — numbered steps, compact */}
      <div style={{ padding: '36px 20px 4px' }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>How it works</div>
        <Step n="1" title="Join your county lobby" body="Tell us when you're free to play this week. Takes 30 seconds." />
        <Step n="2" title="Rally forms a bracket" body="The moment six players are ready, a tournament spins up." />
        <Step n="3" title="Tap a time, you're scheduled" body="We show the times you and your opponent both have free. Pick one." />
        <Step n="4" title="Play. Score. Climb." body="Enter the result. Get a rating. Earn trophies." last />
      </div>

      {/* SOCIAL PROOF — numbers, not logos we don't have */}
      <div style={{
        margin: '32px 20px 8px',
        background: 'var(--surface)',
        border: '1px solid var(--hairline-2)',
        borderRadius: 22, padding: 20,
      }}>
        <div style={{ display: 'flex', gap: 18 }}>
          <Stat big="412" small="active players" />
          <Stat big="68" small="counties live" />
          <Stat big="4.9" small="app rating" />
        </div>
      </div>

      {/* WHY RALLY — 3 small cards */}
      <div style={{ padding: '28px 20px 0' }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>What makes it work</div>
        <Why
          dot="var(--rally-orange)"
          title="Scheduling that actually ships"
          body="No more group chats. We compute your shared free windows and surface them as one-tap chips."
        />
        <Why
          dot="var(--confirmed)"
          title="Local, not global"
          body="You only play people in your county. Real people, real courts, real driving distance."
        />
        <Why
          dot="var(--response)"
          title="Rated, not ranked"
          body="Every match feeds an Elo. No paid leagues, no governing body — just progression."
        />
      </div>

      {/* FOOTER */}
      <div style={{
        marginTop: 36, padding: '24px 20px 8px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderTop: '1px solid var(--hairline-2)',
      }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>© Rally 2026</div>
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--ink-3)' }}>
          <span>About</span><span>Privacy</span><span>Support</span>
        </div>
      </div>
    </div>
  );
}

// ──────── bits ────────

function PeekCard() {
  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 22, padding: 18,
      border: '1px solid var(--hairline-2)',
      boxShadow: '0 10px 24px -16px rgba(14,20,33,0.18)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* peel tag */}
      <div style={{
        position: 'absolute', top: 18, right: 18,
        fontSize: 10, fontWeight: 700, letterSpacing: 0.08 * 10,
        textTransform: 'uppercase',
        color: 'var(--confirmed)', background: 'var(--confirmed-tint)',
        padding: '5px 8px', borderRadius: 6,
      }}>Confirmed</div>

      <div className="eyebrow" style={{ color: 'var(--ink-3)', marginBottom: 10 }}>
        Round of 6 · Match 2
      </div>

      {/* matchup */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <Avatar name="You" size={44} hue={30} />
        <div style={{
          fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 14,
          color: 'var(--ink-3)', letterSpacing: 1,
        }}>VS</div>
        <Avatar name="Marcus T" size={44} hue={200} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>Marcus T.</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)' }} className="num">Elo 1,428</div>
        </div>
      </div>

      {/* time — big, scannable */}
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 8,
        paddingTop: 14, borderTop: '1px solid var(--hairline-2)',
      }}>
        <div style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 26, fontWeight: 800, letterSpacing: -0.8,
          color: 'var(--ink)',
        }} className="num">
          Sat 10:30
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink-3)' }}>· Hyde Park Court 3</div>
      </div>
    </div>
  );
}

function Step({ n, title, body, last }) {
  return (
    <div style={{
      display: 'flex', gap: 14, paddingBottom: last ? 0 : 20,
      paddingTop: n === '1' ? 0 : 0, marginBottom: last ? 0 : 4,
      position: 'relative',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        background: 'var(--ink)', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15,
        flexShrink: 0,
      }}>{n}</div>
      <div style={{ flex: 1, paddingTop: 4 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 2 }}>
          {title}
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.4 }}>
          {body}
        </div>
      </div>
    </div>
  );
}

function Stat({ big, small }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 26, fontWeight: 800, letterSpacing: -0.8,
        color: 'var(--ink)',
      }} className="num">{big}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{small}</div>
    </div>
  );
}

function Why({ dot, title, body }) {
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '14px 0',
      borderBottom: '1px solid var(--hairline-2)',
    }}>
      <div style={{
        width: 10, height: 10, borderRadius: 3, background: dot,
        marginTop: 6, flexShrink: 0,
      }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 2 }}>
          {title}
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.4 }}>
          {body}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LoggedOutHome });

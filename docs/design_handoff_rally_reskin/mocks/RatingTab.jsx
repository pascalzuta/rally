// ───────────────────────────────────────────────────────────
// RatingTab — player's Elo, trophies, and match history.
//
// Design moves:
//  • HERO: big Elo number + delta + sparkline (broadcast scoreboard feel)
//  • Breakdown: confidence ("provisional" vs "settled"), matches played
//  • Trophies: horizontal strip; empty slots still visible to invite progression
//  • History: match rows with ± elo delta. Tap = full match recap.
// ───────────────────────────────────────────────────────────

function RatingTab() {
  return (
    <div style={{
      height: '100%', overflow: 'auto', background: 'var(--canvas)',
      paddingBottom: 120,
    }} className="no-scrollbar">
      {/* top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '62px 20px 12px',
      }}>
        <button style={{
          width: 36, height: 36, borderRadius: 12, background: 'var(--surface)',
          border: '1px solid var(--hairline-2)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', color: 'var(--ink-2)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" {...rStroke}>
            <path d="m15 6-6 6 6 6"/>
          </svg>
        </button>
        <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>Rating</div>
        <button style={{
          width: 36, height: 36, borderRadius: 12, background: 'var(--surface)',
          border: '1px solid var(--hairline-2)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', color: 'var(--ink-2)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" {...rStroke}>
            <circle cx="12" cy="12" r="9"/><path d="M12 8h.01M12 11v5"/>
          </svg>
        </button>
      </div>

      {/* HERO: big elo card */}
      <div style={{ padding: '8px 16px 0' }}>
        <RatingHero />
      </div>

      {/* BREAKDOWN: 3 stat tiles */}
      <div style={{ padding: '14px 16px 0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <StatTile label="Matches" value="14" sub="last 30d: 4" />
        <StatTile label="Win rate" value="64%" sub="9 W · 5 L" />
        <StatTile label="Streak" value="W3" sub="last 3 wins" accent />
      </div>

      {/* TROPHIES */}
      <div style={{ padding: '24px 20px 0' }}>
        <SectionTitle right="View all">Trophies</SectionTitle>
        <Trophies />
      </div>

      {/* HISTORY */}
      <div style={{ padding: '24px 20px 0' }}>
        <SectionTitle>Rating history</SectionTitle>
        <HistoryList />
      </div>

      {/* LEADERBOARD PEEK */}
      <div style={{ padding: '24px 20px 0' }}>
        <SectionTitle right="View leaderboard">Hyde Park county</SectionTitle>
        <LeaderboardPeek />
      </div>

      <TabBar active="profile" />
    </div>
  );
}

// ──────── hero ────────

function RatingHero() {
  return (
    <div style={{
      background: 'var(--ink)',
      borderRadius: 24, padding: '20px 20px 16px',
      color: '#fff', position: 'relative', overflow: 'hidden',
    }}>
      {/* ambient gradient (subtle, not slop) */}
      <div style={{
        position: 'absolute', top: -60, right: -60,
        width: 220, height: 220, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(63,191,126,0.28), transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 4,
        }}>
          <div className="eyebrow" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Your rating · settled
          </div>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 0.08 * 10,
            textTransform: 'uppercase', color: 'var(--confirmed)',
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'rgba(21,183,107,0.15)', padding: '4px 8px', borderRadius: 6,
          }}>
            <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: 999, background: 'var(--confirmed)' }} />
            +24 last match
          </div>
        </div>

        {/* ELO NUMBER — broadcast-scoreboard scale */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: 10 }}>
          <div style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 72, fontWeight: 800, letterSpacing: -3.6,
            lineHeight: 0.95,
          }} className="num">
            1,392
          </div>
          <div style={{ paddingBottom: 12 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              color: 'var(--confirmed)', fontWeight: 700, fontSize: 15,
            }} className="num">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4 4 14h5v6h6v-6h5L12 4Z"/>
              </svg>
              +52
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>last 30 days</div>
          </div>
        </div>

        {/* sparkline */}
        <div style={{ marginTop: 18, position: 'relative', height: 60 }}>
          <Sparkline />
        </div>

        {/* scale markers */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          marginTop: 8, fontSize: 10, color: 'rgba(255,255,255,0.45)',
          fontWeight: 500,
        }}>
          <span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span>
        </div>
      </div>
    </div>
  );
}

function Sparkline() {
  // Synthetic but believable elo trajectory
  const points = [1340, 1328, 1351, 1345, 1368, 1360, 1378, 1372, 1395, 1385, 1408, 1392];
  const min = Math.min(...points) - 10;
  const max = Math.max(...points) + 10;
  const w = 340, h = 60;
  const path = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p - min) / (max - min)) * h;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const areaPath = path + ` L${w},${h} L0,${h} Z`;
  const lastX = w, lastY = h - ((points[points.length - 1] - min) / (max - min)) * h;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="sparkArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1F7A4D" stopOpacity="0.42"/>
          <stop offset="100%" stopColor="#1F7A4D" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkArea)" />
      <path d={path} fill="none" stroke="#3FBF7E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {/* endpoint halo */}
      <circle cx={lastX - 2} cy={lastY} r="10" fill="#3FBF7E" opacity="0.22" />
      <circle cx={lastX - 2} cy={lastY} r="4" fill="#3FBF7E" stroke="#0E1421" strokeWidth="2" />
    </svg>
  );
}

// ──────── stat tiles ────────

function StatTile({ label, value, sub, accent }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 16,
      border: '1px solid var(--hairline-2)',
      padding: 14,
    }}>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, letterSpacing: 0.02, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 24, fontWeight: 800, letterSpacing: -0.6,
        color: accent ? 'var(--confirmed)' : 'var(--ink)', marginTop: 4, lineHeight: 1,
      }} className="num">
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
        {sub}
      </div>
    </div>
  );
}

function SectionTitle({ children, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      marginBottom: 12,
    }}>
      <div style={{
        fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 17,
        letterSpacing: -0.3, color: 'var(--ink)',
      }}>{children}</div>
      {right && (
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--rally-orange)' }}>
          {right}
        </div>
      )}
    </div>
  );
}

// ──────── trophies ────────

function Trophies() {
  const trophies = [
    { kind: 'champion', label: 'Hyde Park · Jul', hue: 44 },
    { kind: 'runner', label: 'Clapham · Jun', hue: 200 },
    { kind: 'streak', label: '5-win streak', hue: 340 },
    { kind: 'empty', label: 'Finals', hue: 0 },
    { kind: 'empty', label: 'Perfect', hue: 0 },
  ];
  return (
    <div style={{
      display: 'flex', gap: 10, overflowX: 'auto', margin: '0 -20px',
      padding: '4px 20px 8px', scrollSnapType: 'x mandatory',
    }} className="no-scrollbar">
      {trophies.map((t, i) => <TrophyCard key={i} {...t} />)}
    </div>
  );
}

function TrophyCard({ kind, label, hue }) {
  const isEmpty = kind === 'empty';
  const colors = {
    champion: ['#F59E0B', '#FBBF24'],
    runner: ['#6B7280', '#9AA0AB'],
    streak: ['#D92D20', '#F87171'],
  }[kind] || ['#E6E4DF', '#EFEDE8'];

  return (
    <div style={{
      flexShrink: 0, width: 108, aspectRatio: '1 / 1.18',
      borderRadius: 18, padding: 12,
      background: isEmpty ? 'var(--surface)' : `linear-gradient(160deg, ${colors[0]}, ${colors[1]})`,
      border: isEmpty ? '1px dashed var(--hairline)' : 'none',
      color: isEmpty ? 'var(--ink-3)' : '#fff',
      position: 'relative', overflow: 'hidden',
      scrollSnapAlign: 'start',
      boxShadow: isEmpty ? 'none' : '0 8px 20px -10px rgba(14,20,33,0.3)',
    }}>
      {/* medal shape */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 46, height: 46, borderRadius: '50%',
        background: isEmpty ? 'var(--hairline-2)' : 'rgba(255,255,255,0.22)',
        marginBottom: 10,
      }}>
        {kind === 'champion' && <TrophyIcon />}
        {kind === 'runner' && <MedalIcon />}
        {kind === 'streak' && <FireIcon />}
        {kind === 'empty' && <LockIcon />}
      </div>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: 0.08 * 10,
        textTransform: 'uppercase', opacity: isEmpty ? 0.7 : 0.75, lineHeight: 1.2,
      }}>
        {kind === 'champion' ? 'Champion' : kind === 'runner' ? 'Finalist' : kind === 'streak' ? 'Streak' : 'Locked'}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2, lineHeight: 1.2 }}>
        {label}
      </div>
    </div>
  );
}

function TrophyIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M8 4h8v2h3a1 1 0 0 1 1 1v2a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 16v2h3v2H8v-2h3v-2a5 5 0 0 1-2.7-3H8a4 4 0 0 1-4-4V7a1 1 0 0 1 1-1h3V4Zm0 4H6v1a2 2 0 0 0 2 2V8Zm8 0v3a2 2 0 0 0 2-2V8h-2Z"/></svg>; }
function MedalIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M7 3h4l-2 6h-4l2-6Zm6 0h4l2 6h-4l-2-6Zm-1 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>; }
function FireIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3-1-3 0-5 1-9Z"/></svg>; }
function LockIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>; }

// ──────── history ────────

function HistoryList() {
  const rows = [
    { date: 'Apr 15', opp: 'Marcus T.', result: 'W', score: '6-4, 6-3', delta: +24, hue: 200 },
    { date: 'Apr 12', opp: 'Priya S.', result: 'W', score: '7-5, 6-4', delta: +18, hue: 280 },
    { date: 'Apr 08', opp: 'James L.', result: 'W', score: '6-2, 6-1', delta: +12, hue: 150 },
    { date: 'Apr 02', opp: 'Nina R.', result: 'L', score: '4-6, 3-6', delta: -16, hue: 340 },
    { date: 'Mar 28', opp: 'Ben K.', result: 'W', score: '6-4, 4-6, 6-3', delta: +14, hue: 60 },
  ];
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 18,
      border: '1px solid var(--hairline-2)', overflow: 'hidden',
    }}>
      {rows.map((r, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px',
          borderTop: i === 0 ? 'none' : '1px solid var(--hairline-2)',
        }}>
          {/* date column */}
          <div style={{ width: 46, flexShrink: 0 }}>
            <div style={{
              fontSize: 11, fontWeight: 600, color: 'var(--ink-3)',
              textTransform: 'uppercase', letterSpacing: 0.04,
            }} className="num">{r.date}</div>
          </div>
          {/* W/L badge */}
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 12,
            color: r.result === 'W' ? 'var(--confirmed)' : 'var(--urgent)',
            background: r.result === 'W' ? 'var(--confirmed-tint)' : 'var(--urgent-tint)',
          }}>{r.result}</div>
          {/* opponent */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{r.opp}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }} className="num">{r.score}</div>
          </div>
          {/* delta */}
          <div style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 800, fontSize: 15, letterSpacing: -0.2,
            color: r.delta > 0 ? 'var(--confirmed)' : 'var(--urgent)',
          }} className="num">
            {r.delta > 0 ? '+' : ''}{r.delta}
          </div>
        </div>
      ))}
    </div>
  );
}

// ──────── leaderboard peek ────────

function LeaderboardPeek() {
  const rows = [
    { pos: 1, name: 'Priya S.', elo: 1628, hue: 280 },
    { pos: 2, name: 'Jordan M.', elo: 1541, hue: 180 },
    { pos: 3, name: 'Nina R.', elo: 1515, hue: 340 },
    { pos: 8, name: 'You', elo: 1392, hue: 30, you: true },
    { pos: 9, name: 'Marcus T.', elo: 1368, hue: 200 },
  ];
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 18,
      border: '1px solid var(--hairline-2)', overflow: 'hidden',
    }}>
      {rows.map((r, i) => {
        const prev = rows[i - 1];
        const gap = prev && r.pos - prev.pos > 1;
        return (
          <React.Fragment key={i}>
            {gap && (
              <div style={{
                padding: '6px 16px', fontSize: 11, color: 'var(--ink-4)',
                background: '#FBFAF7', letterSpacing: 0.02,
              }}>
                · · ·
              </div>
            )}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px',
              background: r.you ? 'var(--rally-orange-tint)' : 'transparent',
              borderTop: i === 0 ? 'none' : '1px solid var(--hairline-2)',
            }}>
              <div style={{
                width: 28, fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700,
                color: r.pos <= 3 ? 'var(--ink)' : 'var(--ink-3)', textAlign: 'center',
              }} className="num">{r.pos}</div>
              <Avatar name={r.name} size={32} hue={r.hue} />
              <div style={{
                flex: 1, fontSize: 14,
                fontWeight: r.you ? 800 : 600, color: 'var(--ink)',
              }}>
                {r.name}
              </div>
              <div style={{
                fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700,
                letterSpacing: -0.2, color: 'var(--ink)',
              }} className="num">
                {r.elo.toLocaleString()}
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ──────── icons ────────
const rStroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

Object.assign(window, { RatingTab });

// ───────────────────────────────────────────────────────────
// ProfileTab v4 — the synthesis
//
// Combines the best atoms from A, B and C into a single surface:
//  1. HERO      — Clubhouse (C): gradient header, ringed avatar, bio, pills, stats strip
//  2. RIVALS    — Dossier (A):   leaderboard-style list with H2H bars and last-result chip
//  3. CHART     — Scoreboard (B): season chart on a light card
//  4. TROPHIES  — Clubhouse (C): dark "trophy shelf" with glow (more brandable than grid)
//  5. STORY     — Dossier (A):   "Your year in Rally" dark-tile closer (keeps it editorial)
//
// Uses the shared primitives from ProfileTab.jsx (pStroke, PTabBar, Avatar, MedalGlyph, etc).
// ───────────────────────────────────────────────────────────

function ProfileTabV4() {
  return (
    <div style={{
      height: '100%', overflow: 'auto', background: 'var(--canvas)',
      paddingBottom: 120,
    }} className="no-scrollbar">

      {/* ═══ 1 · HERO (from Clubhouse) ═══ */}
      <div style={{
        background: 'var(--canvas)',
        paddingTop: 62, paddingBottom: 18,
      }}>
        {/* top chrome row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px 10px',
        }}>
          <button style={{
            width: 36, height: 36, borderRadius: 12,
            background: 'rgba(255,255,255,0.7)',
            border: '1px solid var(--hairline-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ink-2)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" {...pStroke}>
              <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4m4-4v13"/>
            </svg>
          </button>
          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>Profile</div>
          <button style={{
            width: 36, height: 36, borderRadius: 12,
            background: 'rgba(255,255,255,0.7)',
            border: '1px solid var(--hairline-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ink-2)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" {...pStroke}>
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v2m0 18v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M1 12h2m18 0h2M4.2 19.8l1.4-1.4m12.8-12.8 1.4-1.4"/>
            </svg>
          </button>
        </div>

        {/* avatar + name */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '8px 20px 0', textAlign: 'center',
        }}>
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
          <div style={{
            fontSize: 13, color: 'var(--ink-3)', marginTop: 2,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <span>Hyde Park county</span>
            <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--ink-4)' }}/>
            <span style={{ color: 'var(--rally-green)', fontWeight: 700 }}>#8 of 42</span>
            <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--ink-4)' }}/>
            <span>Since Mar '25</span>
          </div>
          <div style={{
            marginTop: 12, fontSize: 14, color: 'var(--ink-2)',
            lineHeight: 1.45, maxWidth: 280, textWrap: 'pretty',
          }}>
            "Lefty. One-handed backhand. Always looking for a proper 3-set battle on weekends."
          </div>
          <div style={{
            display: 'flex', gap: 6, flexWrap: 'wrap',
            justifyContent: 'center', marginTop: 12,
          }}>
            <V4Pill primary>Singles</V4Pill>
            <V4Pill primary>Competitive</V4Pill>
            <V4Pill>Hyde Park LTC</V4Pill>
            <V4Pill>Battersea Park</V4Pill>
          </div>
        </div>

        {/* stats strip */}
        <div style={{
          margin: '18px 16px 0', background: 'var(--surface)',
          border: '1px solid var(--hairline-2)', borderRadius: 18,
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        }}>
          {[
            { v: '1,392', l: 'Rating', d: '+52' },
            { v: '14',    l: 'Matches', d: '4 · 30d' },
            { v: '64%',   l: 'Wins', d: '9–5' },
            { v: '3',     l: 'Trophies', d: '1 champ' },
          ].map((s, i) => (
            <div key={s.l} style={{
              padding: '14px 4px', textAlign: 'center',
              borderLeft: i === 0 ? 'none' : '1px solid var(--hairline-2)',
            }}>
              <div className="num" style={{
                fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 20,
                letterSpacing: -0.4, color: 'var(--ink)', lineHeight: 1,
              }}>{s.v}</div>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 4, fontWeight: 600 }}>{s.l}</div>
              <div className="num" style={{
                fontSize: 10, color: 'var(--rally-green)', marginTop: 3, fontWeight: 700,
              }}>{s.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ 2 · RIVALS (from Dossier) ═══ */}
      <div style={{ padding: '24px 20px 0' }}>
        <PSectionTitle right="Challenge someone" note="People you've played 2+ times.">Rivals</PSectionTitle>
        <div style={{
          background: 'var(--surface)', borderRadius: 18,
          border: '1px solid var(--hairline-2)', overflow: 'hidden',
        }}>
          {[
            { name: 'Marcus Tate',   hue: 200, w: 3, l: 2, last: 'W',  lastDate: 'Apr 15', tag: 'Nemesis',   tagColor: 'var(--urgent)' },
            { name: 'Priya Sharma',  hue: 280, w: 1, l: 3, last: 'L',  lastDate: 'Apr 12', tag: 'Unfinished', tagColor: 'var(--response)' },
            { name: 'James Liu',     hue: 150, w: 4, l: 0, last: 'W',  lastDate: 'Apr 08', tag: 'Sweep',     tagColor: 'var(--rally-green)' },
            { name: 'Nina Ramos',    hue: 340, w: 2, l: 2, last: 'L',  lastDate: 'Apr 02', tag: 'Dead even', tagColor: 'var(--ink-3)' },
          ].map((r, i) => (
            <div key={r.name} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px',
              borderTop: i === 0 ? 'none' : '1px solid var(--hairline-2)',
            }}>
              <Avatar name={r.name} size={40} hue={r.hue} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex', alignItems: 'baseline', gap: 8,
                  fontWeight: 700, fontSize: 14, color: 'var(--ink)',
                }}>
                  {r.name}
                  <span style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: 0.06 * 10,
                    textTransform: 'uppercase', color: r.tagColor,
                  }}>{r.tag}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800,
                    color: r.last === 'W' ? 'var(--confirmed)' : 'var(--urgent)',
                    background: r.last === 'W' ? 'var(--confirmed-tint)' : 'var(--urgent-tint)',
                    padding: '1px 5px', borderRadius: 4,
                  }}>{r.last}</span>
                  <span className="num" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    {r.lastDate}
                  </span>
                </div>
              </div>
              <div style={{ minWidth: 92, textAlign: 'right' }}>
                <div className="num" style={{
                  fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 16,
                  letterSpacing: -0.3,
                  color: r.w > r.l ? 'var(--confirmed)'
                       : r.w < r.l ? 'var(--urgent)'
                                   : 'var(--ink-2)',
                }}>
                  {r.w}–{r.l}
                </div>
                <div style={{
                  marginTop: 4, height: 4, background: 'var(--hairline-2)',
                  borderRadius: 999, overflow: 'hidden', display: 'flex',
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

      {/* ═══ 3 · SEASON CHART (from Scoreboard) ═══ */}
      <div style={{ padding: '24px 20px 0' }}>
        <PSectionTitle right="All-time">This season</PSectionTitle>
        <div style={{
          background: 'var(--surface)', borderRadius: 18,
          border: '1px solid var(--hairline-2)', padding: '16px 16px 12px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 10,
          }}>
            <div>
              <div className="num" style={{
                fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 28,
                letterSpacing: -0.8, color: 'var(--ink)', lineHeight: 1,
              }}>+92</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3, fontWeight: 600 }}>
                rating gained this season
              </div>
            </div>
            <div style={{
              fontSize: 10, fontWeight: 800, letterSpacing: 0.08 * 10,
              textTransform: 'uppercase', color: 'var(--rally-green)',
              background: 'var(--rally-green-tint)', padding: '4px 8px', borderRadius: 6,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4 4 14h5v6h6v-6h5L12 4Z"/>
              </svg>
              W3 streak
            </div>
          </div>
          <V4SeasonChart />
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginTop: 6, fontSize: 10, color: 'var(--ink-3)', fontWeight: 600,
          }}>
            <span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span>
          </div>
        </div>
      </div>

      {/* ═══ 4 · TROPHY SHELF (from Clubhouse) ═══ */}
      <div style={{ padding: '24px 20px 0' }}>
        <PSectionTitle right="View all" note="Your proudest moments on court.">Trophy shelf</PSectionTitle>
        <div style={{
          background: 'linear-gradient(170deg, #1B1411 0%, #0E1421 100%)',
          borderRadius: 20, padding: '22px 18px 14px',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* shelf line */}
          <div style={{
            position: 'absolute', left: 18, right: 18, bottom: 50,
            height: 1, background: 'rgba(255,255,255,0.1)',
          }}/>
          <div style={{
            position: 'absolute', left: 18, right: 18, bottom: 48,
            height: 3, background: 'linear-gradient(180deg, rgba(255,255,255,0.06), transparent)',
            borderRadius: 2,
          }}/>
          <div style={{
            display: 'flex', gap: 18, justifyContent: 'space-around',
            alignItems: 'flex-end', position: 'relative', paddingBottom: 40,
          }}>
            <V4Trophy tier="champion" title="Hyde Park" sub="Champion · Jul" />
            <V4Trophy tier="finalist" title="Clapham"   sub="Finalist · Jun" />
            <V4Trophy tier="semi"     title="Battersea" sub="Semi · May" />
          </div>
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 10,
            textAlign: 'center', fontSize: 10, fontWeight: 700,
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: 0.08 * 10, textTransform: 'uppercase',
          }}>3 earned · 5 slots open</div>
        </div>
      </div>

      {/* ═══ 5 · YEAR IN RALLY (from Dossier) ═══ */}
      <div style={{ padding: '24px 20px 0' }}>
        <PSectionTitle>Your year in Rally</PSectionTitle>
        <div style={{
          background: 'var(--ink)', color: '#fff', borderRadius: 18,
          padding: '16px 18px', display: 'grid', gap: 12,
        }}>
          <V4YearRow metric="Matches played"      value="14"    foot="4 this month" />
          <V4YearRow metric="Hours on court"       value="21.5"  foot="~1.5h per match" />
          <V4YearRow metric="Best opponent beaten" value="Priya S." foot="1,628 rating" />
          <V4YearRow metric="Longest streak"       value="W3"    foot="current" accent />
        </div>
      </div>

      <PTabBar />
    </div>
  );
}


// ─────── v4 helpers ───────

function V4Pill({ children, primary }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600,
      padding: '4px 10px', borderRadius: 999,
      background: primary ? 'var(--rally-green)' : 'rgba(255,255,255,0.6)',
      color: primary ? '#fff' : 'var(--ink-2)',
      border: primary ? 'none' : '1px solid var(--hairline-2)',
    }}>{children}</div>
  );
}

function V4SeasonChart() {
  const points = [1300, 1318, 1306, 1334, 1328, 1361, 1352, 1378, 1372, 1395, 1392];
  const min = 1280, max = 1420;
  const w = 320, h = 88;
  const path = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p - min) / (max - min)) * h;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const area = path + ` L${w},${h} L0,${h} Z`;
  const lastX = w, lastY = h - ((points[points.length - 1] - min) / (max - min)) * h;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 88 }}>
      <defs>
        <linearGradient id="v4Area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1F7A4D" stopOpacity="0.28"/>
          <stop offset="100%" stopColor="#1F7A4D" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {[0.33, 0.66].map(t => (
        <line key={t} x1="0" y1={h*t} x2={w} y2={h*t} stroke="var(--hairline-2)" strokeWidth="1"/>
      ))}
      <path d={area} fill="url(#v4Area)" />
      <path d={path} fill="none" stroke="var(--rally-green)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX - 2} cy={lastY} r="9" fill="var(--rally-green)" opacity="0.18" />
      <circle cx={lastX - 2} cy={lastY} r="4" fill="var(--rally-green)" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

function V4Trophy({ tier, title, sub }) {
  const height = tier === 'champion' ? 82 : tier === 'finalist' ? 68 : 58;
  const medalSize = tier === 'champion' ? 56 : 44;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 6, position: 'relative',
    }}>
      <div style={{ height, display: 'flex', alignItems: 'flex-end' }}>
        <MedalGlyph tier={tier} size={medalSize} />
      </div>
      <div style={{
        position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
        width: 40, height: 8, background: 'rgba(255,210,120,0.22)', filter: 'blur(6px)',
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

function V4YearRow({ metric, value, foot, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
      <div style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.72)' }}>{metric}</div>
      <div className="num" style={{
        fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 18,
        letterSpacing: -0.3,
        color: accent ? '#3FBF7E' : '#fff',
      }}>{value}</div>
      <div style={{
        width: 110, textAlign: 'right', fontSize: 11,
        color: 'rgba(255,255,255,0.45)',
      }}>{foot}</div>
    </div>
  );
}

Object.assign(window, { ProfileTabV4 });

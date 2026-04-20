// ───────────────────────────────────────────────────────────
// MatchDetailSheet — what happens when you tap a match cell in the bracket.
//
// This is the "prep view" for an UPCOMING match. Three jobs:
//   1. Reassure: time + court confirmed, both players ready.
//   2. Storytell: head-to-head, recent form, what's at stake.
//   3. Control: minimal scheduling controls (reschedule, walkover) —
//      NO big calendar grid. Just three chips: "Move earlier",
//      "Move later", "Can't make it".
//
// Layout: a 3/4-height iOS sheet on top of a dimmed bracket.
// ───────────────────────────────────────────────────────────

function MatchDetailSheet() {
  return (
    <div style={{
      height: '100%', background: 'var(--canvas)', position: 'relative',
      overflow: 'hidden',
    }}>
      {/* faint bracket behind */}
      <MdBackdrop />

      {/* SHEET */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        height: '86%',
        background: 'var(--surface)',
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        boxShadow: '0 -20px 60px -20px rgba(14,20,33,0.3)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 40, height: 5, borderRadius: 999, background: 'var(--hairline)' }}/>
        </div>

        {/* HEADER */}
        <div style={{ padding: '4px 20px 10px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="eyebrow" style={{ marginBottom: 6, color: 'var(--rally-green)' }}>
              Hyde Park Spring · Semi-final
            </div>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 800,
              letterSpacing: -0.5, color: 'var(--ink)',
            }}>
              You vs Marcus Thompson
            </div>
          </div>
          <button style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'var(--hairline-2)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ink-3)', flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" {...mdStroke}>
              <path d="m6 6 12 12M18 6 6 18"/>
            </svg>
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 20px' }} className="no-scrollbar">

          {/* MATCHUP CARD */}
          <div style={{
            background: 'var(--ink)', color: '#fff', borderRadius: 20,
            padding: '18px 16px', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: -40, right: -40,
              width: 160, height: 160, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(63,191,126,0.2), transparent 70%)',
            }}/>
            {/* time + court */}
            <div style={{
              position: 'relative', display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 12, color: 'rgba(255,255,255,0.55)',
              marginBottom: 14,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" {...mdStroke}>
                <rect x="4" y="5" width="16" height="16" rx="2"/>
                <path d="M8 3v4M16 3v4M4 10h16"/>
              </svg>
              <span className="num" style={{ color: '#fff', fontWeight: 600 }}>Sat Apr 26 · 10:30</span>
              <span>·</span>
              <span>Hyde Park Court 3</span>
              <span style={{
                marginLeft: 'auto',
                fontSize: 10, fontWeight: 700, letterSpacing: 0.06, textTransform: 'uppercase',
                color: '#3FBF7E', background: 'rgba(63,191,126,0.16)',
                padding: '3px 7px', borderRadius: 5,
              }}>Confirmed</span>
            </div>

            {/* players */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <Avatar name="You" size={52} hue={30} />
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 17, fontWeight: 700, marginTop: 8 }}>You</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} className="num">#5 seed · Elo 1,306</div>
              </div>
              <div style={{
                fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 800,
                color: 'rgba(255,255,255,0.55)',
                padding: '4px 8px', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 999,
              }}>VS</div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <Avatar name="Marcus T" size={52} hue={200} />
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 17, fontWeight: 700, marginTop: 8 }}>Marcus T.</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} className="num">#3 seed · Elo 1,321</div>
              </div>
            </div>

            {/* win probability bar */}
            <div style={{ position: 'relative', marginTop: 16 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 0.08 * 10,
                textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)',
                marginBottom: 6, display: 'flex', justifyContent: 'space-between',
              }}>
                <span>Win probability</span>
                <span className="num" style={{ color: '#fff' }}>48% · 52%</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', display: 'flex', overflow: 'hidden' }}>
                <div style={{ width: '48%', background: '#3FBF7E' }}/>
                <div style={{ width: '4%', background: 'transparent' }}/>
                <div style={{ width: '48%', background: 'rgba(255,255,255,0.3)' }}/>
              </div>
            </div>
          </div>

          {/* HEAD TO HEAD */}
          <div style={{ marginTop: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Head to head</div>
            <div style={{
              background: 'var(--surface)', borderRadius: 16,
              border: '1px solid var(--hairline-2)', padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  fontFamily: 'var(--font-sans)', fontSize: 32, fontWeight: 800,
                  letterSpacing: -1, color: 'var(--ink)',
                }} className="num">
                  1<span style={{ color: 'var(--ink-4)', margin: '0 4px' }}>–</span>2
                </div>
                <div style={{ flex: 1, fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.45 }}>
                  Marcus leads your rivalry. <span style={{ color: 'var(--ink)', fontWeight: 600 }}>Last meeting: you won 6-4 6-7 7-5</span> three months ago.
                </div>
              </div>
              <div style={{
                display: 'flex', gap: 4, marginTop: 10, paddingTop: 10,
                borderTop: '1px solid var(--hairline-2)',
              }}>
                <MiniResult won name="You" score="6-4 6-7 7-5" />
                <MiniResult name="Marcus" score="4-6 6-3 6-2" />
                <MiniResult name="Marcus" score="3-6 4-6" />
              </div>
            </div>
          </div>

          {/* RECENT FORM */}
          <div style={{ marginTop: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Recent form</div>
            <div style={{
              background: 'var(--surface)', borderRadius: 16,
              border: '1px solid var(--hairline-2)', overflow: 'hidden',
            }}>
              <FormRow name="You" hue={30} results="WWLWW" form="+2 Elo past 5" />
              <FormRow name="Marcus T." hue={200} results="WWWLW" form="+18 Elo past 5" hotter />
            </div>
          </div>

          {/* SCHEDULING CONTROLS */}
          <div style={{ marginTop: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Match time</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <SchedChip label="Move earlier" hint="9:00 both free" />
              <SchedChip label="Move later" hint="13:30 both free" />
            </div>
            <button style={{
              marginTop: 8, width: '100%', height: 42,
              background: 'transparent', border: '1px solid var(--hairline)',
              borderRadius: 12, color: 'var(--urgent)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              Can't make it · offer walkover
            </button>
          </div>
        </div>

        {/* BOTTOM */}
        <div style={{
          borderTop: '1px solid var(--hairline-2)',
          padding: '12px 16px 28px', background: 'var(--surface)',
          display: 'flex', gap: 8,
        }}>
          <button style={{
            flex: '0 0 auto', height: 50, width: 50, borderRadius: 14,
            border: '1px solid var(--hairline)', background: 'var(--surface)',
            color: 'var(--ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" {...mdStroke}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>
            </svg>
          </button>
          <button style={{
            flex: 1, height: 50, border: 'none', borderRadius: 14,
            background: 'var(--ink)', color: '#fff',
            fontFamily: 'var(--font-text)', fontSize: 15, fontWeight: 600,
            letterSpacing: -0.1,
            boxShadow: '0 10px 24px -8px rgba(14,20,33,0.35)',
          }} className="tappable">
            Add to calendar
          </button>
        </div>
      </div>
    </div>
  );
}

function MiniResult({ won, name, score }) {
  return (
    <div style={{
      flex: 1, padding: '8px 10px',
      background: won ? 'var(--rally-green-tint)' : 'var(--canvas)',
      borderRadius: 10,
      border: won ? '1px solid var(--rally-green-soft)' : '1px solid var(--hairline-2)',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 0.06, textTransform: 'uppercase',
        color: won ? 'var(--rally-green-deep)' : 'var(--ink-3)',
      }}>{won ? 'You won' : `${name} won`}</div>
      <div style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 600, marginTop: 2 }} className="num">
        {score}
      </div>
    </div>
  );
}

function FormRow({ name, hue, results, form, hotter }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px',
      borderTop: name === 'You' ? 'none' : '1px solid var(--hairline-2)',
    }}>
      <Avatar name={name} size={28} hue={hue} />
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', flex: 1 }}>
        {name}
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {results.split('').map((r, i) => (
          <div key={i} style={{
            width: 16, height: 16, borderRadius: 4,
            background: r === 'W' ? 'var(--rally-green)' : 'var(--hairline)',
            color: '#fff', fontSize: 9, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{r}</div>
        ))}
      </div>
      <div style={{
        fontSize: 11, fontWeight: 600,
        color: hotter ? 'var(--rally-green)' : 'var(--ink-3)',
        minWidth: 78, textAlign: 'right',
      }} className="num">{form}</div>
    </div>
  );
}

function SchedChip({ label, hint }) {
  return (
    <button style={{
      padding: '10px 12px', background: 'var(--surface)',
      border: '1px solid var(--hairline)', borderRadius: 12,
      textAlign: 'left', cursor: 'pointer',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--rally-green)', marginTop: 2, fontWeight: 600 }} className="num">
        {hint}
      </div>
    </button>
  );
}

function MdBackdrop() {
  // a faint preview of the bracket behind the sheet
  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'var(--canvas)', filter: 'blur(1px)',
    }}>
      <div style={{ padding: '62px 20px 12px' }}>
        <div style={{ height: 12, width: 100, background: 'var(--hairline)', borderRadius: 4, marginBottom: 8 }}/>
        <div style={{ height: 28, width: 120, background: 'var(--hairline)', borderRadius: 6 }}/>
      </div>
      <div style={{ padding: '0 20px' }}>
        <div style={{
          height: 100, background: 'var(--surface)', borderRadius: 22,
          border: '1px solid var(--hairline-2)', marginBottom: 14,
        }}/>
        <div style={{
          height: 260, background: 'var(--surface)', borderRadius: 22,
          border: '1px solid var(--hairline-2)',
        }}/>
      </div>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(14,20,33,0.32)', backdropFilter: 'blur(2px)',
      }}/>
    </div>
  );
}

const mdStroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

Object.assign(window, { MatchDetailSheet });

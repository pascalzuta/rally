// ───────────────────────────────────────────────────────────
// Onboarding — the 30-second promise, made real.
//
// 4 steps shown side-by-side as stacked phones in the canvas:
//   1. Welcome / value prop
//   2. Pick your county (location)
//   3. Set weekly availability (the scheduling-friction-killer step)
//   4. You're in — lobby preview
//
// The availability step is THE moment that matters: by getting it up
// front, Rally can match + schedule autonomously from match 1.
// ───────────────────────────────────────────────────────────

function OnboardingWelcome() {
  return (
    <div style={{
      height: '100%', background: 'var(--canvas)',
      display: 'flex', flexDirection: 'column', position: 'relative',
      overflow: 'hidden',
    }}>
      <OnbTop step={1} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px' }}>
        {/* Hero tennis ball / logo motif */}
        <div style={{
          width: 104, height: 104, borderRadius: 28,
          background: 'var(--ink)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 30, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(circle at 30% 30%, rgba(63,191,126,0.25), transparent 65%)',
          }}/>
          <svg width="54" height="54" viewBox="0 0 24 24" fill="#3FBF7E">
            <circle cx="12" cy="12" r="10"/>
            <path d="M2 12c4 0 7 3 7 7M22 12c-4 0-7 3-7 7M2 12c4 0 7-3 7-7M22 12c-4 0-7-3-7-7"
              fill="none" stroke="#0E1421" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </div>

        <div style={{
          fontFamily: 'var(--font-sans)', fontSize: 42, fontWeight: 800,
          letterSpacing: -1.6, lineHeight: 0.98, color: 'var(--ink)',
          textWrap: 'balance',
        }}>
          Real tennis.<br/>Real tournaments.<br/>
          <span style={{ color: 'var(--rally-green)' }}>No group chat.</span>
        </div>

        <div style={{
          marginTop: 18, fontSize: 16, lineHeight: 1.45,
          color: 'var(--ink-2)', textWrap: 'pretty',
        }}>
          Join your county's Rally lobby. We'll auto-form an 8-person tournament and schedule every match for you.
        </div>
      </div>

      <OnbCTA label="Get started" sub="30 seconds · no credit card" />
    </div>
  );
}

// Step 2 — county picker
function OnboardingCounty() {
  const counties = [
    { name: 'Hyde Park', players: 34, top: true },
    { name: 'Islington', players: 18 },
    { name: 'Camden', players: 12 },
    { name: 'Hackney', players: 8 },
  ];
  return (
    <div style={{
      height: '100%', background: 'var(--canvas)',
      display: 'flex', flexDirection: 'column', position: 'relative',
      overflow: 'hidden',
    }}>
      <OnbTop step={2} onBack />

      <div style={{ padding: '12px 24px 8px' }}>
        <div style={{
          fontFamily: 'var(--font-sans)', fontSize: 28, fontWeight: 800,
          letterSpacing: -0.9, lineHeight: 1.05, color: 'var(--ink)',
          textWrap: 'balance',
        }}>
          Where do you want to play?
        </div>
        <div style={{ marginTop: 8, fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.4 }}>
          We match you with players in your county. You can join more later.
        </div>
      </div>

      {/* map mock */}
      <div style={{
        margin: '14px 20px 0', height: 150, borderRadius: 18,
        background: 'linear-gradient(135deg, #E9F3EC 0%, #F7F5F2 100%)',
        position: 'relative', overflow: 'hidden',
        border: '1px solid var(--hairline-2)',
      }}>
        {/* street lines */}
        <svg width="100%" height="100%" viewBox="0 0 300 150" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
          <path d="M20 40 L280 30" stroke="#DDD" strokeWidth="1" fill="none"/>
          <path d="M40 80 L260 90" stroke="#DDD" strokeWidth="1" fill="none"/>
          <path d="M10 110 L290 120" stroke="#DDD" strokeWidth="1" fill="none"/>
          <path d="M80 10 L70 140" stroke="#DDD" strokeWidth="1" fill="none"/>
          <path d="M180 10 L190 140" stroke="#DDD" strokeWidth="1" fill="none"/>
          {/* area blob */}
          <path d="M60 60 Q110 40 160 55 Q200 70 180 110 Q140 125 90 115 Q50 95 60 60 Z"
            fill="rgba(31,122,77,0.12)" stroke="var(--rally-green)" strokeWidth="1.5" strokeDasharray="3 3"/>
        </svg>
        {/* pin */}
        <div style={{
          position: 'absolute', left: '45%', top: '48%',
          transform: 'translate(-50%, -100%)',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50% 50% 50% 0',
            background: 'var(--rally-green)',
            transform: 'rotate(-45deg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 14px -4px rgba(31,122,77,0.5)',
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: '#fff', transform: 'rotate(45deg)',
            }}/>
          </div>
        </div>
      </div>

      <div style={{ padding: '18px 20px 0' }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Near you</div>
        <div style={{
          background: 'var(--surface)', borderRadius: 16,
          border: '1px solid var(--hairline-2)', overflow: 'hidden',
        }}>
          {counties.map((c, i) => (
            <div key={c.name} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '13px 16px',
              borderTop: i === 0 ? 'none' : '1px solid var(--hairline-2)',
              background: c.top ? 'var(--rally-green-tint)' : 'transparent',
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                border: c.top ? '7px solid var(--rally-green)' : '2px solid var(--hairline)',
              }}/>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 15, fontWeight: 600,
                  color: c.top ? 'var(--rally-green-deep)' : 'var(--ink)',
                }}>{c.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }} className="num">
                  {c.players} active players
                </div>
              </div>
              {c.top && (
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.06,
                  textTransform: 'uppercase', color: 'var(--rally-green-deep)',
                  background: '#fff', padding: '3px 7px', borderRadius: 5,
                }}>Closest</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }}/>
      <OnbCTA label="Join Hyde Park" />
    </div>
  );
}

// Step 3 — availability (the key step)
function OnboardingAvailability() {
  // Quick blocks to tap: Weekday AM, Weekday lunch, Weekday eve, Weekend AM, Weekend PM
  const blocks = [
    { id: 'wdam', label: 'Weekday mornings', hint: '6–9am', selected: false },
    { id: 'wdlu', label: 'Weekday lunch', hint: '12–2pm', selected: false },
    { id: 'wdev', label: 'Weekday evenings', hint: '6–9pm', selected: true },
    { id: 'weam', label: 'Weekend mornings', hint: 'Sat & Sun 8–12', selected: true },
    { id: 'wepm', label: 'Weekend afternoons', hint: 'Sat & Sun 12–6', selected: true },
    { id: 'weev', label: 'Weekend evenings', hint: 'Sat & Sun 6–9', selected: false },
  ];
  return (
    <div style={{
      height: '100%', background: 'var(--canvas)',
      display: 'flex', flexDirection: 'column', position: 'relative',
      overflow: 'hidden',
    }}>
      <OnbTop step={3} onBack />

      <div style={{ padding: '12px 24px 8px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 999,
          background: 'var(--rally-green-tint)', color: 'var(--rally-green-deep)',
          fontSize: 10, fontWeight: 800, letterSpacing: 0.08 * 10,
          textTransform: 'uppercase', marginBottom: 10,
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1c1 0 2 1 2 2v1h2a2 2 0 0 1 2 2v2h-2V6h-2v1c0 1-1 2-2 2s-2-1-2-2V6H8v2H6V6a2 2 0 0 1 2-2h2V3c0-1 1-2 2-2Z"/>
          </svg>
          Magic step
        </div>
        <div style={{
          fontFamily: 'var(--font-sans)', fontSize: 28, fontWeight: 800,
          letterSpacing: -0.9, lineHeight: 1.05, color: 'var(--ink)',
          textWrap: 'balance',
        }}>
          When can you play?
        </div>
        <div style={{ marginTop: 8, fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.4 }}>
          Tap the blocks you're usually free. Rally books matches inside them — no DMs, no polls.
        </div>
      </div>

      <div style={{ padding: '18px 16px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {blocks.map(b => <AvailBlock key={b.id} b={b} />)}
      </div>

      <div style={{ padding: '14px 20px 0' }}>
        <div style={{
          padding: '10px 14px',
          background: 'var(--surface)', border: '1px dashed var(--hairline)',
          borderRadius: 12, fontSize: 12, color: 'var(--ink-2)',
          lineHeight: 1.5,
        }}>
          <strong style={{ color: 'var(--ink)' }}>Based on this,</strong> we can schedule <span style={{ color: 'var(--rally-green)', fontWeight: 700 }} className="num">87%</span> of matches without ever asking you.
        </div>
      </div>

      <div style={{ flex: 1 }}/>
      <OnbCTA label="Looks right" sub="You can fine-tune any time" />
    </div>
  );
}

function AvailBlock({ b }) {
  return (
    <div style={{
      padding: '14px 14px',
      background: b.selected ? 'var(--rally-green)' : 'var(--surface)',
      border: b.selected ? '1px solid var(--rally-green)' : '1px solid var(--hairline)',
      borderRadius: 14,
      boxShadow: b.selected ? '0 8px 18px -8px rgba(31,122,77,0.4)' : 'none',
      color: b.selected ? '#fff' : 'var(--ink)',
      position: 'relative',
    }}>
      <div style={{
        fontSize: 14, fontWeight: 700, letterSpacing: -0.1,
      }}>{b.label}</div>
      <div style={{
        fontSize: 11, marginTop: 3,
        color: b.selected ? 'rgba(255,255,255,0.7)' : 'var(--ink-3)',
      }} className="num">{b.hint}</div>
      {b.selected && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          width: 18, height: 18, borderRadius: '50%',
          background: 'rgba(255,255,255,0.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12 5 5 9-9"/>
          </svg>
        </div>
      )}
    </div>
  );
}

// Step 4 — you're in
function OnboardingLobby() {
  return (
    <div style={{
      height: '100%', background: 'var(--canvas)',
      display: 'flex', flexDirection: 'column', position: 'relative',
      overflow: 'hidden',
    }}>
      <OnbTop step={4} onBack />

      <div style={{ padding: '12px 24px 8px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 999,
          background: 'var(--rally-green)', color: '#fff',
          fontSize: 10, fontWeight: 800, letterSpacing: 0.08 * 10,
          textTransform: 'uppercase', marginBottom: 10,
        }}>
          You're in
        </div>
        <div style={{
          fontFamily: 'var(--font-sans)', fontSize: 30, fontWeight: 800,
          letterSpacing: -1, lineHeight: 1.02, color: 'var(--ink)',
          textWrap: 'balance',
        }}>
          Welcome to Hyde Park.
        </div>
        <div style={{ marginTop: 8, fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.45 }}>
          Next tournament fills at <strong style={{ color: 'var(--ink)' }}>8 players</strong>. You're <span style={{ color: 'var(--rally-green)', fontWeight: 700 }} className="num">#6</span>.
        </div>
      </div>

      {/* Lobby circle viz */}
      <div style={{ padding: '18px 20px 0' }}>
        <div style={{
          background: 'var(--surface)', borderRadius: 20,
          border: '1px solid var(--hairline-2)', padding: '20px 18px',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ textAlign: 'center' }}>
            <LobbyCircle filled={6} total={8} />
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: 20, fontWeight: 800,
              letterSpacing: -0.4, color: 'var(--ink)', marginTop: 14,
            }} className="num">6 of 8 joined</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
              Usually fills in <span style={{ color: 'var(--ink)', fontWeight: 600 }} className="num">2–3 days</span>
            </div>
          </div>

          {/* who's in */}
          <div style={{
            marginTop: 18, padding: '12px 14px',
            background: 'var(--canvas)', borderRadius: 12,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ display: 'flex' }}>
              <div style={{ marginLeft: 0 }}><Avatar name="Priya S" size={26} hue={280} /></div>
              <div style={{ marginLeft: -6 }}><Avatar name="Marcus T" size={26} hue={200} /></div>
              <div style={{ marginLeft: -6 }}><Avatar name="James L" size={26} hue={150} /></div>
              <div style={{ marginLeft: -6 }}><Avatar name="Nina R" size={26} hue={340} /></div>
              <div style={{ marginLeft: -6 }}><Avatar name="Ben K" size={26} hue={60} /></div>
              <div style={{
                marginLeft: -6, width: 26, height: 26, borderRadius: '50%',
                background: 'var(--rally-green)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 800,
                border: '2px solid #fff',
              }}>You</div>
            </div>
            <div style={{ flex: 1, fontSize: 11, color: 'var(--ink-3)' }}>
              <span style={{ color: 'var(--ink)', fontWeight: 600 }}>Priya, Marcus, James</span> and 3 more
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 20px 0' }}>
        <div style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--ink-2)' }}>
          <div style={{ flex: 1, padding: '10px 12px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--hairline-2)' }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Format</div>
            <div style={{ fontWeight: 600, color: 'var(--ink)' }}>Single-elim</div>
          </div>
          <div style={{ flex: 1, padding: '10px 12px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--hairline-2)' }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Length</div>
            <div style={{ fontWeight: 600, color: 'var(--ink)' }}>~2 weeks</div>
          </div>
          <div style={{ flex: 1, padding: '10px 12px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--hairline-2)' }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Entry</div>
            <div style={{ fontWeight: 600, color: 'var(--ink)' }}>Free</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }}/>
      <OnbCTA label="Notify me when it starts" sub="Meanwhile, play a friendly" />
    </div>
  );
}

function LobbyCircle({ filled, total }) {
  const size = 140;
  const r = 56;
  const cx = size / 2, cy = size / 2;
  const slots = [];
  for (let i = 0; i < total; i++) {
    const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    const isMe = i === filled - 1;
    const isFilled = i < filled;
    slots.push(
      <g key={i}>
        <circle cx={x} cy={y} r={isMe ? 14 : 11}
          fill={isFilled ? (isMe ? 'var(--rally-green)' : 'var(--ink)') : '#fff'}
          stroke={isFilled ? 'none' : 'var(--hairline)'}
          strokeWidth={isFilled ? 0 : 2}
          strokeDasharray={isFilled ? '' : '3 3'}
        />
        {isMe && (
          <text x={x} y={y+3} textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff">YOU</text>
        )}
      </g>
    );
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', margin: '0 auto' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--hairline-2)" strokeWidth="1" strokeDasharray="2 4"/>
      {slots}
      <circle cx={cx} cy={cy} r="16" fill="var(--rally-green-tint)"/>
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="14" fontWeight="800" fill="var(--rally-green-deep)" fontFamily="var(--font-sans)">{filled}/{total}</text>
    </svg>
  );
}

// ──────── shared chrome ────────

function OnbTop({ step, onBack }) {
  return (
    <div style={{ padding: '60px 16px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
      {onBack ? (
        <button style={{
          width: 32, height: 32, borderRadius: 10, border: '1px solid var(--hairline)',
          background: 'var(--surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--ink)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" {...oStroke}>
            <path d="M19 12H5m5-5-5 5 5 5"/>
          </svg>
        </button>
      ) : (
        <div style={{ width: 32 }}/>
      )}
      <div style={{ flex: 1, display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 999,
            background: i <= step ? 'var(--ink)' : 'var(--hairline)',
          }}/>
        ))}
      </div>
      <div style={{ width: 32, textAlign: 'right', fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }} className="num">
        {step}/4
      </div>
    </div>
  );
}

function OnbCTA({ label, sub }) {
  return (
    <div style={{ padding: '14px 16px 28px', background: 'var(--canvas)' }}>
      <button style={{
        width: '100%', height: 54, borderRadius: 16, border: 'none',
        background: 'var(--ink)', color: '#fff',
        fontFamily: 'var(--font-text)', fontSize: 16, fontWeight: 600,
        letterSpacing: -0.2, cursor: 'pointer',
        boxShadow: '0 10px 24px -8px rgba(14,20,33,0.35)',
      }} className="tappable">
        {label}
      </button>
      {sub && (
        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: 'var(--ink-3)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

const oStroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

Object.assign(window, {
  OnboardingWelcome, OnboardingCounty, OnboardingAvailability, OnboardingLobby,
});

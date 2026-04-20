// ───────────────────────────────────────────────────────────
// HomeTab — unified home. Urgent hero card + match queue.
//
// Layout (top → bottom):
//   1. Top bar (greeting + inbox + avatar)
//   2. Filter row (Upcoming · Needs you · Past)
//   3. URGENT HERO — the one match that most needs action
//      • if pending: 3 time chips, tap = confirm
//      • if confirmed: big time + court
//   4. Rest of match queue — Variant B cards
//   5. Tournament progress strip (collapsed)
//   6. Glass tab bar
// ───────────────────────────────────────────────────────────

function HomeTab() {
  // The queue, minus the urgent match which becomes the hero.
  const rest = [
    {
      id: 'm2', state: 'needs',
      round: 'Round 1 · Clapham Monthly',
      opp: { name: 'Priya Sharma', rating: 1628, hue: 280, h2h: '1–3' },
      slots: [
        { day: 'Tue', date: 'Apr 23', time: '18:00', court: 'Clapham Common', both: true },
        { day: 'Wed', date: 'Apr 24', time: '19:30', court: 'Clapham Common', both: true },
        { day: 'Sat', date: 'Apr 27', time: '11:00', court: 'Battersea · Court 5', both: true },
      ],
      deadline: '5d to confirm',
    },
    {
      id: 'm3', state: 'confirmed',
      round: 'Round 2 · Hyde Park Summer',
      opp: { name: 'James Liu', rating: 1312, hue: 150, h2h: '4–0' },
      when: { day: 'Wed', date: 'Apr 24', time: '19:00' },
      court: 'Hyde Park · Court 2',
    },
    {
      id: 'm4', state: 'waiting',
      round: 'Round 1 · Clapham Monthly',
      opp: { name: 'Nina Ramos', rating: 1401, hue: 340, h2h: '2–2' },
      note: "Nina hasn't picked a slot yet",
    },
  ];

  return (
    <div style={{
      height: '100%', overflow: 'auto', background: 'var(--canvas)',
      paddingBottom: 120,
    }} className="no-scrollbar">
      {/* top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '62px 20px 10px',
      }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 500 }}>
            Monday · April 21
          </div>
          <div style={{
            fontFamily: 'var(--font-sans)', fontSize: 28, fontWeight: 800,
            letterSpacing: -0.8, color: 'var(--ink)', lineHeight: 1.1, marginTop: 2,
          }}>
            Hi, Alex
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <InboxBell count={2} />
          <Avatar name="Alex Chen" size={40} hue={30} />
        </div>
      </div>

      {/* filter row */}
      <HomeFilterRow />

      {/* URGENT HERO */}
      <div style={{ padding: '14px 16px 0' }}>
        <UrgentHeroCard />
      </div>

      {/* rest of queue */}
      <div style={{ padding: '10px 16px 0', display: 'grid', gap: 10 }}>
        {rest.map(m => <HomeQueueCard key={m.id} m={m} />)}
      </div>

      {/* tournament progress (compact) */}
      <div style={{ padding: '18px 16px 0' }}>
        <TournamentMini />
      </div>

      <TabBar active="home" />
    </div>
  );
}

function HomeFilterRow() {
  const tabs = [
    { id: 'upcoming', label: 'Upcoming', count: 4, active: true },
    { id: 'pending',  label: 'Needs you', count: 2 },
    { id: 'done',     label: 'Past',      count: 9 },
  ];
  return (
    <div style={{
      display: 'flex', gap: 6, padding: '4px 20px 0',
      borderBottom: '1px solid var(--hairline-2)',
    }}>
      {tabs.map(t => (
        <div key={t.id} style={{
          padding: '10px 4px', position: 'relative',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13, fontWeight: 700,
          color: t.active ? 'var(--ink)' : 'var(--ink-3)',
          borderBottom: t.active ? '2px solid var(--rally-green)' : '2px solid transparent',
          marginBottom: -1,
        }}>
          {t.label}
          <span style={{
            fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 999,
            background: t.active ? 'var(--rally-green)' : 'var(--hairline-2)',
            color: t.active ? '#fff' : 'var(--ink-3)',
            minWidth: 18, textAlign: 'center',
          }}>{t.count}</span>
        </div>
      ))}
    </div>
  );
}

// ═══ URGENT HERO — the biggest affordance on the screen ═══

function UrgentHeroCard() {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 22,
      border: '1px solid var(--hairline-2)',
      overflow: 'hidden', position: 'relative',
      boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 18px 36px -20px rgba(14,20,33,0.3)',
    }}>
      <div style={{ padding: '14px 18px 12px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 10, fontWeight: 800, letterSpacing: 0.08 * 10,
            textTransform: 'uppercase', color: 'var(--urgent)',
            background: 'var(--urgent-tint)',
            padding: '3px 7px', borderRadius: 5,
          }}>
            <Pulse /> Needs you
          </div>
          <div style={{ fontSize: 11, color: 'var(--urgent)', fontWeight: 700 }}>
            2d to confirm
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <Avatar name="Marcus Tate" size={48} hue={200} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', letterSpacing: -0.3 }}>
              Marcus Tate
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
              <span className="num">1378</span> · H2H <span className="num">3–2</span> · Round 1 · Hyde Park Summer
            </div>
          </div>
        </div>

        <div style={{
          fontSize: 13, color: 'var(--ink-2)', marginTop: 10, lineHeight: 1.4,
        }}>
          <span style={{ color: 'var(--ink)', fontWeight: 600 }}>Pick a time that works for both of you</span> — all 3 slots below, you're both free.
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6,
        padding: '0 14px 14px',
      }}>
        <HeroTimeChip day="Sat" date="20" time="10:00" court="Hyde Park · C3" featured />
        <HeroTimeChip day="Sat" date="20" time="15:30" court="Hyde Park · C1" />
        <HeroTimeChip day="Sun" date="21" time="09:00" court="Battersea · C2" />
      </div>
    </div>
  );
}

function HeroTimeChip({ day, date, time, court, featured }) {
  return (
    <div style={{
      padding: '10px 8px 9px', borderRadius: 12, textAlign: 'center',
      background: featured ? 'var(--rally-green)' : 'var(--surface)',
      border: featured ? 'none' : '1px solid var(--hairline)',
      color: featured ? '#fff' : 'var(--ink)',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 0.04,
        opacity: featured ? 0.85 : 0.55,
      }}>{day.toUpperCase()} · {date}</div>
      <div className="num" style={{
        fontFamily: 'var(--font-sans)', fontSize: 19, fontWeight: 800,
        letterSpacing: -0.4, lineHeight: 1.1, marginTop: 3,
      }}>{time}</div>
      <div style={{
        fontSize: 9, fontWeight: 600,
        opacity: featured ? 0.85 : 0.5, marginTop: 3,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{court.split(' · ')[1] || court}</div>
    </div>
  );
}

// ═══ Queue cards — Variant B style ═══

function HomeQueueCard({ m }) {
  const isNeeds     = m.state === 'needs';
  const isConfirmed = m.state === 'confirmed';
  const isWaiting   = m.state === 'waiting';

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 18,
      border: '1px solid var(--hairline-2)',
      padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar name={m.opp.name} size={40} hue={m.opp.hue} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', letterSpacing: -0.2 }}>
              {m.opp.name}
            </div>
            <div className="num" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              {m.opp.rating}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>· H2H {m.opp.h2h}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{m.round}</div>
        </div>
        <HomeStateChip state={m.state} deadline={m.deadline}/>
      </div>

      {isNeeds && (
        <div style={{ marginTop: 12 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 0.06 * 10,
            textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8,
          }}>Pick a slot — both free</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {m.slots.map((s, i) => (
              <QueueTimeChip key={i} day={s.day} time={s.time} featured={i === 0}/>
            ))}
          </div>
        </div>
      )}
      {isConfirmed && (
        <div style={{
          marginTop: 12, padding: '10px 12px',
          background: 'var(--rally-green-tint)', borderRadius: 12,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10, background: '#fff',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: 0.04 }}>{m.when.day.toUpperCase()}</div>
            <div className="num" style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', letterSpacing: -0.2, lineHeight: 1 }}>{m.when.date.split(' ')[1]}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="num" style={{ fontSize: 15, fontWeight: 800, color: 'var(--rally-green-deep)', letterSpacing: -0.3 }}>
              {m.when.time}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 1 }}>{m.court}</div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--rally-green)', fontWeight: 700 }}>Details →</div>
        </div>
      )}
      {isWaiting && (
        <div style={{
          marginTop: 12, padding: '10px 12px',
          background: 'var(--response-tint)', borderRadius: 12,
          fontSize: 12, color: 'var(--ink-2)',
        }}>
          {m.note} · <span style={{ color: 'var(--response)', fontWeight: 700 }}>Send a nudge</span>
        </div>
      )}
    </div>
  );
}

function HomeStateChip({ state, deadline }) {
  const map = {
    needs:     { label: 'Needs you',   color: 'var(--urgent)',      bg: 'var(--urgent-tint)' },
    confirmed: { label: 'Confirmed',   color: 'var(--rally-green)', bg: 'var(--rally-green-tint)' },
    waiting:   { label: 'Waiting',     color: 'var(--response)',    bg: 'var(--response-tint)' },
  }[state];
  return (
    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
      <div style={{
        fontSize: 10, fontWeight: 800, letterSpacing: 0.08 * 10, textTransform: 'uppercase',
        color: map.color, background: map.bg, padding: '3px 7px', borderRadius: 5,
      }}>{map.label}</div>
      {deadline && <div style={{ fontSize: 11, color: 'var(--urgent)', fontWeight: 600 }}>{deadline}</div>}
    </div>
  );
}

function QueueTimeChip({ day, time, featured }) {
  return (
    <div style={{
      padding: '8px 4px', textAlign: 'center', borderRadius: 10,
      background: featured ? 'var(--rally-green)' : 'var(--surface)',
      border: featured ? 'none' : '1px solid var(--hairline)',
      color: featured ? '#fff' : 'var(--ink)',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 0.04,
        opacity: featured ? 0.85 : 0.55,
      }}>{day.toUpperCase()}</div>
      <div className="num" style={{
        fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 800,
        letterSpacing: -0.3, lineHeight: 1.1, marginTop: 2,
      }}>{time}</div>
      <div style={{
        fontSize: 9, fontWeight: 600, letterSpacing: 0.04,
        opacity: featured ? 0.9 : 0.5, marginTop: 2,
      }}>BOTH FREE</div>
    </div>
  );
}

// ═══ Tournament mini strip (footer) ═══

function TournamentMini() {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 16,
      border: '1px solid var(--hairline-2)',
      padding: '12px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: 'var(--rally-green-tint)', color: 'var(--rally-green)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
          <path d="M3 5h3v6h6m-6 0v6m0-6H3m0 6h3v6H3m6-6h4l3-6h5M15 14l3 6h3"/>
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: -0.2 }}>
          Hyde Park Summer · R1
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }} className="num">
          3 of 15 matches · you're #3
        </div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--rally-green)', fontWeight: 700 }}>
        Bracket →
      </div>
    </div>
  );
}

// ══ Tab bar ══

function TabBar({ active }) {
  const tabs = [
    { id: 'home', label: 'Home', icon: <IconHome /> },
    { id: 'bracket', label: 'Bracket', icon: <IconBracket /> },
    { id: 'rating', label: 'Rating', icon: <IconRating /> },
    { id: 'profile', label: 'Profile', icon: <IconProfile /> },
  ];
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
          <div style={{ height: 22 }}>{t.icon}</div>
          <div style={{ fontSize: 10, fontWeight: 600 }}>{t.label}</div>
        </div>
      ))}
    </div>
  );
}

// ══ Icons + atoms ══

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

function IconHome() { return <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1v-9.5Z"/></svg>; }
function IconBracket() { return <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}><path d="M3 5h3v6h6m-6 0v6m0-6H3m0 6h3v6H3m6-6h4l3-6h5M15 14l3 6h3"/></svg>; }
function IconRating() { return <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}><path d="M4 20V10M10 20V4M16 20v-8M22 20H3"/></svg>; }
function IconProfile() { return <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>; }

function Pulse() {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: 6, height: 6 }}>
      <span style={{
        position: 'absolute', inset: 0, borderRadius: 999,
        background: 'var(--urgent)', opacity: 0.4,
        animation: 'rallyPulse 1.6s ease-out infinite',
      }} />
      <span style={{
        position: 'relative', width: 6, height: 6, borderRadius: 999,
        background: 'var(--urgent)',
      }} />
      <style>{`@keyframes rallyPulse { 0% { transform: scale(1); opacity: 0.5; } 80% { transform: scale(2.4); opacity: 0; } 100% { transform: scale(2.4); opacity: 0; } }`}</style>
    </span>
  );
}

function InboxBell({ count }) {
  return (
    <div style={{
      width: 40, height: 40, borderRadius: 12,
      background: 'var(--surface)', border: '1px solid var(--hairline-2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
        <path d="M6 8a6 6 0 0 1 12 0v4l2 3H4l2-3V8Z"/>
        <path d="M10 19a2 2 0 0 0 4 0"/>
      </svg>
      {count > 0 && (
        <div style={{
          position: 'absolute', top: 4, right: 4,
          minWidth: 16, height: 16, borderRadius: 999,
          background: 'var(--urgent)', color: '#fff',
          fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 4px',
        }}>{count}</div>
      )}
    </div>
  );
}

Object.assign(window, { HomeTab });

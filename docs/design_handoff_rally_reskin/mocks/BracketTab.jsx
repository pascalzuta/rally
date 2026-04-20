// ───────────────────────────────────────────────────────────
// BracketTab — tournament view. The question I'm answering:
//
//   "I'm in a bracket. What's my path? Who's next? What's the gossip?"
//
// Design moves:
//  • A "swim lane" bracket visualization instead of a traditional tree.
//    Each player is a row; matches are nodes with lines connecting them.
//    Reads horizontally like a TV scoreboard and is MUCH more scannable
//    on mobile than a nested tree.
//  • YOUR path is highlighted in green; everyone else is neutral gray.
//  • Live match gets a pulsing "LIVE" badge.
//  • Top card: tournament meta + prize (the trophy waiting at the end).
//  • Below bracket: "The big story" — the match everyone's watching.
// ───────────────────────────────────────────────────────────

function BracketTab() {
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
        <div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 500 }}>
            Hyde Park · Spring
          </div>
          <div style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 28, fontWeight: 800, letterSpacing: -0.8,
            color: 'var(--ink)', lineHeight: 1.1, marginTop: 2,
          }}>
            Bracket
          </div>
        </div>
        <button style={{
          padding: '8px 12px', border: '1px solid var(--hairline)',
          borderRadius: 10, background: 'var(--surface)',
          fontSize: 12, fontWeight: 600, color: 'var(--ink-2)',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" {...bkStroke}>
            <rect x="4" y="5" width="16" height="16" rx="2"/>
            <path d="M8 3v4M16 3v4M4 10h16"/>
          </svg>
          Apr 15 – Apr 30
        </button>
      </div>

      {/* TOURNAMENT META CARD */}
      <div style={{ padding: '6px 16px 0' }}>
        <BracketHero />
      </div>

      {/* FORMAT + STATUS STRIP */}
      <div style={{
        padding: '12px 20px 0', display: 'flex', gap: 16,
        fontSize: 12, color: 'var(--ink-3)', fontWeight: 500,
      }}>
        <span>• Single elimination</span>
        <span>• 8 players</span>
        <span>• Best of 3 sets</span>
      </div>

      {/* BRACKET */}
      <div style={{ padding: '14px 0 0' }}>
        <SwimLaneBracket />
      </div>

      {/* THE BIG STORY */}
      <div style={{ padding: '8px 20px 0' }}>
        <div className="eyebrow" style={{ marginBottom: 10, marginTop: 16 }}>
          The big story
        </div>
        <BigStoryCard />
      </div>

      {/* ALL MATCHES LIST */}
      <div style={{ padding: '22px 20px 0' }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>All matches</div>
        <MatchList />
      </div>

      <TabBar active="bracket" />
    </div>
  );
}

// ──────── bracket hero ────────

function BracketHero() {
  return (
    <div style={{
      background: 'var(--ink)', color: '#fff',
      borderRadius: 22, padding: '18px 18px 14px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* trophy halo */}
      <div style={{
        position: 'absolute', top: -80, right: -50,
        width: 240, height: 240, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(63,191,126,0.25), transparent 70%)',
      }}/>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 10, fontWeight: 700, letterSpacing: 0.08 * 10,
            textTransform: 'uppercase',
            padding: '3px 7px', borderRadius: 5,
            background: 'rgba(63,191,126,0.16)', color: '#6FD9A3',
          }}>
            <span style={{
              display: 'inline-block', width: 5, height: 5, borderRadius: 999,
              background: '#6FD9A3',
            }}/>
            Round 1 · in progress
          </div>
          <div style={{
            fontFamily: 'var(--font-sans)', fontSize: 20, fontWeight: 800,
            letterSpacing: -0.4, marginTop: 8,
          }}>
            Hyde Park Spring
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 2 }} className="num">
            3 of 7 matches played
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 18,
            background: 'linear-gradient(160deg, #E6E4DF, #9AA0AB)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 20px -6px rgba(14,20,33,0.25)',
          }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="#fff">
              <path d="M8 4h8v2h3a1 1 0 0 1 1 1v2a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 16v2h3v2H8v-2h3v-2a5 5 0 0 1-2.7-3H8a4 4 0 0 1-4-4V7a1 1 0 0 1 1-1h3V4Zm0 4H6v1a2 2 0 0 0 2 2V8Zm8 0v3a2 2 0 0 0 2-2V8h-2Z"/>
            </svg>
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, marginTop: 6, letterSpacing: 0.06, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' }}>
            Trophy
          </div>
        </div>
      </div>

      {/* progress bar */}
      <div style={{ marginTop: 14, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div style={{ width: '43%', height: '100%', background: 'var(--rally-green)' }} />
      </div>
    </div>
  );
}

// ──────── swim-lane bracket ────────

// Players arranged top→bottom. Each horizontal lane = one player's journey.
// Lanes collapse into each other as rounds progress.
function SwimLaneBracket() {
  // Placements; "you" = Alex
  const players = [
    { name: 'Priya S.', seed: 1, hue: 280, you: false, placement: 'QF' },
    { name: 'Alex C.', seed: 5, hue: 30, you: true, placement: 'QF-W' },
    { name: 'James L.', seed: 4, hue: 150, you: false, placement: 'QF-L' },
    { name: 'Marcus T.', seed: 3, hue: 200, you: false, placement: 'QF-W' },
    { name: 'Ben K.', seed: 6, hue: 60, you: false, placement: 'QF-L' },
    { name: 'Nina R.', seed: 2, hue: 340, you: false, placement: 'QF' },
    { name: 'Jordan M.', seed: 7, hue: 180, you: false, placement: 'QF' },
    { name: 'Sam O.', seed: 8, hue: 100, you: false, placement: 'QF' },
  ];

  // This is a visual placeholder — a proper bracket of this style would be
  // computed from a tournament model, but for a design exploration we render
  // a fixed but representative layout.
  return (
    <div style={{
      position: 'relative', margin: '0 16px',
      background: 'var(--surface)', border: '1px solid var(--hairline-2)',
      borderRadius: 20, padding: '16px 0 20px',
    }}>
      {/* round headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(100px,1.3fr) 1fr 1fr 1fr',
        gap: 4, padding: '0 14px 12px',
        fontSize: 10, fontWeight: 700, letterSpacing: 0.08 * 10,
        textTransform: 'uppercase', color: 'var(--ink-3)',
      }}>
        <div>Seeds</div>
        <div>Quarters</div>
        <div>Semis</div>
        <div style={{ color: 'var(--rally-green)' }}>Final</div>
      </div>

      {/* lanes */}
      <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Lane p={players[0]} cells={['Priya S.', 'TBD', '—', '—']}  rank="1" />
        <Pair>
          <Lane p={players[1]} cells={['Alex C.', 'W 6-3 6-4', 'SAT 10:30', '—']} rank="5" win={1} live={2} mine />
          <Lane p={players[2]} cells={['James L.', 'L 3-6 4-6', '—', '—']}  rank="4" loss={1} />
        </Pair>
        <Pair>
          <Lane p={players[3]} cells={['Marcus T.', 'W 6-4 6-2', 'SAT 10:30', '—']} rank="3" win={1} live={2} />
          <Lane p={players[4]} cells={['Ben K.', 'L 4-6 2-6', '—', '—']} rank="6" loss={1} />
        </Pair>
        <Lane p={players[5]} cells={['Nina R.', 'TBD', '—', '—']} rank="2" />
        <Lane p={players[6]} cells={['Jordan M.', 'TBD', '—', '—']} rank="7" />
        <Lane p={players[7]} cells={['Sam O.', 'TBD', '—', '—']} rank="8" />
      </div>

      {/* legend */}
      <div style={{
        display: 'flex', gap: 14, padding: '14px 16px 0',
        fontSize: 11, color: 'var(--ink-3)',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--rally-green)' }}/> Your path
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--ink-4)' }}/> Eliminated
        </span>
      </div>
    </div>
  );
}

function Pair({ children }) {
  return (
    <div style={{
      position: 'relative',
      padding: '4px 0',
      background: 'linear-gradient(to right, transparent 55%, rgba(0,0,0,0.02) 55%, rgba(0,0,0,0.02) 100%)',
      borderRadius: 8,
    }}>
      {children}
    </div>
  );
}

function Lane({ p, cells, rank, win, loss, live, mine }) {
  const labelColor = mine ? 'var(--rally-green)' : loss ? 'var(--ink-4)' : 'var(--ink)';
  const faded = !!loss;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'minmax(100px,1.3fr) 1fr 1fr 1fr',
      gap: 4, alignItems: 'center',
      opacity: faded ? 0.55 : 1,
      background: mine ? 'var(--rally-green-tint)' : 'transparent',
      borderRadius: 10,
      padding: '6px 6px',
    }}>
      {/* seed + player */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <div style={{
          width: 20, height: 20, borderRadius: 6,
          background: mine ? 'var(--rally-green)' : 'var(--hairline-2)',
          color: mine ? '#fff' : 'var(--ink-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 800,
          flexShrink: 0,
        }} className="num">{rank}</div>
        <Avatar name={p.name} size={22} hue={p.hue} />
        <div style={{
          fontSize: 13, fontWeight: mine ? 700 : 500,
          color: labelColor,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {mine ? 'You' : cells[0].split(' ')[0]}
        </div>
      </div>

      {/* QF cell */}
      <BracketCell label={cells[1]} status={win === 1 ? 'win' : loss === 1 ? 'loss' : 'tbd'} mine={mine} />
      {/* SF cell */}
      <BracketCell label={cells[2]} status={live === 2 ? 'live' : 'tbd'} mine={mine} />
      {/* Final cell */}
      <BracketCell label={cells[3]} status="tbd" mine={mine} />
    </div>
  );
}

function BracketCell({ label, status, mine }) {
  if (status === 'tbd' && label === '—') {
    return <div style={{
      height: 28, borderRadius: 7, border: '1px dashed var(--hairline)',
    }}/>;
  }
  const base = {
    height: 28, borderRadius: 7, display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 11, fontWeight: 600,
    padding: '0 6px', overflow: 'hidden', whiteSpace: 'nowrap',
  };
  if (status === 'win') {
    return <div style={{
      ...base,
      background: mine ? 'var(--rally-green)' : 'var(--confirmed-tint)',
      color: mine ? '#fff' : 'var(--rally-green-deep)',
    }} className="num">{label}</div>;
  }
  if (status === 'loss') {
    return <div style={{
      ...base,
      background: 'var(--hairline-2)', color: 'var(--ink-4)',
    }} className="num">{label}</div>;
  }
  if (status === 'live') {
    return <div style={{
      ...base,
      background: mine ? 'var(--ink)' : 'var(--warn-tint)',
      color: mine ? '#fff' : 'var(--warn-ink)',
      border: mine ? 'none' : '1px solid var(--hairline)',
      display: 'flex', gap: 4,
    }}>
      <span style={{
        display: 'inline-block', width: 5, height: 5, borderRadius: 999,
        background: mine ? '#6FD9A3' : 'var(--ink)',
        animation: 'bkPulse 1.2s ease-in-out infinite',
      }}/>
      <span className="num">{label}</span>
      <style>{`@keyframes bkPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>;
  }
  return <div style={{ ...base, color: 'var(--ink-3)', background: 'var(--hairline-2)' }}>{label}</div>;
}

// ──────── big story ────────

function BigStoryCard() {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 20,
      border: '1px solid var(--hairline-2)', overflow: 'hidden',
      position: 'relative',
    }}>
      {/* live rail */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
        background: 'var(--ink)',
      }}/>
      <div style={{ padding: '14px 18px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 10, fontWeight: 700, letterSpacing: 0.08 * 10,
          textTransform: 'uppercase', color: 'var(--warn-ink)',
          background: 'var(--warn-tint)', padding: '4px 8px', borderRadius: 6,
          marginBottom: 10,
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: 999, background: 'var(--ink)',
            animation: 'bkPulse 1.2s ease-in-out infinite',
          }}/>
          Starts in 2 days · biggest upset chance
        </div>

        {/* matchup */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 0',
        }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar name="Priya S." size={40} hue={280} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>Priya S.</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }} className="num">#1 seed · Elo 1,628</div>
            </div>
          </div>
          <div style={{
            fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 13,
            color: 'var(--ink-3)', padding: '3px 8px',
            border: '1px solid var(--hairline)', borderRadius: 999,
          }}>VS</div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, flexDirection: 'row-reverse', textAlign: 'right' }}>
            <Avatar name="Jordan M." size={40} hue={180} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>Jordan M.</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }} className="num">#7 seed · Elo 1,541</div>
            </div>
          </div>
        </div>

        {/* storytelling */}
        <div style={{
          fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5,
          padding: '8px 0 4px', borderTop: '1px solid var(--hairline-2)',
          marginTop: 6,
        }}>
          Jordan is on a 4-match win streak and has closed <span className="num">87 Elo points</span> on
          Priya in the last two weeks. If the upset lands, Rally shuffles the bracket — you'd likely meet Jordan in the semi.
        </div>
      </div>
    </div>
  );
}

// ──────── match list ────────

function MatchList() {
  const matches = [
    { round: 'QF1', a: 'Priya S.', b: 'Sam O.', status: 'upcoming', time: 'Fri 18:00', hueA: 280, hueB: 100 },
    { round: 'QF2', a: 'Alex C.', b: 'James L.', status: 'done', result: 'Alex 6-3 6-4', hueA: 30, hueB: 150, mine: true },
    { round: 'QF3', a: 'Marcus T.', b: 'Ben K.', status: 'done', result: 'Marcus 6-4 6-2', hueA: 200, hueB: 60 },
    { round: 'QF4', a: 'Nina R.', b: 'Jordan M.', status: 'upcoming', time: 'Sat 13:30', hueA: 340, hueB: 180 },
  ];
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 18,
      border: '1px solid var(--hairline-2)', overflow: 'hidden',
    }}>
      {matches.map((m, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px',
          background: m.mine ? 'var(--rally-green-tint)' : 'transparent',
          borderTop: i === 0 ? 'none' : '1px solid var(--hairline-2)',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.08 * 10,
            textTransform: 'uppercase', color: 'var(--ink-3)', width: 28,
          }}>{m.round}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: -4, flexShrink: 0 }}>
            <Avatar name={m.a} size={28} hue={m.hueA} />
            <div style={{ marginLeft: -6 }}>
              <Avatar name={m.b} size={28} hue={m.hueB} />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 600, color: 'var(--ink)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {m.a} <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>vs</span> {m.b}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }} className="num">
              {m.status === 'done' ? m.result : m.time}
            </div>
          </div>
          {m.status === 'done' ? (
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 0.06, textTransform: 'uppercase',
              color: 'var(--ink-3)', padding: '3px 7px',
              background: 'var(--hairline-2)', borderRadius: 6,
            }}>Final</div>
          ) : (
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 0.06, textTransform: 'uppercase',
              color: 'var(--rally-green)', padding: '3px 7px',
              background: 'var(--rally-green-tint)', borderRadius: 6,
            }}>Upcoming</div>
          )}
        </div>
      ))}
    </div>
  );
}

const bkStroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

Object.assign(window, { BracketTab });

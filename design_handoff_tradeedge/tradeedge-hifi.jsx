/* global React */
const { useState, useMemo } = React;

// ────────────────────────────────────────────────────────────────────────────
// Palette — dark + light, brand amber + warm browns
// ────────────────────────────────────────────────────────────────────────────
const PAL = {
  dark: {
    bg:'#1C1613', sidebar:'#231B16', surface:'#251D18', surface2:'#1C1613',
    border:'#3D2E25', borderSoft:'#2B211B',
    text:'#F0E6D8', text2:'#A89687', text3:'#7A6A5C',
    accent:'#E07A3B', accentSoft:'rgba(224,122,59,0.10)', accentSoft2:'rgba(224,122,59,0.18)',
    warn:'#C65A45', warnSoft:'rgba(198,90,69,0.10)',
  },
  light: {
    bg:'#FBF7EE', sidebar:'#F1EADA', surface:'#FFFCF4', surface2:'#F6F0E0',
    border:'#D6CDB8', borderSoft:'#E5DCC4',
    text:'#1a1614', text2:'#5b524a', text3:'#8a8076',
    accent:'#C2521C', accentSoft:'rgba(194,82,28,0.08)', accentSoft2:'rgba(194,82,28,0.14)',
    warn:'#A33A28', warnSoft:'rgba(163,58,40,0.08)',
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Primitives
// ────────────────────────────────────────────────────────────────────────────
function Spark({ w=120, h=30, color, smooth=true }) {
  // 14-point fake equity curve, generally up
  const data = [12,15,11,18,14,22,19,28,24,32,29,38,42,48];
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min;
  const pts = data.map((v,i) => {
    const x = (i / (data.length-1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return [x, y];
  });
  const path = pts.map((p,i) => `${i===0?'M':'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${path} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${w}-${h}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${w}-${h})`}/>
      <path d={path} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function Ring({ size=70, pct=64, color, track }) {
  const r = size/2 - 4, c = 2*Math.PI*r, dash = (pct/100)*c;
  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={track} strokeWidth="3.5"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="3.5"
        strokeDasharray={`${dash} ${c-dash}`} strokeDashoffset={c/4} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}/>
    </svg>
  );
}

function Avatar({ size=28, label='J', P }) {
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%',
      background:`linear-gradient(135deg, ${P.accent}, #C65A45)`,
      display:'flex', alignItems:'center', justifyContent:'center',
      color:'#fff', fontSize:size*0.42, fontWeight:600, fontFamily:"'Inter', sans-serif",
    }}>{label}</div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sidebar — B's editorial sidebar, kept across all screens
// ────────────────────────────────────────────────────────────────────────────
function Sidebar({ active, P, onNav }) {
  const items = [
    ['dashboard','Today'],
    ['log','Log a trade'],
    ['calendar','Calendar'],
    ['history','History'],
    ['stats','Stats'],
    ['insights','Insights'],
    ['brief','Market brief'],
    ['social','Community'],
  ];
  return (
    <div style={{width:220, padding:'28px 22px 22px', borderRight:`1px solid ${P.border}`, display:'flex', flexDirection:'column', gap:28, background:P.sidebar, flexShrink:0}}>
      <div>
        <div style={{fontFamily:"'Fraunces', Georgia, serif", fontSize:22, letterSpacing:'-0.04em', color:P.text, lineHeight:1}}>
          tradeedge<span style={{color:P.accent}}>.</span>
        </div>
        <div style={{fontSize:10, color:P.text3, marginTop:4, fontStyle:'italic', letterSpacing:'0.02em'}}>journal · Vol. IV</div>
      </div>
      <div style={{display:'flex', flexDirection:'column', gap:1}}>
        {items.map(([id,label]) => {
          const isActive = id === active;
          return (
            <div key={id} onClick={() => onNav && onNav(id)} style={{
              padding:'8px 0 8px 12px',
              color: isActive ? P.text : P.text3,
              borderLeft: isActive ? `2px solid ${P.accent}` : '2px solid transparent',
              fontFamily: isActive ? "'Fraunces', serif" : "'Inter', sans-serif",
              fontStyle: isActive ? 'italic' : 'normal',
              fontSize: isActive ? 16 : 13,
              fontWeight: isActive ? 400 : 400,
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}>{label}</div>
          );
        })}
      </div>
      <div style={{marginTop:'auto', display:'flex', flexDirection:'column', gap:14}}>
        <div style={{padding:'12px 14px', background:P.accentSoft, borderRadius:10, border:`1px solid ${P.border}`}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
            <span style={{fontSize:10, color:P.text3, letterSpacing:'0.12em', textTransform:'uppercase'}}>April goal</span>
            <span style={{fontSize:11, color:P.accent, fontWeight:600}}>84%</span>
          </div>
          <div style={{height:4, background:P.border, borderRadius:2, overflow:'hidden'}}>
            <div style={{width:'84%', height:'100%', background:P.accent}}/>
          </div>
          <div style={{fontSize:10, color:P.text3, marginTop:6}}>$8,420 of $10,000</div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:10, paddingTop:12, borderTop:`1px solid ${P.border}`}}>
          <Avatar size={28} label="J" P={P}/>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:12, color:P.text, fontWeight:500}}>Jake Miller</div>
            <div style={{fontSize:10, color:P.text3}}>Pro · 5-day streak</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// DASHBOARD — B's clean editorial top + C's structured card grid below
// ────────────────────────────────────────────────────────────────────────────
function Dashboard({ P }) {
  return (
    <div style={{padding:'36px 44px', height:'100%', overflow:'auto'}}>
      {/* Editorial header */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
        <div style={{fontSize:11, color:P.text3, letterSpacing:'0.16em', textTransform:'uppercase'}}>Monday · April 27, 2026</div>
        <div style={{fontSize:11, color:P.text3, fontFamily:"'JetBrains Mono', monospace"}}>NY · 14:32 · LON open</div>
      </div>
      <div style={{fontFamily:"'Inter', sans-serif", fontSize:30, letterSpacing:'-0.02em', color:P.text, marginTop:10, lineHeight:1.1, fontWeight:600}}>
        Good afternoon, <span style={{color:P.accent}}>Jake</span>.
      </div>
      <div style={{fontSize:13.5, color:P.text2, marginTop:6, maxWidth:540, lineHeight:1.55}}>
        You're up <span style={{color:P.text, fontWeight:500}}>$2,847</span> across 4 trades — win rate is sharp. Keep position sizing tight through the close.
      </div>

      <div style={{height:1, background:P.border, margin:'30px 0 26px'}}/>

      {/* Three-up hero — clean, no boxes (B style) */}
      <div style={{display:'grid', gridTemplateColumns:'1.4fr 1fr 1fr', gap:36}}>
        <div>
          <div style={{fontSize:10, color:P.text3, letterSpacing:'0.16em', textTransform:'uppercase'}}>Today's P&L</div>
          <div style={{fontFamily:"'Inter', sans-serif", fontSize:58, letterSpacing:'-0.03em', color:P.accent, lineHeight:1, marginTop:10, fontWeight:600, fontVariantNumeric:'tabular-nums'}}>
            +$2,847
          </div>
          <div style={{display:'flex', alignItems:'center', gap:12, marginTop:14}}>
            <Spark w={140} h={32} color={P.accent}/>
            <span style={{fontSize:11, color:P.text3}}>+12% week-on-week</span>
          </div>
        </div>
        <div>
          <div style={{fontSize:10, color:P.text3, letterSpacing:'0.16em', textTransform:'uppercase'}}>Win rate</div>
          <div style={{fontFamily:"'Inter', sans-serif", fontSize:42, color:P.text, lineHeight:1, marginTop:10, fontWeight:600, letterSpacing:'-0.02em', fontVariantNumeric:'tabular-nums'}}>
            68<span style={{fontSize:22, color:P.text3, fontWeight:400}}>%</span>
          </div>
          <div style={{fontSize:11, color:P.text3, marginTop:10}}>Last 30 days · 47 trades</div>
        </div>
        <div>
          <div style={{fontSize:10, color:P.text3, letterSpacing:'0.16em', textTransform:'uppercase'}}>Streak</div>
          <div style={{fontFamily:"'Inter', sans-serif", fontSize:42, color:P.text, lineHeight:1, marginTop:10, fontWeight:600, letterSpacing:'-0.02em', fontVariantNumeric:'tabular-nums'}}>
            5<span style={{fontSize:16, color:P.text3, marginLeft:8, fontWeight:400}}>wins</span>
          </div>
          <div style={{fontSize:11, color:P.text3, marginTop:10}}>Stay locked in.</div>
        </div>
      </div>

      <div style={{height:1, background:P.border, margin:'34px 0 22px'}}/>

      {/* Equity curve + pull-quote — B style */}
      <div style={{display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:44}}>
        <div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:14}}>
            <div style={{fontFamily:"'Inter', sans-serif", fontSize:16, fontWeight:600, color:P.text, letterSpacing:'-0.01em'}}>Equity, this month</div>
            <div style={{display:'flex', gap:8, fontSize:10, color:P.text3, letterSpacing:'0.08em', textTransform:'uppercase'}}>
              <span>1W</span><span style={{color:P.accent, fontWeight:500}}>1M</span><span>3M</span><span>YTD</span><span>All</span>
            </div>
          </div>
          <Spark w={520} h={130} color={P.accent}/>
        </div>
        <div style={{borderLeft:`2px solid ${P.accent}`, paddingLeft:22}}>
          <div style={{fontSize:10, color:P.text3, letterSpacing:'0.16em', textTransform:'uppercase', marginBottom:10}}>Today's note</div>
          <div style={{fontFamily:"'Inter', sans-serif", fontSize:16, color:P.text, lineHeight:1.45, letterSpacing:'-0.005em', fontWeight:500}}>
            Your <span style={{color:P.accent}}>VWAP reclaim</span> setup hits 72% — but only before 11 a.m. After that, the edge collapses.
          </div>
          <div style={{fontSize:11, color:P.text3, marginTop:12}}>— pattern engine, 30-day window</div>
        </div>
      </div>

      <div style={{height:1, background:P.border, margin:'34px 0 22px'}}/>

      {/* Lower modular grid — C style, structured cards */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14}}>
        {/* Streak card */}
        <div style={{background:P.surface, border:`1px solid ${P.border}`, borderRadius:14, padding:18}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
            <span style={{fontSize:10, color:P.text3, letterSpacing:'0.12em', textTransform:'uppercase'}}>Win streak</span>
            <span style={{fontSize:16}}>🔥</span>
          </div>
          <div style={{fontFamily:"'Inter', sans-serif", fontSize:30, color:P.text, marginTop:6, letterSpacing:'-0.02em', lineHeight:1, fontWeight:600, fontVariantNumeric:'tabular-nums'}}>5</div>
          <div style={{fontSize:11, color:P.text3, marginTop:4}}>Longest this month: 9</div>
          <div style={{display:'flex', gap:3, marginTop:14}}>
            {[1,1,1,1,1,0,0].map((v,i) => (
              <div key={i} style={{flex:1, height:5, borderRadius:3, background: v ? P.accent : P.border}}/>
            ))}
          </div>
        </div>

        {/* Risk today */}
        <div style={{background:P.surface, border:`1px solid ${P.border}`, borderRadius:14, padding:18}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
            <span style={{fontSize:10, color:P.text3, letterSpacing:'0.12em', textTransform:'uppercase'}}>Risk · today</span>
            <span style={{fontSize:11, color:P.accent, fontWeight:500}}>OK</span>
          </div>
          <div style={{fontFamily:"'Inter', sans-serif", fontSize:22, color:P.text, marginTop:6, letterSpacing:'-0.02em', lineHeight:1.1, fontWeight:600, fontVariantNumeric:'tabular-nums'}}>
            $420 <span style={{fontSize:13, color:P.text3, fontWeight:400}}>of $1,000</span>
          </div>
          <div style={{height:5, background:P.border, borderRadius:3, marginTop:12, overflow:'hidden'}}>
            <div style={{width:'42%', height:'100%', background:P.accent}}/>
          </div>
          <div style={{fontSize:11, color:P.text3, marginTop:8}}>2 of 3 trades used</div>
        </div>

        {/* AI nudge */}
        <div style={{background:P.surface, border:`1px solid ${P.border}`, borderRadius:14, padding:18, position:'relative'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
            <span style={{fontSize:10, color:P.text3, letterSpacing:'0.12em', textTransform:'uppercase'}}>Pattern</span>
            <span style={{fontSize:10, color:P.accent, fontWeight:600, letterSpacing:'0.08em'}}>AI</span>
          </div>
          <div style={{fontSize:13.5, color:P.text, marginTop:8, lineHeight:1.45}}>
            Your <span style={{color:P.accent}}>VWAP reclaim</span> wins 72% before 11 a.m.
          </div>
          <div style={{fontSize:11, color:P.accent, marginTop:14, fontWeight:500, letterSpacing:'0.02em'}}>See pattern →</div>
        </div>
      </div>

      {/* Recent trades — B's editorial list */}
      <div style={{marginTop:34, display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
        <div style={{fontFamily:"'Inter', sans-serif", fontSize:16, fontWeight:600, color:P.text, letterSpacing:'-0.01em'}}>Recent trades</div>
        <div style={{fontSize:11, color:P.text3, letterSpacing:'0.08em', textTransform:'uppercase'}}>See all →</div>
      </div>
      <div style={{marginTop:14}}>
        {[
          ['ES','Long · VWAP reclaim · 09:34','+$340','A'],
          ['NQ','Long · Breakout · 10:12','+$892','A'],
          ['CL','Short · Range fade · 11:45','−$180','C'],
          ['ES','Long · Pullback · 13:08','+$512','B'],
        ].map((r,i) => (
          <div key={i} style={{display:'grid', gridTemplateColumns:'90px 1fr auto 36px', gap:20, padding:'14px 0', borderBottom:`1px solid ${P.border}`, alignItems:'baseline'}}>
            <span style={{fontFamily:"'Inter', sans-serif", fontSize:15, color:P.text, fontWeight:600}}>{r[0]}</span>
            <span style={{fontSize:13, color:P.text2}}>{r[1]}</span>
            <span style={{fontFamily:"'Inter', sans-serif", fontSize:14, color: r[2].startsWith('+') ? P.accent : P.warn, fontWeight:600, fontVariantNumeric:'tabular-nums'}}>{r[2]}</span>
            <span style={{fontFamily:"'Inter', sans-serif", fontSize:13, fontWeight:600, color: r[3]==='A' ? P.accent : P.text3, textAlign:'right'}}>{r[3]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// LOG — C's structured layout, no setup chips, freeform thoughts field
// ────────────────────────────────────────────────────────────────────────────
function Log({ P }) {
  const [outcome, setOutcome] = useState('win');
  const [rating, setRating] = useState('A');

  return (
    <div style={{padding:'36px 44px', height:'100%', overflow:'auto'}}>
      <div style={{maxWidth:780}}>
        <div style={{fontSize:11, color:P.text3, letterSpacing:'0.16em', textTransform:'uppercase'}}>Entry</div>
        <div style={{fontFamily:"'Fraunces', serif", fontSize:34, letterSpacing:'-0.03em', color:P.text, marginTop:10, lineHeight:1.1}}>
          Log a <em style={{color:P.accent}}>trade</em>.
        </div>
        <div style={{fontSize:13.5, color:P.text2, marginTop:6, maxWidth:480, lineHeight:1.5}}>
          The trade is done — what matters now is what you record about it.
        </div>

        <div style={{height:1, background:P.border, margin:'30px 0 24px'}}/>

        {/* Outcome toggle — C style */}
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:22}}>
          {[['win','↗','WIN'],['loss','↘','LOSS']].map(([k,arr,lbl]) => {
            const isActive = outcome === k;
            const c = k==='win' ? P.accent : P.warn;
            return (
              <div key={k} onClick={() => setOutcome(k)} style={{
                padding:'20px 18px',
                borderRadius:14,
                background: isActive ? (k==='win'? P.accentSoft2 : P.warnSoft) : P.surface,
                border: `1.5px solid ${isActive ? c : P.border}`,
                textAlign:'center',
                cursor:'pointer',
                transition:'all 0.15s',
              }}>
                <div style={{fontSize:24, fontWeight:700, color: isActive ? c : P.text2, fontFamily:"'Inter', sans-serif"}}>{arr} {lbl}</div>
              </div>
            );
          })}
        </div>

        {/* Trade details */}
        <div style={{background:P.surface, border:`1px solid ${P.border}`, borderRadius:16, padding:22}}>
          <div style={{fontSize:10, color:P.text3, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:14}}>Trade details</div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
            {[
              ['Symbol','ES'],
              ['Direction','Long ↑'],
              ['Entry price','4521.50'],
              ['Exit price','4528.25'],
              ['Quantity','2'],
              ['P&L','+$675.00'],
            ].map(([l,v]) => (
              <div key={l}>
                <div style={{fontSize:10, color:P.text3, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:6}}>{l}</div>
                <div style={{
                  padding:'12px 14px', background:P.surface2, border:`1px solid ${P.border}`, borderRadius:10,
                  fontSize:14, color: l==='P&L' ? P.accent : P.text,
                  fontFamily: ['Entry price','Exit price','Quantity','P&L'].includes(l) ? "'JetBrains Mono', monospace" : "'Inter', sans-serif",
                  fontWeight: l==='P&L' ? 600 : 400,
                }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Rating */}
        <div style={{marginTop:22}}>
          <div style={{fontSize:10, color:P.text3, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:10}}>How did you trade it?</div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10}}>
            {[['A','Perfect',P.accent],['B','Good',P.text2],['C','Average','#D4A84A'],['D','Poor',P.warn]].map(([k,lbl,c]) => {
              const isActive = rating === k;
              return (
                <div key={k} onClick={() => setRating(k)} style={{
                  padding:'16px 10px',
                  borderRadius:12,
                  background: isActive ? P.accentSoft2 : P.surface,
                  border: `1px solid ${isActive ? P.accent : P.border}`,
                  textAlign:'center',
                  cursor:'pointer',
                  transition:'all 0.15s',
                }}>
                  <div style={{fontFamily:"'Fraunces', serif", fontSize:24, fontWeight:500, color: isActive ? P.accent : c, lineHeight:1}}>{k}</div>
                  <div style={{fontSize:11, color:P.text3, marginTop:4}}>{lbl}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Freeform thoughts — replaces setup chips */}
        <div style={{marginTop:22}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10}}>
            <div style={{fontSize:10, color:P.text3, letterSpacing:'0.12em', textTransform:'uppercase'}}>Your thought process</div>
            <div style={{fontSize:11, color:P.text3, fontStyle:'italic'}}>What did you see? Why this trade?</div>
          </div>
          <div style={{
            background:P.surface, border:`1px solid ${P.border}`, borderRadius:12, padding:'16px 18px',
            minHeight:130, fontSize:14, color:P.text2, fontStyle:'italic',
            fontFamily:"'Fraunces', serif", lineHeight:1.55, letterSpacing:'-0.005em',
          }}>
            Saw the VWAP reclaim after the morning flush, level held twice on the test. Waited for the second confirmation, sized to 2 contracts, took half off at the prior high and trailed the rest. Felt patient — no FOMO, didn't chase the first push…
          </div>
        </div>

        {/* Screenshot drop */}
        <div style={{marginTop:18}}>
          <div style={{fontSize:10, color:P.text3, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:10}}>Screenshot</div>
          <div style={{
            background:P.surface, border:`1px dashed ${P.border}`, borderRadius:12,
            padding:'24px', display:'flex', alignItems:'center', justifyContent:'center', gap:10,
            fontSize:12, color:P.text3,
          }}>
            <span style={{fontSize:18, color:P.text2}}>▦</span>
            <span>Drag a chart screenshot here · or paste · or upload</span>
          </div>
        </div>

        {/* Save row */}
        <div style={{marginTop:28, display:'flex', gap:12, alignItems:'center'}}>
          <div style={{padding:'14px 32px', background:P.accent, color:'#fff', borderRadius:12, fontSize:14, fontWeight:600, cursor:'pointer'}}>Save trade</div>
          <div style={{padding:'14px 24px', border:`1px solid ${P.border}`, color:P.text2, borderRadius:12, fontSize:13, cursor:'pointer'}}>Save & log another</div>
          <div style={{flex:1}}/>
          <div style={{fontSize:11, color:P.text3, fontStyle:'italic'}}>Draft auto-saved</div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// CALENDAR — B's editorial layout, but daily P&L tile font is Inter (sans)
// ────────────────────────────────────────────────────────────────────────────
function CalendarView({ P }) {
  return (
    <div style={{padding:'36px 44px', height:'100%', overflow:'hidden', display:'flex', flexDirection:'column'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
        <div>
          <div style={{fontSize:11, color:P.text3, letterSpacing:'0.16em', textTransform:'uppercase'}}>Calendar</div>
          <div style={{fontFamily:"'Fraunces', serif", fontSize:34, letterSpacing:'-0.03em', color:P.text, marginTop:10, lineHeight:1.1}}>
            April, <em style={{color:P.accent}}>2026</em>
          </div>
        </div>
        <div style={{display:'flex', gap:6, alignItems:'center'}}>
          <div style={{width:34, height:34, border:`1px solid ${P.border}`, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', color:P.text2, cursor:'pointer'}}>‹</div>
          <div style={{fontSize:12, color:P.text3, padding:'0 6px', fontFamily:"'JetBrains Mono', monospace"}}>Apr 2026</div>
          <div style={{width:34, height:34, border:`1px solid ${P.border}`, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', color:P.text2, cursor:'pointer'}}>›</div>
        </div>
      </div>

      <div style={{display:'flex', gap:24, marginTop:14, fontSize:13, color:P.text2}}>
        <div>Up <span style={{color:P.accent, fontWeight:600}}>$8,420</span> month-to-date</div>
        <div style={{color:P.text3}}>·</div>
        <div>47 trades</div>
        <div style={{color:P.text3}}>·</div>
        <div>64% win rate</div>
        <div style={{color:P.text3}}>·</div>
        <div>21 of 30 trading days</div>
      </div>

      <div style={{height:1, background:P.border, margin:'24px 0 18px'}}/>

      <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:8, flex:1}}>
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
          <div key={d} style={{fontSize:10, color:P.text3, letterSpacing:'0.12em', textTransform:'uppercase', padding:'4px 6px'}}>{d}</div>
        ))}
        {Array.from({length:35}, (_,i) => {
          const d = i - 2;
          const valid = d > 0 && d <= 30;
          const data = [340,-180,892,0,512,1283,-420,180,920,-110,612,1450,890,-340,210,118,440,1023,-820,612,330,890,-110,540,720,-220,420,1180,560,810];
          const pnl = valid ? data[d-1] : null;
          const trades = valid ? Math.max(1, Math.round(Math.abs(pnl||0)/300)) : 0;
          const isToday = d === 27;
          const isWeekend = (i % 7) >= 5;
          return (
            <div key={i} style={{
              border:`1px solid ${isToday ? P.accent : P.border}`,
              borderRadius:6,
              padding:'10px 12px',
              background: pnl > 0 ? P.accentSoft : (pnl < 0 ? P.warnSoft : 'transparent'),
              minHeight:78, display:'flex', flexDirection:'column', justifyContent:'space-between',
              opacity: valid ? (isWeekend && !pnl ? 0.5 : 1) : 0,
              boxShadow: isToday ? `0 0 0 1px ${P.accent}` : 'none',
            }}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
                <span style={{fontSize:11, color:P.text3, fontWeight: isToday ? 600 : 400}}>{valid ? d : ''}</span>
                {isToday && <span style={{fontSize:9, color:P.accent, fontStyle:'italic', fontFamily:"'Fraunces', serif"}}>today</span>}
              </div>
              {pnl != null && pnl !== 0 && (
                <div>
                  <div style={{
                    fontFamily:"'Inter', sans-serif",
                    fontSize:14,
                    fontWeight:600,
                    color: pnl>0 ? P.accent : P.warn,
                    letterSpacing:'-0.01em',
                    fontVariantNumeric:'tabular-nums',
                  }}>
                    {pnl>0?'+':'−'}${Math.abs(pnl).toLocaleString()}
                  </div>
                  <div style={{fontSize:10, color:P.text3, marginTop:2}}>{trades} {trades===1?'trade':'trades'}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// STATS — B sidebar + B "The numbers." header + hybrid card/no-card
// ────────────────────────────────────────────────────────────────────────────
function Stats({ P }) {
  return (
    <div style={{padding:'36px 44px', height:'100%', overflow:'auto'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
        <div>
          <div style={{fontSize:11, color:P.text3, letterSpacing:'0.16em', textTransform:'uppercase'}}>Statistics · last 30 days</div>
          <div style={{fontFamily:"'Inter', sans-serif", fontSize:30, letterSpacing:'-0.02em', color:P.text, marginTop:10, lineHeight:1.1, fontWeight:600}}>
            The numbers.
          </div>
        </div>
        <div style={{display:'flex', gap:6, fontSize:10, color:P.text3, letterSpacing:'0.08em', textTransform:'uppercase', alignItems:'center'}}>
          <span>1W</span><span style={{color:P.accent, fontWeight:500}}>1M</span><span>3M</span><span>YTD</span><span>All</span>
        </div>
      </div>

      <div style={{height:1, background:P.border, margin:'28px 0 26px'}}/>

      {/* Top hero — clean, no boxes */}
      <div style={{display:'grid', gridTemplateColumns:'1.4fr 1fr 1fr 1fr', gap:32}}>
        <div>
          <div style={{fontSize:10, color:P.text3, letterSpacing:'0.16em', textTransform:'uppercase'}}>Net P&L</div>
          <div style={{fontFamily:"'Inter', sans-serif", fontSize:48, color:P.accent, marginTop:8, letterSpacing:'-0.03em', lineHeight:1, fontWeight:600, fontVariantNumeric:'tabular-nums'}}>+$24,820</div>
          <div style={{display:'flex', alignItems:'center', gap:10, marginTop:12}}>
            <Spark w={120} h={28} color={P.accent}/>
            <span style={{fontSize:11, color:P.text3}}>+18% vs last 30d</span>
          </div>
        </div>
        <div>
          <div style={{fontSize:10, color:P.text3, letterSpacing:'0.16em', textTransform:'uppercase'}}>Win rate</div>
          <div style={{fontFamily:"'Inter', sans-serif", fontSize:34, color:P.text, marginTop:8, letterSpacing:'-0.02em', lineHeight:1, fontWeight:600, fontVariantNumeric:'tabular-nums'}}>64<span style={{fontSize:18, color:P.text3, fontWeight:400}}>%</span></div>
          <div style={{fontSize:11, color:P.text3, marginTop:10}}>30 wins · 17 losses</div>
        </div>
        <div>
          <div style={{fontSize:10, color:P.text3, letterSpacing:'0.16em', textTransform:'uppercase'}}>Profit factor</div>
          <div style={{fontFamily:"'Inter', sans-serif", fontSize:34, color:P.text, marginTop:8, letterSpacing:'-0.02em', lineHeight:1, fontWeight:600, fontVariantNumeric:'tabular-nums'}}>2.14</div>
          <div style={{fontSize:11, color:P.accent, marginTop:10}}>+0.3 vs prev</div>
        </div>
        <div>
          <div style={{fontSize:10, color:P.text3, letterSpacing:'0.16em', textTransform:'uppercase'}}>Expectancy</div>
          <div style={{fontFamily:"'Inter', sans-serif", fontSize:34, color:P.text, marginTop:8, letterSpacing:'-0.02em', lineHeight:1, fontWeight:600, fontVariantNumeric:'tabular-nums'}}>$182</div>
          <div style={{fontSize:11, color:P.accent, marginTop:10}}>+$22 vs prev</div>
        </div>
      </div>

      <div style={{height:1, background:P.border, margin:'34px 0 22px'}}/>

      {/* Secondary stats — boxed cards (C style) for grouped data */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12}}>
        {[
          ['Avg win','$418',P.accent,null],
          ['Avg loss','−$196',P.warn,null],
          ['Largest win','$1,840',P.accent,'GC · Apr 12'],
          ['Max drawdown','−$1,210',P.warn,'Apr 19 streak'],
        ].map(([l,v,c,sub]) => (
          <div key={l} style={{background:P.surface, border:`1px solid ${P.border}`, borderRadius:12, padding:16}}>
            <div style={{fontSize:10, color:P.text3, letterSpacing:'0.12em', textTransform:'uppercase'}}>{l}</div>
            <div style={{fontFamily:"'Inter', sans-serif", fontSize:22, color:c, marginTop:6, letterSpacing:'-0.02em', fontWeight:600, fontVariantNumeric:'tabular-nums'}}>{v}</div>
            {sub && <div style={{fontSize:11, color:P.text3, marginTop:4}}>{sub}</div>}
          </div>
        ))}
      </div>

      <div style={{height:1, background:P.border, margin:'34px 0 22px'}}/>

      {/* Two-up: by day + win rate ring */}
      <div style={{display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:36}}>
        <div>
          <div style={{fontFamily:"'Inter', sans-serif", fontSize:16, fontWeight:600, color:P.text, marginBottom:18, letterSpacing:'-0.01em'}}>By day of week</div>
          <div style={{display:'flex', alignItems:'flex-end', gap:18, height:140}}>
            {[['Mon',62,'$1,420'],['Tue',88,'$3,180'],['Wed',45,'$820'],['Thu',92,'$3,640'],['Fri',30,'−$240']].map(([d,h,v]) => (
              <div key={d} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:8}}>
                <div style={{fontSize:10, color:P.text3, fontFamily:"'JetBrains Mono', monospace"}}>{v}</div>
                <div style={{width:'100%', height:h, background: h>40 ? P.accent : P.warn, opacity: h>40 ? (h/100*0.7+0.3) : 0.5, borderRadius:'2px 2px 0 0'}}/>
                <span style={{fontSize:11, color:P.text3, letterSpacing:'0.08em', textTransform:'uppercase'}}>{d}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:24, paddingLeft:24, borderLeft:`1px solid ${P.border}`}}>
          <Ring size={120} pct={64} color={P.accent} track={P.border}/>
          <div>
            <div style={{fontFamily:"'Inter', sans-serif", fontSize:16, fontWeight:600, color:P.text, letterSpacing:'-0.01em'}}>Win rate</div>
            <div style={{fontFamily:"'Inter', sans-serif", fontSize:38, color:P.accent, letterSpacing:'-0.03em', lineHeight:1, marginTop:4, fontWeight:700, fontVariantNumeric:'tabular-nums'}}>64%</div>
            <div style={{fontSize:11, color:P.text3, marginTop:8, lineHeight:1.5, maxWidth:150}}>You hit your edge most reliably on Tuesdays and Thursdays.</div>
          </div>
        </div>
      </div>

      <div style={{height:1, background:P.border, margin:'34px 0 22px'}}/>

      {/* Setups — clean list, no boxes */}
      <div style={{fontFamily:"'Inter', sans-serif", fontSize:16, fontWeight:600, color:P.text, marginBottom:14, letterSpacing:'-0.01em'}}>Setups, ranked</div>
      <div>
        {[['Breakout','+$1,842','72%','24 trades',0.95],['VWAP reclaim','+$923','64%','18 trades',0.6],['Pullback','+$412','58%','12 trades',0.35],['Range fade','−$218','41%','9 trades',0.18]].map((r,i) => (
          <div key={i} style={{display:'grid', gridTemplateColumns:'180px 1fr 100px 70px 70px', gap:18, padding:'14px 0', borderBottom:`1px solid ${P.border}`, alignItems:'center'}}>
            <span style={{fontFamily:"'Inter', sans-serif", fontSize:14, color:P.text, fontWeight: i===0 ? 600 : 500}}>{r[0]}</span>
            <div style={{height:5, background:P.border, borderRadius:3, overflow:'hidden'}}>
              <div style={{width:`${r[4]*100}%`, height:'100%', background: r[1].startsWith('+') ? P.accent : P.warn}}/>
            </div>
            <span style={{fontFamily:"'JetBrains Mono', monospace", fontSize:13, color: r[1].startsWith('+') ? P.accent : P.warn, textAlign:'right', fontWeight:500}}>{r[1]}</span>
            <span style={{fontSize:12, color:P.text2, textAlign:'right', fontFamily:"'JetBrains Mono', monospace"}}>{r[2]}</span>
            <span style={{fontSize:11, color:P.text3, textAlign:'right'}}>{r[3]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Cover
// ────────────────────────────────────────────────────────────────────────────
function Cover({ mode, P }) {
  return (
    <div style={{padding:44, fontFamily:"'Inter', sans-serif", height:'100%', background:P.bg, color:P.text, display:'flex', flexDirection:'column', justifyContent:'space-between', border:`1px solid ${P.border}`}}>
      <div>
        <div style={{fontSize:11, color:P.text3, letterSpacing:'0.16em', textTransform:'uppercase'}}>Hi-fi · Vol. 1</div>
        <div style={{fontFamily:"'Fraunces', serif", fontSize:46, letterSpacing:'-0.03em', marginTop:14, lineHeight:1.05}}>
          tradeedge<span style={{color:P.accent}}>.</span>
        </div>
        <div style={{fontFamily:"'Fraunces', serif", fontSize:22, fontStyle:'italic', color:P.text2, marginTop:8, maxWidth:560, lineHeight:1.4}}>
          A trading journal that's actually nice to come back to.
        </div>
        <div style={{fontSize:13.5, color:P.text2, marginTop:18, maxWidth:580, lineHeight:1.55}}>
          Editorial sidebar (B), structured cards where they earn their place (C), and a freeform notes field where setup chips used to be. Currently in <b>{mode}</b> mode — flip it in the Tweaks panel.
        </div>
      </div>
      <div style={{borderTop:`1px solid ${P.border}`, paddingTop:18, fontSize:12, color:P.text3, lineHeight:1.6, fontStyle:'italic', fontFamily:"'Fraunces', serif"}}>
        Click any artboard label to open it fullscreen. Use ← / → / Esc to navigate.
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Frame: sidebar + content area
// ────────────────────────────────────────────────────────────────────────────
function Frame({ active, mode, children }) {
  const P = PAL[mode] || PAL.dark;
  return (
    <div style={{display:'flex', height:'100%', background:P.bg, color:P.text, fontFamily:"'Inter', sans-serif", border:`1px solid ${P.border}`, overflow:'hidden'}}>
      <Sidebar active={active} P={P}/>
      <div style={{flex:1, minWidth:0, overflow:'hidden'}}>{React.cloneElement(children, { P })}</div>
    </div>
  );
}

Object.assign(window, {
  Cover, Frame, PAL,
  Dashboard, Log, CalendarView, Stats,
});

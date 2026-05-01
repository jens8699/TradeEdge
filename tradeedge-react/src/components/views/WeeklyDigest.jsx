import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { fmt, computeStats } from '../../lib/utils';

// ── Date helpers ────────────────────────────────────────────────────────────
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d)   { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function ymd(d)        { return new Date(d).toISOString().slice(0, 10); }

// Monday-of-week (using local time)
function startOfWeek(d) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  return x;
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

const PRESETS = {
  this_week: () => {
    const start = startOfWeek(new Date());
    return { start, end: endOfDay(addDays(start, 6)) };
  },
  last_week: () => {
    const thisStart = startOfWeek(new Date());
    const start = addDays(thisStart, -7);
    return { start, end: endOfDay(addDays(start, 6)) };
  },
  last_30: () => {
    const end = endOfDay(new Date());
    const start = startOfDay(addDays(end, -29));
    return { start, end };
  },
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Aggregations ────────────────────────────────────────────────────────────
function getDayBuckets(trades, start, end) {
  // Only used for week-sized ranges (returns 7 buckets)
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    days.push({ date: d, label: DAY_LABELS[i], trades: [], pnl: 0, count: 0, wins: 0 });
  }
  for (const t of trades) {
    const td = new Date(t.date);
    if (td < start || td > end) continue;
    const idx = Math.floor((startOfDay(td) - startOfDay(start)) / 86400000);
    if (idx >= 0 && idx < 7) {
      const bucket = days[idx];
      bucket.trades.push(t);
      bucket.pnl += t.pnl || 0;
      bucket.count++;
      if (t.outcome === 'win' || t.pnl > 0) bucket.wins++;
    }
  }
  return days;
}

function getTopSetups(trades) {
  const by = {};
  for (const t of trades) {
    if (!t.setup) continue;
    const k = t.setup;
    if (!by[k]) by[k] = { name: k, count: 0, pnl: 0, wins: 0 };
    by[k].count++;
    by[k].pnl += t.pnl || 0;
    if (t.outcome === 'win' || t.pnl > 0) by[k].wins++;
  }
  return Object.values(by)
    .sort((a, b) => b.pnl - a.pnl)
    .slice(0, 5);
}

function getDisciplineStats(trades) {
  const tagged = trades.filter(t => t.checklistPassed === true || t.checklistPassed === false);
  if (tagged.length === 0) return null;
  const onPlan  = tagged.filter(t => t.checklistPassed === true);
  const offPlan = tagged.filter(t => t.checklistPassed === false);
  return {
    onPlanCount:  onPlan.length,
    offPlanCount: offPlan.length,
    passRate:     (onPlan.length / tagged.length) * 100,
    onPlanPnl:    onPlan.reduce((s, t) => s + (t.pnl || 0), 0),
    offPlanPnl:   offPlan.reduce((s, t) => s + (t.pnl || 0), 0),
  };
}

function getBestAndWorst(trades) {
  if (!trades.length) return { best: null, worst: null };
  let best = trades[0], worst = trades[0];
  for (const t of trades) {
    if ((t.pnl || 0) > (best.pnl || 0))   best = t;
    if ((t.pnl || 0) < (worst.pnl || 0))  worst = t;
  }
  return { best, worst };
}

// ── Main view ───────────────────────────────────────────────────────────────
export default function WeeklyDigest() {
  const { trades } = useApp();
  const [presetId, setPresetId] = useState('this_week');
  const range = useMemo(() => PRESETS[presetId](), [presetId]);

  const periodTrades = useMemo(() => {
    return trades.filter(t => {
      const td = new Date(t.date);
      return td >= range.start && td <= range.end;
    });
  }, [trades, range]);

  const stats = computeStats(periodTrades);
  const dayBuckets = (presetId === 'this_week' || presetId === 'last_week')
    ? getDayBuckets(periodTrades, range.start, range.end)
    : null;
  const topSetups = getTopSetups(periodTrades);
  const discipline = getDisciplineStats(periodTrades);
  const { best, worst } = getBestAndWorst(periodTrades);

  const rangeLabel = presetId === 'last_30'
    ? `Last 30 days · ${ymd(range.start)} → ${ymd(range.end)}`
    : `Week of ${formatDateLong(range.start)} – ${formatDateLong(range.end)}`;

  const maxBucketAbs = dayBuckets
    ? Math.max(1, ...dayBuckets.map(d => Math.abs(d.pnl)))
    : 1;

  return (
    <div className="digest-root" style={{
      padding: 'clamp(20px, 5vw, 36px) clamp(16px, 4.5vw, 44px) 64px',
      maxWidth: 880, margin: '0 auto',
    }}>
      {/* ── Toolbar (hidden in print) ── */}
      <div className="digest-toolbar" style={{
        display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', marginBottom: 28,
      }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'var(--c-overlay-subtle)', border: '1px solid var(--c-border)', borderRadius: 8, padding: 4 }}>
          {[
            ['this_week', 'This week'],
            ['last_week', 'Last week'],
            ['last_30',   'Last 30 days'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setPresetId(id)}
              style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 11.5,
                fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, cursor: 'pointer',
                background: presetId === id ? 'var(--c-accent)' : 'transparent',
                color: presetId === id ? '#17150F' : 'var(--c-text-2)',
                border: 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => window.print()}
          style={{
            padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: 'var(--c-accent)', color: '#fff', border: 'none', cursor: 'pointer',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          ⤓ Print / Save as PDF
        </button>
      </div>

      {/* ── Editorial header ── */}
      <header style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10.5, color: 'var(--c-text-2)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>
          {rangeLabel}
        </div>
        <h1 style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: 'clamp(24px, 4vw, 32px)',
          letterSpacing: '-0.03em', color: 'var(--c-text)',
          lineHeight: 1.1, margin: 0,
        }}>
          {periodTrades.length === 0
            ? <>The <em style={{ fontStyle: 'italic', color: 'var(--c-accent)' }}>quiet</em> week<span style={{ color: 'var(--c-accent)' }}>.</span></>
            : <>Your <em style={{ fontStyle: 'italic', color: 'var(--c-accent)' }}>weekly</em> digest<span style={{ color: 'var(--c-accent)' }}>.</span></>
          }
        </h1>
      </header>

      {periodTrades.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--c-text-2)', fontSize: 14, lineHeight: 1.6 }}>
          No trades logged in this range.<br />
          <span style={{ opacity: 0.7 }}>Pick another period above, or log some trades to see your digest.</span>
        </div>
      ) : (
        <>
          {/* ── Top stats ── */}
          <section className="digest-section" style={{ marginBottom: 28 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
              <BigStat
                label="Net P&L"
                value={`${stats.totalPnl >= 0 ? '+' : ''}${fmt(stats.totalPnl)}`}
                color={stats.totalPnl >= 0 ? 'var(--c-accent)' : '#C65A45'}
                size="clamp(22px, 3vw, 30px)"
              />
              <BigStat label="Trades"        value={String(stats.count)} size={24} />
              <BigStat label="Win rate"      value={`${stats.winRate.toFixed(0)}%`} size={24} />
              <BigStat
                label="Profit factor"
                value={isFinite(stats.pf) ? stats.pf.toFixed(2) : '∞'}
                size={24}
              />
            </div>
          </section>

          {/* ── Day breakdown ── */}
          {dayBuckets && (
            <section className="digest-section" style={{ marginBottom: 28 }}>
              <Eyebrow>Day by day</Eyebrow>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                {dayBuckets.map(d => {
                  const heightPct = (Math.abs(d.pnl) / maxBucketAbs) * 100;
                  return (
                    <div key={+d.date} style={{
                      border: '1px solid var(--c-border)', borderRadius: 10,
                      padding: '10px 6px', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: 5, minHeight: 110,
                    }}>
                      <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: 'var(--c-text-2)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{d.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--c-text-2)' }}>
                        {d.date.getDate()}
                      </div>
                      {/* Bar */}
                      <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', minHeight: 40 }}>
                        {d.count > 0 ? (
                          <div style={{
                            width: '60%',
                            height: `${heightPct || 6}%`,
                            minHeight: 6,
                            background: d.pnl >= 0 ? 'var(--c-accent)' : '#C65A45',
                            borderRadius: '3px 3px 0 0',
                            opacity: 0.7,
                          }} />
                        ) : (
                          <div style={{ fontSize: 10, color: 'var(--c-text-2)', opacity: 0.4 }}>—</div>
                        )}
                      </div>
                      <div style={{
                        fontSize: 11, fontWeight: 700,
                        color: d.count === 0 ? 'var(--c-text-2)'
                             : d.pnl >= 0 ? 'var(--c-accent)' : '#C65A45',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {d.count === 0 ? '—' : (d.pnl >= 0 ? '+' : '') + fmt(d.pnl).replace('$', '$')}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--c-text-2)', opacity: 0.7 }}>
                        {d.count} trade{d.count === 1 ? '' : 's'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Best & worst ── */}
          {(best || worst) && (
            <section className="digest-section" style={{ marginBottom: 28 }}>
              <Eyebrow>Highs &amp; lows</Eyebrow>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {best && (
                  <TradeCallout
                    label="Best trade"
                    trade={best}
                    color="var(--c-accent)"
                  />
                )}
                {worst && worst !== best && (worst.pnl || 0) < 0 && (
                  <TradeCallout
                    label="Worst trade"
                    trade={worst}
                    color="#C65A45"
                  />
                )}
              </div>
            </section>
          )}

          {/* ── Top setups ── */}
          {topSetups.length > 0 && (
            <section className="digest-section" style={{ marginBottom: 28 }}>
              <Eyebrow>Top setups</Eyebrow>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {topSetups.map((s, i) => {
                  const wr = s.count > 0 ? (s.wins / s.count) * 100 : 0;
                  const maxAbs = Math.max(1, ...topSetups.map(x => Math.abs(x.pnl)));
                  return (
                    <div key={s.name} style={{
                      display: 'grid', gridTemplateColumns: '1fr auto auto',
                      gap: 16, padding: '12px 0', alignItems: 'center',
                      borderBottom: i < topSetups.length - 1 ? '1px solid var(--c-border)' : 'none',
                    }}>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--c-text)', marginBottom: 6 }}>
                          {s.name}
                        </div>
                        <div style={{ height: 4, background: 'var(--c-overlay-medium)', borderRadius: 2, maxWidth: 280, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${(Math.abs(s.pnl) / maxAbs) * 100}%`,
                            background: s.pnl >= 0 ? 'var(--c-accent)' : '#C65A45',
                          }} />
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--c-text-2)', textAlign: 'right' }}>
                        {s.count}× · {wr.toFixed(0)}% WR
                      </div>
                      <div style={{
                        fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                        minWidth: 80, textAlign: 'right',
                        color: s.pnl >= 0 ? 'var(--c-accent)' : '#C65A45',
                      }}>
                        {s.pnl >= 0 ? '+' : ''}{fmt(s.pnl)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Discipline ── */}
          {discipline && (
            <section className="digest-section" style={{ marginBottom: 28 }}>
              <Eyebrow>Discipline</Eyebrow>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <BigStat
                  label="Checklist pass rate"
                  value={`${discipline.passRate.toFixed(0)}%`}
                  color="var(--c-text)"
                  size={26}
                  sub={`${discipline.onPlanCount} on plan · ${discipline.offPlanCount} off plan`}
                />
                <BigStat
                  label="On-plan P&L"
                  value={`${discipline.onPlanPnl >= 0 ? '+' : ''}${fmt(discipline.onPlanPnl)}`}
                  color={discipline.onPlanPnl >= 0 ? 'var(--c-accent)' : '#C65A45'}
                  size={22}
                />
                {discipline.offPlanCount > 0 && (
                  <BigStat
                    label="Off-plan P&L"
                    value={`${discipline.offPlanPnl >= 0 ? '+' : ''}${fmt(discipline.offPlanPnl)}`}
                    color={discipline.offPlanPnl >= 0 ? '#EFC97A' : '#C65A45'}
                    size={22}
                  />
                )}
              </div>
            </section>
          )}

          {/* ── Footer ── */}
          <div style={{
            marginTop: 40, paddingTop: 18, borderTop: '1px solid var(--c-border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            fontSize: 11, color: 'var(--c-text-2)', fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '0.06em', flexWrap: 'wrap', gap: 8,
          }}>
            <span>tradeedge · {periodTrades.length} trade{periodTrades.length === 1 ? '' : 's'} · {rangeLabel}</span>
            <span>Generated {new Date().toLocaleString()}</span>
          </div>
        </>
      )}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function Eyebrow({ children }) {
  return (
    <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 14, fontFamily: "'JetBrains Mono', monospace" }}>
      {children}
    </div>
  );
}

function BigStat({ label, value, color, size = 24, sub }) {
  // size can be a number (px) or any valid CSS font-size string (e.g. clamp())
  const fontSize = typeof size === 'number' ? `${size}px` : size;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, color: 'var(--c-text-2)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}>
        {label}
      </div>
      <div style={{
        fontSize, fontWeight: 600, color: color || 'var(--c-text)',
        fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1.05,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--c-text-2)', marginTop: 6 }}>{sub}</div>
      )}
    </div>
  );
}

function TradeCallout({ label, trade, color }) {
  return (
    <div style={{
      border: '1px solid var(--c-border)', borderRadius: 12, padding: '12px 16px',
      background: 'var(--c-surface)',
    }}>
      <div style={{ fontSize: 10, color: 'var(--c-text-2)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--c-text)' }}>
          {trade.symbol}
        </span>
        <span style={{ fontSize: 11, color: 'var(--c-text-2)' }}>
          {trade.direction === 'long' || trade.direction === 'Long' ? '↑ Long' : '↓ Short'}{trade.setup ? ' · ' + trade.setup : ''}
        </span>
      </div>
      <div style={{
        fontSize: 18, fontWeight: 700, color, marginTop: 4,
        fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {(trade.pnl || 0) >= 0 ? '+' : ''}{fmt(trade.pnl || 0)}
      </div>
      <div style={{ fontSize: 11, color: 'var(--c-text-2)', marginTop: 4 }}>
        {trade.date}
      </div>
    </div>
  );
}

function formatDateLong(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

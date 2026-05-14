import { useState, useEffect, useRef } from 'react';
import Lenis from 'lenis';
import './landing.css';

// ── Lenis smooth scroll ────────────────────────────────────────────────────────
function useLenis() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.15,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothTouch: false,
      touchMultiplier: 1.8,
    });

    // Wire up nav anchor links
    document.querySelectorAll('a[href^="#"]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        const id = el.getAttribute('href').slice(1);
        const target = document.getElementById(id);
        if (target) lenis.scrollTo(target, { offset: -72, duration: 1.2 });
      });
    });

    let rafId;
    function raf(time) { lenis.raf(time); rafId = requestAnimationFrame(raf); }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);
}

// ── CountUp on view ────────────────────────────────────────────────────────────
// Triggers once when the element first crosses ~40% visibility, animating from 0
// to `target` over ~1.2s with cubic ease-out. Locale-formatted with `$` prefix.
function CountUp({ target, prefix = '$', duration = 1200, className }) {
  const ref = useRef(null);
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !startedRef.current) {
            startedRef.current = true;
            const start = performance.now();
            const ease = t => 1 - Math.pow(1 - t, 3); // cubic ease-out
            const tick = now => {
              const t = Math.min(1, (now - start) / duration);
              setValue(Math.round(target * ease(t)));
              if (t < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}{value.toLocaleString('en-US')}
    </span>
  );
}

// ── FAQ Item ──────────────────────────────────────────────────────────────────
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lp-faq-item">
      <div className="lp-faq-q" onClick={() => setOpen(o => !o)}>
        <span>{q}</span>
        <span className="lp-faq-plus" style={{ transform: open ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }}>+</span>
      </div>
      {open && <div className="lp-faq-a">{a}</div>}
    </div>
  );
}

// ── Contact email — single source of truth, easy to change ────────────────────
const CONTACT_EMAIL = 'hello@tradeedge.today';
const SUPPORT_EMAIL = 'support@tradeedge.today';

// ── Firm ROI Calculator ──────────────────────────────────────────────────────
// Hand-coded fee data. ALL `TODO:VERIFY` values are rough estimates pending
// confirmation against the firms' actual pricing pages. Each row also keeps
// a `verifiedAt` timestamp so we can surface stale data to users later.
//
// Schema per firm:
//   name          display name
//   tag           short pill label ("FUTURES", "FUTURES+FOREX", etc.)
//   sizes         account sizes offered ($, must match keys in evalFee + payoutMin)
//   evalFee       { sizeKey → one-time eval cost in USD }
//   monthlyFee    recurring funded-account fee in USD per month (0 if none)
//   profitSplit   trader's share, 0–1 (e.g. 0.9 = 90%)
//   payoutFreq    'daily' | 'weekly' | 'biweekly' | 'monthly'
//   payoutMin     { sizeKey → min profit USD before first payout is allowed }
//   drawdown      brief human description
//   note          one-line callout (best for X traders / quirky rules / etc.)
//   link          URL to firm's pricing page (for "verify" + future deep-link)
// Values current as of 2026-05-14. Activation fees bundled into evalFee where
// applicable so the comparison reflects actual upfront cost.
// `drawdownDollars` is the max loss the firm tolerates before you blow the
// account — used by the feasibility check (your max-consec-loss-budget at
// your win rate × risk-per-trade must stay under this).
const FIRMS = [
  {
    name: 'FTMO',
    tag: 'FOREX + FUTURES',
    sizes: [25000, 50000, 100000, 150000],
    evalFee:    { 25000: 168, 50000: 270, 100000: 583, 150000: 870 },
    monthlyFee: 0,
    profitSplit: 0.80,
    payoutFreq: 'biweekly',
    payoutMin:  { 25000: 0, 50000: 0, 100000: 0, 150000: 0 },
    drawdownDollars: { 25000: 2500, 50000: 5000, 100000: 10000, 150000: 15000 }, // 10% overall
    drawdown:   '10% overall, 5% daily',
    note:       'Forex + futures. 80% base split, scales to 90% with consistency. EUR pricing.',
    link:       'https://ftmo.com/en/pricing/',
  },
  {
    name: 'Apex Trader Funding',
    tag: 'FUTURES',
    sizes: [25000, 50000, 100000, 150000],
    evalFee:    { 25000: 119, 50000: 119, 100000: 139, 150000: 139 },
    monthlyFee: 0,
    profitSplit: 0.90,
    payoutFreq: 'biweekly',
    payoutMin:  { 25000: 1500, 50000: 2600, 100000: 2600, 150000: 4100 },
    drawdownDollars: { 25000: 1500, 50000: 2500, 100000: 3000, 150000: 5000 }, // trailing — typical sizes
    drawdown:   'Trailing — varies by size',
    note:       '100% on first $25k lifetime profit, then 90/10. Promo prices almost always available.',
    link:       'https://apextraderfunding.com/pricing/',
  },
  {
    name: 'TopStep',
    tag: 'FUTURES',
    sizes: [50000, 100000, 150000],
    evalFee:    { 50000: 95, 100000: 149, 150000: 229 },
    monthlyFee: 0,
    profitSplit: 0.90,
    payoutFreq: 'weekly',
    payoutMin:  { 50000: 0, 100000: 0, 150000: 0 },
    drawdownDollars: { 50000: 2000, 100000: 3000, 150000: 4500 }, // trailing
    drawdown:   'Trailing — $2k / $3k / $4.5k',
    note:       'Weekly payouts after 5 winning days. 90% split. Eval is a monthly subscription.',
    link:       'https://www.topstep.com/topstep-prop/',
  },
  {
    name: 'MyFundedFutures',
    tag: 'FUTURES',
    sizes: [50000, 100000, 150000],
    evalFee:    { 50000: 80, 100000: 150, 150000: 270 },
    monthlyFee: 0,
    profitSplit: 0.80,
    payoutFreq: 'biweekly',
    payoutMin:  { 50000: 0, 100000: 0, 150000: 0 },
    drawdownDollars: { 50000: 1500, 100000: 3000, 150000: 4500 }, // 3% EOD
    drawdown:   '3% EOD trailing',
    note:       'Jens trades 5 Builder accounts here. Friendly EOD drawdown, no consistency rule.',
    link:       'https://myfundedfutures.com/challenge',
  },
  {
    name: 'Tradeify',
    tag: 'FUTURES',
    sizes: [25000, 50000, 100000, 150000],
    evalFee:    { 25000: 1611, 50000: 1611, 100000: 1681, 150000: 1751 },
    monthlyFee: 0,
    profitSplit: 0.90,
    payoutFreq: 'daily',
    payoutMin:  { 25000: 0, 50000: 0, 100000: 0, 150000: 0 },
    drawdownDollars: { 25000: 1500, 50000: 2500, 100000: 2500, 150000: 3000 }, // EOD
    drawdown:   '$2.5k–$3k EOD trailing',
    note:       'Daily payouts, 90% split. But $1,500 activation fee post-eval (bundled into "eval cost" shown).',
    link:       'https://tradeify.co/#pricing-section',
  },
  {
    name: 'Alpha Futures',
    tag: 'FUTURES',
    sizes: [25000, 50000, 100000, 150000],
    evalFee:    { 25000: 169, 50000: 228, 100000: 318, 150000: 418 },
    monthlyFee: 0,
    profitSplit: 0.80,
    payoutFreq: 'biweekly',
    payoutMin:  { 25000: 1000, 50000: 2000, 100000: 3000, 150000: 4500 },
    drawdownDollars: { 25000: 1000, 50000: 2000, 100000: 4000, 150000: 6000 }, // 4% EOD
    drawdown:   '4% EOD trailing',
    note:       'Profit split scales 70% → 90% across first 5 payouts. EOD drawdown.',
    link:       'https://alpha-futures.com/',
  },
];

const ACCOUNT_SIZE_OPTIONS = [25000, 50000, 100000, 150000];
const WIN_RATE_OPTIONS = [45, 50, 55, 60, 65];        // %
const RR_OPTIONS = [1.0, 1.5, 2.0, 2.5, 3.0];         // avg reward-to-risk
const TRADES_PER_MONTH_OPTIONS = [10, 25, 50, 100];   // monthly trade count
const RISK_PER_TRADE_PCT = 0.01;                       // 1% of account, fixed for v2

// Archetype presets — calibrated to real 2026 prop-trader stats:
//   scalper:       65%+ WR, 1:1 R:R, 100+ trades/mo
//   day trader:    50–60% WR, 1:1.5–2 R:R, 40–60 trades/mo
//   swing trader:  40–50% WR, 1:2+ R:R, 10–20 trades/mo
//   trend follower: 35–45% WR, 1:3+ R:R, 5–10 trades/mo
// Sources: quantvps.com prop firm stats 2026, propfirmapp.com industry data.
// Users can tweak any input after picking — preset just seeds sane defaults.
const ARCHETYPE_PRESETS = [
  { id: 'scalper',  label: 'Scalper',         winRate: 65, rr: 1.0, trades: 100 },
  { id: 'day',      label: 'Day trader',      winRate: 55, rr: 1.5, trades: 50  },
  { id: 'swing',    label: 'Swing trader',    winRate: 50, rr: 2.0, trades: 20  },
  { id: 'trend',    label: 'Trend follower',  winRate: 45, rr: 3.0, trades: 10  },
];

// Probability-based feasibility check.
// At win rate p, the expected worst losing streak (95% confidence over ~100
// trades) is ceil(log(0.05) / log(1 − p)). If that streak × risk-per-trade
// blows the firm's drawdown, this firm/strategy combo is infeasible —
// you'll bust the account before you ever reach a payout. This is the check
// nobody else surfaces in prop firm calculators.
function expectedMaxConsecLosses(winRatePct) {
  const p = winRatePct / 100;
  if (p >= 1) return 0;
  if (p <= 0) return 99;
  return Math.ceil(Math.log(0.05) / Math.log(1 - p));
}

function fmtCurrency(n) {
  if (!Number.isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  return `${sign}$${Math.round(abs)}`;
}

function FirmRoiCalculator() {
  const [accountSize, setAccountSize] = useState(50000);
  const [winRate, setWinRate] = useState(55);       // %
  const [rr, setRr] = useState(1.5);                // avg R per winner
  const [trades, setTrades] = useState(50);         // trades / month

  // ── Derived: trader's expected monthly P&L from win rate × R:R × trades.
  // Risk per trade is fixed at 1% of account size for v2 simplicity.
  const riskPerTrade$ = accountSize * RISK_PER_TRADE_PCT;
  const winProbability = winRate / 100;
  const avgWin$ = riskPerTrade$ * rr;
  const avgLoss$ = riskPerTrade$;
  const monthlyProfit =
    trades * (winProbability * avgWin$ - (1 - winProbability) * avgLoss$);

  // Expectancy per trade (in $) — what each trade is worth on average.
  const expectancyPerTrade$ = winProbability * avgWin$ - (1 - winProbability) * avgLoss$;

  // Probability-based drawdown check
  const stressConsec = expectedMaxConsecLosses(winRate);
  const stressTestLoss$ = stressConsec * riskPerTrade$;

  // Negative expectancy = strategy itself is a loser. No firm fixes that.
  const strategyIsLosing = expectancyPerTrade$ <= 0;

  // For each firm, compute the bottom-line economics for this profile.
  const rows = FIRMS.map(firm => {
    const sortedSizes = [...firm.sizes].sort((a, b) => a - b);
    const matchedSize = [...sortedSizes].reverse().find(s => s <= accountSize) ?? sortedSizes[0];
    const sizeMatches = matchedSize === accountSize;

    const evalFee = firm.evalFee[matchedSize] ?? null;
    const monthlyFee = firm.monthlyFee ?? 0;
    const minPayout = firm.payoutMin[matchedSize] ?? 0;
    const drawdown$ = firm.drawdownDollars?.[matchedSize] ?? null;

    // ── Feasibility check: at this strategy's stress-test consec-loss budget,
    // does the firm have enough drawdown room? If not, this firm/strategy
    // combo is doomed — you'll bust before you ever reach a payout.
    let feasibility = 'safe';
    if (drawdown$ != null) {
      if (stressTestLoss$ >= drawdown$) feasibility = 'infeasible';
      else if (stressTestLoss$ >= drawdown$ * 0.75) feasibility = 'tight';
    }

    // Trader's monthly take-home: (profit × split) − recurring fee.
    // If monthly profit < firm's min payout threshold OR strategy is losing
    // OR feasibility is infeasible, monthlyTake = 0.
    const grossSplit = monthlyProfit * firm.profitSplit;
    const monthlyTake = (
      strategyIsLosing || feasibility === 'infeasible' || monthlyProfit < minPayout
    ) ? 0 : grossSplit - monthlyFee;

    const breakEvenMonths = monthlyTake > 0 && evalFee != null
      ? evalFee / monthlyTake
      : null;
    const yearNet = monthlyTake > 0 && evalFee != null
      ? (monthlyTake * 12) - evalFee
      : null;

    return {
      firm,
      matchedSize,
      sizeMatches,
      evalFee,
      monthlyFee,
      minPayout,
      drawdown$,
      feasibility,
      monthlyTake,
      breakEvenMonths,
      yearNet,
    };
  });

  // Rank by 12-month net (higher = better). null values sink to bottom.
  const ranked = [...rows].sort((a, b) => {
    if (a.yearNet == null && b.yearNet == null) {
      return (b.drawdown$ ?? 0) - (a.drawdown$ ?? 0);
    }
    if (a.yearNet == null) return 1;
    if (b.yearNet == null) return -1;
    return b.yearNet - a.yearNet;
  });

  // ── Compute "why" reasoning per ranked card.
  // Find each firm's standout attribute(s) vs the field. The winner gets the
  // 2-3 strongest reasons; lower-ranked cards get 1-2 contextual notes.
  const feasibleRows = rows.filter(r => r.feasibility !== 'infeasible' && r.yearNet != null);
  const cheapestEval = feasibleRows.length
    ? Math.min(...feasibleRows.map(r => r.evalFee ?? Infinity))
    : null;
  const bestSplit = feasibleRows.length
    ? Math.max(...feasibleRows.map(r => r.firm.profitSplit))
    : null;
  const biggestDrawdown = feasibleRows.length
    ? Math.max(...feasibleRows.map(r => r.drawdown$ ?? 0))
    : null;

  function reasonsFor(r, rank) {
    if (r.feasibility === 'infeasible') return [];
    const out = [];
    // Winner-only reasons (top of card)
    if (rank === 0) {
      if (r.evalFee === cheapestEval) out.push('Cheapest upfront cost');
      if (r.firm.profitSplit === bestSplit) out.push(`Highest profit split (${Math.round(r.firm.profitSplit * 100)}%)`);
      if (r.drawdown$ === biggestDrawdown && stressTestLoss$ > 0) {
        out.push(`Biggest drawdown buffer (${fmtCurrency(r.drawdown$)} vs your ${fmtCurrency(stressTestLoss$)} stress test)`);
      }
      if (r.breakEvenMonths != null && r.breakEvenMonths < 1) {
        out.push(`Break-even in under a month`);
      }
    } else {
      // Contextual notes for non-winners
      if (r.evalFee === cheapestEval) out.push('Cheapest upfront cost');
      if (r.firm.profitSplit === bestSplit) out.push(`Highest profit split tier`);
      if (r.feasibility === 'tight') {
        out.push(`Stress test eats ${Math.round((stressTestLoss$ / r.drawdown$) * 100)}% of drawdown`);
      }
    }
    return out.slice(0, 3);
  }

  return (
    <section className="lp-roi" id="roi-calculator" style={{
      padding: 'clamp(48px, 8vw, 96px) 0',
      background: 'linear-gradient(180deg, #F5EFE0 0%, #FBF6E9 100%)',
    }}>
      <div className="lp-container">
        <div className="lp-eyebrow-label" style={{ color: '#E07A3B' }}>Firm vs firm</div>
        <h2 className="lp-section-title">
          The <em>math</em> is different for every firm.
        </h2>
        <p className="lp-section-sub">
          Drop your win rate + R:R. We compute your real monthly P&amp;L, then run it through each firm's fees and drawdown rules. Some firms will fit your strategy. Most won't.
        </p>

        {/* ── Archetype presets — one-click "what kind of trader are you" ── */}
        <div style={{ marginTop: 28, marginBottom: 4 }}>
          <div style={{ fontSize: 11, color: '#A89687', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
            Start from a typical trader profile
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ARCHETYPE_PRESETS.map(p => {
              const matches = winRate === p.winRate && rr === p.rr && trades === p.trades;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setWinRate(p.winRate); setRr(p.rr); setTrades(p.trades); }}
                  style={{
                    padding: '8px 16px',
                    fontSize: 12, fontWeight: 600,
                    borderRadius: 100,
                    background: matches ? '#1C1613' : 'rgba(255,255,255,0.7)',
                    color: matches ? '#F0E6D8' : '#1C1613',
                    border: `1px solid ${matches ? '#1C1613' : '#D9CDB5'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
            <span style={{ fontSize: 11, color: '#A89687', alignSelf: 'center', marginLeft: 4 }}>
              or tweak the inputs below ↓
            </span>
          </div>
        </div>

        {/* ── Inputs: account size · win rate · R:R · trades/month ─────────
          * Risk per trade is fixed at 1% (sane default — see note under). */}
        {(() => {
          const inputGroupStyle = { marginBottom: 0 };
          const labelStyle = { display: 'block', fontSize: 11, color: '#A89687', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 };
          const buttonRow = { display: 'flex', gap: 6, flexWrap: 'wrap' };
          const pillStyle = (active) => ({
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 100,
            background: active ? '#E07A3B' : 'rgba(0,0,0,0.04)',
            color: active ? '#FFFCF5' : '#1C1613',
            border: active ? '1px solid #E07A3B' : '1px solid #D9CDB5',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            fontFamily: "'Inter', sans-serif",
            fontVariantNumeric: 'tabular-nums',
          });
          return (
            <div style={{
              display: 'grid', gap: 22, marginTop: 32, marginBottom: 22,
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            }}>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Account size</label>
                <div style={buttonRow}>
                  {ACCOUNT_SIZE_OPTIONS.map(s => (
                    <button key={s} type="button" onClick={() => setAccountSize(s)} style={pillStyle(accountSize === s)}>
                      ${(s / 1000).toFixed(0)}k
                    </button>
                  ))}
                </div>
              </div>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Win rate</label>
                <div style={buttonRow}>
                  {WIN_RATE_OPTIONS.map(w => (
                    <button key={w} type="button" onClick={() => setWinRate(w)} style={pillStyle(winRate === w)}>
                      {w}%
                    </button>
                  ))}
                </div>
              </div>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Avg R:R per winner</label>
                <div style={buttonRow}>
                  {RR_OPTIONS.map(r => (
                    <button key={r} type="button" onClick={() => setRr(r)} style={pillStyle(rr === r)}>
                      {r === Math.round(r) ? `1:${r.toFixed(0)}` : `1:${r}`}
                    </button>
                  ))}
                </div>
              </div>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Trades per month</label>
                <div style={buttonRow}>
                  {TRADES_PER_MONTH_OPTIONS.map(t => (
                    <button key={t} type="button" onClick={() => setTrades(t)} style={pillStyle(trades === t)}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Derived summary row: shows what the strategy is producing ─── */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'baseline',
          padding: '16px 20px', borderRadius: 12,
          background: strategyIsLosing ? 'rgba(198,90,69,0.08)' : 'rgba(255,255,255,0.5)',
          border: `1px solid ${strategyIsLosing ? 'rgba(198,90,69,0.3)' : '#D9CDB5'}`,
          marginBottom: 28,
        }}>
          <div>
            <div style={{ fontSize: 9, color: '#A89687', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 2 }}>
              YOUR STRATEGY PRODUCES
            </div>
            <div style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: 26, letterSpacing: '-0.02em',
              color: strategyIsLosing ? '#C65A45' : '#E07A3B',
              fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
            }}>
              {fmtCurrency(monthlyProfit)}/mo
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#1C1613', lineHeight: 1.6 }}>
            <div>
              <span style={{ color: '#A89687' }}>Per-trade expectancy:</span>{' '}
              <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(expectancyPerTrade$)}</strong>
            </div>
            <div>
              <span style={{ color: '#A89687' }}>Risk per trade:</span>{' '}
              <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(riskPerTrade$)}</strong> <span style={{ color: '#A89687' }}>(1% of account)</span>
            </div>
            <div>
              <span style={{ color: '#A89687' }}>Worst expected losing streak (95% CI):</span>{' '}
              <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{stressConsec} losses = {fmtCurrency(stressTestLoss$)}</strong>
            </div>
          </div>
        </div>

        {/* ── Negative-expectancy guard ────────────────────────────────── */}
        {strategyIsLosing && (
          <div style={{
            padding: '14px 18px', borderRadius: 12,
            background: 'rgba(198,90,69,0.06)',
            border: '1px solid rgba(198,90,69,0.3)',
            marginBottom: 18,
            fontSize: 13, color: '#1C1613', lineHeight: 1.55,
          }}>
            <strong style={{ color: '#C65A45' }}>Strategy has negative expectancy.</strong>{' '}
            With a {winRate}% win rate and 1:{rr} R:R, you lose money on average. No prop firm fixes this — improve your win rate or risk-reward first.
          </div>
        )}

        {/* Output grid */}
        <div style={{
          display: 'grid', gap: 14,
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        }}>
          {ranked.map((r, i) => {
            const isWinner = i === 0 && r.yearNet != null && r.yearNet > 0;
            const isInfeasible = r.feasibility === 'infeasible';
            const isTight = r.feasibility === 'tight';
            const reasons = reasonsFor(r, i);
            const borderColor = isWinner ? '#E07A3B'
              : isInfeasible ? 'rgba(198,90,69,0.4)'
              : isTight ? 'rgba(239,201,122,0.5)'
              : '#D9CDB5';

            return (
              <div
                key={r.firm.name}
                style={{
                  background: isInfeasible ? '#FCF7EE' : '#FFFCF5',
                  border: `1.5px solid ${borderColor}`,
                  borderRadius: 14,
                  padding: '22px 22px 20px',
                  position: 'relative',
                  boxShadow: isWinner ? '0 6px 24px rgba(224,122,59,0.18)' : '0 1px 2px rgba(0,0,0,0.04)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  opacity: isInfeasible ? 0.72 : 1,
                }}
              >
                {isWinner && (
                  <div style={{
                    position: 'absolute', top: -10, left: 16,
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
                    color: '#17150F', background: '#E07A3B',
                    padding: '4px 10px', borderRadius: 100,
                  }}>
                    BEST FOR THIS PROFILE
                  </div>
                )}
                {isInfeasible && (
                  <div style={{
                    position: 'absolute', top: -10, left: 16,
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
                    color: '#FFFCF5', background: '#C65A45',
                    padding: '4px 10px', borderRadius: 100,
                  }}>
                    🚫 TOO RISKY
                  </div>
                )}
                {isTight && (
                  <div style={{
                    position: 'absolute', top: -10, left: 16,
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
                    color: '#1C1613', background: '#EFC97A',
                    padding: '4px 10px', borderRadius: 100,
                  }}>
                    ⚠️ TIGHT MARGIN
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{
                      fontFamily: "'Fraunces', Georgia, serif",
                      fontSize: 22, letterSpacing: '-0.02em',
                      color: '#1C1613',
                    }}>
                      {r.firm.name}
                    </div>
                    <div style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                      color: '#A89687', marginTop: 2,
                    }}>
                      {r.firm.tag}
                    </div>
                  </div>
                  {!r.sizeMatches && (
                    <span style={{
                      fontSize: 10, color: '#A89687',
                      padding: '2px 8px', borderRadius: 100,
                      border: '1px solid #D9CDB5', whiteSpace: 'nowrap',
                    }}>
                      ${(r.matchedSize / 1000).toFixed(0)}k acct
                    </span>
                  )}
                </div>

                {/* "Why" reasoning bullets — shown for ranked feasible firms */}
                {reasons.length > 0 && (
                  <div style={{
                    marginTop: 10, marginBottom: 4,
                    display: 'flex', flexDirection: 'column', gap: 4,
                  }}>
                    {reasons.map((reason, ri) => (
                      <div key={ri} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 6,
                        fontSize: 11.5, color: isWinner ? '#1C1613' : '#A89687',
                        lineHeight: 1.45,
                      }}>
                        <span style={{ color: '#E07A3B', flexShrink: 0 }}>✓</span>
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Big number — year net OR infeasibility message */}
                <div style={{ marginTop: 16, marginBottom: 6 }}>
                  <div style={{ fontSize: 9, color: '#A89687', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>
                    {isInfeasible ? 'WHY' : 'YEAR 1 NET (AFTER FEES)'}
                  </div>
                  {isInfeasible ? (
                    <div style={{ fontSize: 12, color: '#1C1613', lineHeight: 1.55 }}>
                      Your stress-test loss of <strong>{fmtCurrency(stressTestLoss$)}</strong> exceeds this firm's drawdown of <strong>{fmtCurrency(r.drawdown$)}</strong>. You'd likely bust before reaching a payout.
                    </div>
                  ) : (
                    <div style={{
                      fontFamily: "'Fraunces', Georgia, serif",
                      fontSize: 32, letterSpacing: '-0.025em',
                      color: r.yearNet != null && r.yearNet > 0 ? '#E07A3B' : '#A89687',
                      lineHeight: 1.1,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {r.yearNet != null ? fmtCurrency(r.yearNet) : '—'}
                    </div>
                  )}
                </div>

                {/* Breakdown */}
                {!isInfeasible && (
                  <div style={{ marginTop: 14, fontSize: 12, color: '#1C1613', lineHeight: 1.7 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#A89687' }}>Per month</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                        {fmtCurrency(r.monthlyTake)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#A89687' }}>Profit split</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(r.firm.profitSplit * 100)}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#A89687' }}>Eval cost</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {r.evalFee != null ? fmtCurrency(r.evalFee) : '—'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#A89687' }}>Drawdown room</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {r.drawdown$ != null ? fmtCurrency(r.drawdown$) : '—'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#A89687' }}>Break even after</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {r.breakEvenMonths != null
                          ? `${r.breakEvenMonths.toFixed(1)} mo`
                          : '—'}
                      </span>
                    </div>
                  </div>
                )}

                <div style={{
                  marginTop: 14, paddingTop: 12, borderTop: '1px solid #D9CDB5',
                  fontSize: 11, color: '#A89687', lineHeight: 1.55, fontStyle: 'italic',
                }}>
                  {r.firm.note}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div style={{
          marginTop: 36, padding: '24px 28px', borderRadius: 14,
          background: '#1C1613',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 16,
        }}>
          <div>
            <div style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: 22, color: '#F0E6D8', letterSpacing: '-0.02em',
            }}>
              Want this <em style={{ fontStyle: 'italic', color: '#E07A3B' }}>tracked automatically</em> for your real trades?
            </div>
            <div style={{ fontSize: 12, color: '#A89687', marginTop: 4 }}>
              TradeEdge runs the math live across every firm you trade — so you always know which one's worth your size.
            </div>
          </div>
          <a
            href="#pricing"
            style={{
              padding: '12px 22px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              background: '#E07A3B', color: '#17150F', textDecoration: 'none',
              fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap',
            }}
          >
            Get started — free →
          </a>
        </div>

        {/* Disclaimer */}
        <div style={{
          marginTop: 16, fontSize: 10.5, color: '#A89687',
          textAlign: 'center', maxWidth: 760, marginLeft: 'auto', marginRight: 'auto',
          lineHeight: 1.55,
        }}>
          Model assumes 1% risk per trade, fixed R:R per winner, no variance month-to-month, and that you pass the eval first try.
          Reality is messier — but this captures the headline economics. Always verify rules on each firm's pricing page before paying.
        </div>
      </div>
    </section>
  );
}

// ── Main Landing Page ─────────────────────────────────────────────────────────
export default function LandingPage({ onSignIn, onStartTrial, onShowPrivacy, onShowTerms }) {
  useLenis();
  return (
    <div className="lp-root">

      {/* ── NAV ── */}
      <nav className="lp-nav">
        <div className="lp-container lp-nav-row">
          <div className="lp-wordmark">tradeedge<span className="lp-dot">.</span></div>
          <div className="lp-nav-links">
            <a href="#features">Features</a>
            <a href="#compare">Compare</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="lp-nav-cta">
            <button className="lp-btn lp-btn-ghost" onClick={onSignIn}>Sign in</button>
            <button className="lp-btn lp-btn-primary" onClick={onStartTrial}>Get started — free</button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <header className="lp-hero">
        <div className="lp-container">
          <div className="lp-eyebrow">
            <span className="lp-eyebrow-dot" />
            <span>Built by a prop trader, for prop traders</span>
          </div>
          <h1 className="lp-h1">One dashboard for every <em>prop firm account</em>.</h1>
          <p className="lp-hero-sub">The trading journal built for prop firm traders. Log every trade, see every account, track every payout — whether you're on your first Apex eval or running six funded combines. No spreadsheets, no juggling logins.</p>
          <div className="lp-cta-row">
            <button className="lp-btn lp-btn-primary lp-btn-lg" onClick={onStartTrial}>Get started — free →</button>
            <button className="lp-btn lp-btn-outline lp-btn-lg" onClick={onSignIn}>See it live</button>
          </div>
          <div className="lp-reassurance">
            <span><span className="lp-check">✓</span> 7-day free Pro trial</span>
            <span><span className="lp-check">✓</span> Free tier · no card needed</span>
            <span><span className="lp-check">✓</span> Cancel anytime</span>
          </div>

          {/* Hero product mock */}
          <div className="lp-mock2">
            <div className="lp-mock2-body">
              {/* LEFT: massive P&L headline */}
              <div className="lp-mock-headline">
                <div className="lp-mock-breadcrumb">
                  <span>All accounts</span>
                  <span className="lp-sep">/</span>
                  <span>April 2026</span>
                  <span className="lp-sep">/</span>
                  <span>MTD</span>
                </div>
                <div>
                  <div className="lp-pnl-label">Net P&amp;L · across 5 firms</div>
                  <h2 className="lp-pnl-big">
                    <span className="lp-plus">+</span>
                    <CountUp target={8420} prefix="$" />
                  </h2>
                  <div className="lp-pnl-meta">
                    After <b>$1,180</b> in eval &amp; reset fees, netted across 47 trades. Updated in real time as you close.
                  </div>
                </div>
                <div className="lp-mock-kpis">
                  <div className="lp-mock-kpi">
                    <div className="lp-k-label">Active</div>
                    <div className="lp-k-value">5</div>
                    <div className="lp-k-sub">3 funded · 2 in eval</div>
                  </div>
                  <div className="lp-mock-kpi">
                    <div className="lp-k-label">Win rate</div>
                    <div className="lp-k-value">64%</div>
                    <div className="lp-k-sub">+6 vs last month</div>
                  </div>
                  <div className="lp-mock-kpi">
                    <div className="lp-k-label">Closest DD</div>
                    <div className="lp-k-value warn">$340</div>
                    <div className="lp-k-sub">Apex · trail</div>
                  </div>
                </div>
              </div>

              {/* RIGHT: stack of firm rows */}
              <div className="lp-mock-stack">
                <div className="lp-stack-head">
                  <span>Per firm</span>
                  <span className="lp-h-title">Today, sorted by P&amp;L</span>
                </div>
                {[
                  { mark: 'F', name: 'FTMO · $200k', status: 'Funded', sub: '68% to next payout', pnl: '+$3,840', pct: '+1.92%', up: true },
                  { mark: 'T', name: 'TopStep · $150k', status: 'Funded', sub: '42% to next payout', pnl: '+$2,210', pct: '+1.47%', up: true },
                  { mark: 'M', name: 'MyFundedFutures · $50k', status: 'Funded', sub: '91% to next payout', pnl: '+$1,490', pct: '+2.98%', up: true },
                  { mark: '5', name: 'The5%ers · $100k', status: 'Eval', statusClass: 'eval', sub: 'Stage 1 · 11 days left', pnl: '+$1,520', pct: '+1.52%', up: true },
                  { mark: 'A', name: 'Apex · $100k', status: 'Near DD', statusClass: 'danger', sub: '$340 of $3,000 left', pnl: '−$640', pct: '−0.64%', up: false, warn: true },
                ].map(r => (
                  <div key={r.name} className={`lp-firm-row${r.warn ? ' warn' : ''}`}>
                    <div className="lp-firm-mark">{r.mark}</div>
                    <div className="lp-firm-info">
                      <div className="lp-firm-info-name">{r.name}</div>
                      <div className="lp-firm-info-sub">
                        <span className={`lp-firm-status${r.statusClass ? ` ${r.statusClass}` : ''}`}>{r.status}</span>
                        <span>{r.sub}</span>
                      </div>
                    </div>
                    <div className={`lp-firm-pnl-num ${r.up ? 'up' : 'down'}`}>
                      {r.pnl}
                      <span className="lp-pct">{r.pct}</span>
                    </div>
                  </div>
                ))}
                <div className="lp-stack-foot">
                  <span>5 accounts · 47 trades · MTD</span>
                  <span className="lp-foot-total">Net <b>+$8,420</b></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 5-SECOND LOGGING DEMO ── */}
      <section className="lp-quick-log" id="quick-log">
        <div className="lp-container">
          <div className="lp-eyebrow">
            <span className="lp-eyebrow-dot" />
            <span>New · just shipped</span>
          </div>
          <h2 className="lp-quick-h2">
            Log a trade in <em>5 seconds</em>.
          </h2>
          <p className="lp-quick-sub">
            Drop a screenshot from your broker. Claude reads symbol, prices, qty, and P&amp;L. You review and save.
          </p>

          <div className="lp-demo-card">
            {/* LEFT: fake broker screenshot */}
            <div className="lp-demo-shot">
              <div className="lp-demo-shot-head">
                <span className="lp-demo-shot-tab">Tradovate · NQM6</span>
                <span className="lp-demo-shot-status">+$3,145</span>
              </div>
              <div className="lp-demo-shot-chart">
                <svg viewBox="0 0 280 110" preserveAspectRatio="none" aria-hidden>
                  <path d="M0,80 L24,75 L48,82 L72,68 L96,71 L120,55 L144,60 L168,42 L192,46 L216,28 L240,30 L264,18 L280,22"
                    fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="240" cy="30" r="3" fill="currentColor" />
                </svg>
              </div>
              <div className="lp-demo-shot-meta">
                <span>Long · 20 contracts</span>
                <span>Entry 25017.50 → Exit 25074.25</span>
              </div>
            </div>

            {/* MIDDLE: arrow + status */}
            <div className="lp-demo-arrow-wrap">
              <div className="lp-demo-pulse">
                <span>✨</span>
                <span className="lp-demo-pulse-text">Reading…</span>
              </div>
              <div className="lp-demo-arrow">→</div>
            </div>

            {/* RIGHT: form with fields auto-filling */}
            <div className="lp-demo-form">
              <div className="lp-demo-form-head">Trade entry</div>
              <div className="lp-demo-grid">
                <div className="lp-demo-field" style={{ '--d': '0.4s' }}>
                  <span className="lp-demo-flabel">Symbol</span>
                  <span className="lp-demo-fvalue">NQ</span>
                </div>
                <div className="lp-demo-field" style={{ '--d': '0.7s' }}>
                  <span className="lp-demo-flabel">Direction</span>
                  <span className="lp-demo-fvalue">Long</span>
                </div>
                <div className="lp-demo-field" style={{ '--d': '1.0s' }}>
                  <span className="lp-demo-flabel">Entry</span>
                  <span className="lp-demo-fvalue">25017.50</span>
                </div>
                <div className="lp-demo-field" style={{ '--d': '1.3s' }}>
                  <span className="lp-demo-flabel">Exit</span>
                  <span className="lp-demo-fvalue">25074.25</span>
                </div>
                <div className="lp-demo-field" style={{ '--d': '1.6s' }}>
                  <span className="lp-demo-flabel">Qty</span>
                  <span className="lp-demo-fvalue">20</span>
                </div>
                <div className="lp-demo-field lp-demo-field-pnl" style={{ '--d': '1.9s' }}>
                  <span className="lp-demo-flabel">P&amp;L</span>
                  <span className="lp-demo-fvalue">+$3,145.00</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── LOGO STATEMENT (typographic) ── */}
      <section className="lp-logos" id="firms">
        <div className="lp-container">
          <div className="lp-logos-label">Supported firms</div>
          <p className="lp-logos-statement">
            <span className="lp-firm">FTMO</span>, <span className="lp-firm">TopStep</span>, <span className="lp-firm">Apex</span>, <span className="lp-firm">Tradeify</span>, <span className="lp-firm">MyFundedFutures</span>, <span className="lp-firm">The5%ers</span>, <span className="lp-firm">FundedNext</span> <span className="lp-more-pill">+ 12 more</span> — <em>all in one place.</em>
          </p>
          <div className="lp-logos-meta">
            <span className="lp-logos-meta-stat"><b>19</b><span className="lp-meta-label">prop firms</span></span>
            <span className="lp-logos-meta-stat"><b>6</b><span className="lp-meta-label">trading platforms</span></span>
            <span className="lp-logos-meta-stat"><b>read-only</b><span className="lp-meta-label">never your password</span></span>
            <span className="lp-logos-meta-stat"><b>&lt; 60s</b><span className="lp-meta-label">to connect an account</span></span>
          </div>
        </div>
      </section>

      {/* ── PAIN ── */}
      <section className="lp-section lp-pain" id="pain">
        <div className="lp-container">
          <div className="lp-eyebrow-label">If any of this sounds familiar</div>
          <h2 className="lp-section-title">You're spending more time <em>tracking</em> trades than taking them.</h2>
          <div className="lp-pain-grid">
            <div className="lp-pain-list">
              {[
                'Pulling numbers from three different platforms before the bell.',
                'Forgetting to log resets and losing track of which fees went where.',
                "Can't monitor drawdowns across all accounts at once.",
                'Manually tracking costs vs payouts in messy spreadsheets.',
              ].map((text, i) => (
                <div key={i} className="lp-pain-item">
                  <span className="lp-pain-num">0{i + 1}</span>
                  <span className="lp-pain-text">{text}</span>
                </div>
              ))}
            </div>
            <div className="lp-pain-quote">
              <div className="lp-pain-q">"I had eight tabs open just to know if I was up or down for the month. I was paying $200 in fees and didn't realize it until I added it up."</div>
              <div className="lp-pain-attr">— what you've probably said out loud, at least once</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MANIFESTO / DARK INTERLUDE ── */}
      <section className="lp-manifesto">
        <div className="lp-container">
          <div className="lp-manifesto-grid">
            <div>
              <div className="lp-manifesto-lead">A note on the math</div>
              <h2 className="lp-manifesto-big">
                You're not&nbsp;<span className="lp-manifesto-strike">losing</span>&nbsp;money.<br />
                You're <em>leaking it</em>.
              </h2>
            </div>
            <div className="lp-manifesto-right">
              <div className="lp-manifesto-receipt">
                <div className="lp-ln"><span>3× failed evals last quarter</span><span>−$447</span></div>
                <div className="lp-ln"><span>2× drawdown breaches</span><span>−$298</span></div>
                <div className="lp-ln"><span>Resets you forgot to log</span><span>−$180</span></div>
                <div className="lp-ln"><span>Profit splits you miscounted</span><span>−$612</span></div>
                <div className="lp-ln lp-total"><span>What you didn't see in your spreadsheet</span><span>−$1,537</span></div>
              </div>
              <p className="lp-manifesto-closer">
                The average prop trader spends <b>$2,400 a year</b> on fees they don't track. We surface every dollar — eval, reset, payout, split — so the only number you have to read is the one at the bottom.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="lp-section" id="features">
        <div className="lp-container">
          <div className="lp-eyebrow-label">What you get</div>
          <h2 className="lp-section-title">Everything in one place. <em>Finally.</em></h2>
          <p className="lp-section-sub">Six things every prop trader needs — and most platforms only do two of them well.</p>

          <div className="lp-features-grid">
            {/* 1 — wide */}
            <div className="lp-feature-card f-wide">
              <span className="lp-feature-num">01 · core</span>
              <div className="lp-feature-title">Every account, <em>one view</em>.</div>
              <div className="lp-feature-desc">FTMO, TopStep, Apex, Tradeify, and the rest — pulled into a single dashboard that updates as you trade. No more tab-switching at 9:30.</div>
              <div className="lp-feature-visual">
                {[
                  { label: 'FTMO · $200k', pnl: '+$3,840', up: true, status: 'Funded' },
                  { label: 'TopStep · $150k', pnl: '+$2,210', up: true, status: 'Funded' },
                  { label: 'Apex · $100k', pnl: '−$640', up: false, status: 'Eval' },
                ].map(r => (
                  <div key={r.label} className="lp-v-row">
                    <span className="lp-v-firm">{r.label}</span>
                    <span className={`lp-v-num ${r.up ? 'up' : 'down'}`}>{r.pnl}</span>
                    <span className="lp-v-pill">{r.status}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2 — third */}
            <div className="lp-feature-card f-third">
              <span className="lp-feature-num">02</span>
              <div className="lp-feature-title">True <em>ROI</em>, not vibes.</div>
              <div className="lp-feature-desc">Eval fees, resets, payouts — netted across every firm. See what you actually made.</div>
              <div className="lp-feature-visual">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', height: '80px' }}>
                  {[30, 50, 65, 85].map((h, i) => (
                    <div key={i} style={{ flex: 1, background: i === 3 ? 'var(--lp-accent)' : 'var(--lp-accent-soft2)', height: `${h}%`, borderRadius: '4px 4px 0 0' }} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '10px', color: 'var(--lp-text3)', fontFamily: 'JetBrains Mono, monospace' }}>
                  <span>Q1</span><span>Q2</span><span>Q3</span><span>Q4</span>
                </div>
              </div>
            </div>

            {/* 3 — half */}
            <div className="lp-feature-card f-half">
              <span className="lp-feature-num">03</span>
              <div className="lp-feature-title">Never breach <em>by accident</em>.</div>
              <div className="lp-feature-desc">Real-time drawdown tracking on every account. Alerts when you're $200 away from the line — not after.</div>
              <div className="lp-feature-visual">
                <div style={{ border: '1px solid var(--lp-border-soft)', borderRadius: '10px', padding: '14px', background: 'var(--lp-bg)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--lp-text3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    <span>Apex · $100k</span><span style={{ color: 'var(--lp-warn)', fontWeight: 600 }}>⚠ $340 left</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '8px' }}>
                    <span style={{ fontSize: '24px', fontWeight: 600, color: 'var(--lp-warn)', fontVariantNumeric: 'tabular-nums' }}>−$2,660</span>
                    <span style={{ fontSize: '12px', color: 'var(--lp-text3)' }}>of $3,000 max DD</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--lp-border)', borderRadius: '3px', marginTop: '10px', overflow: 'hidden' }}>
                    <div style={{ width: '88%', height: '100%', background: 'var(--lp-warn)' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* 4 — half */}
            <div className="lp-feature-card f-half">
              <span className="lp-feature-num">04</span>
              <div className="lp-feature-title">No manual entry. <em>Ever.</em></div>
              <div className="lp-feature-desc">Trades sync automatically from every supported broker. Close a position; it's in your journal.</div>
              <div className="lp-feature-visual">
                {[
                  { label: 'ES · Long · 09:34', pnl: '+$340' },
                  { label: 'NQ · Long · 10:12', pnl: '+$892' },
                ].map(r => (
                  <div key={r.label} className="lp-v-row">
                    <span className="lp-v-firm" style={{ fontSize: '13px' }}>{r.label}</span>
                    <span className="lp-v-num up">{r.pnl}</span>
                    <span className="lp-v-pill" style={{ color: 'var(--lp-accent)' }}>Synced</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 5 — half */}
            <div className="lp-feature-card f-half">
              <span className="lp-feature-num">05</span>
              <div className="lp-feature-title">News that <em>actually moves</em>.</div>
              <div className="lp-feature-desc">Live AI-curated feed — not just CPI prints. Flash crashes, oil tanker incidents, central bank speeches off-schedule.</div>
              <div className="lp-feature-visual">
                {[
                  { time: '14:32', tag: 'LIVE', tagClass: 'live', text: 'Powell unscheduled remarks at Brookings' },
                  { time: '13:08', tag: 'AI', tagClass: 'ai', text: 'Unusual options flow detected · QQQ' },
                ].map(item => (
                  <div key={item.time} className="lp-v-feed-item">
                    <span className="lp-v-time">{item.time}</span>
                    <span className={`lp-v-tag ${item.tagClass}`}>{item.tag}</span>
                    <span style={item.tagClass === 'live' ? { color: 'var(--lp-text)' } : {}}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 6 — half */}
            <div className="lp-feature-card f-half">
              <span className="lp-feature-num">06</span>
              <div className="lp-feature-title">Backtesting, <em>coming soon</em>.</div>
              <div className="lp-feature-desc">Test your setup against 5 years of tick data — same login, same dashboard. Launching soon for Pro subscribers.</div>
              <div className="lp-feature-visual">
                <svg viewBox="0 0 300 80" style={{ width: '100%', height: '80px' }} preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="lp-grad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#C2521C" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#C2521C" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M 0 60 L 30 50 L 60 55 L 90 40 L 120 45 L 150 30 L 180 35 L 210 22 L 240 28 L 270 12 L 300 18 L 300 80 L 0 80 Z" fill="url(#lp-grad)" />
                  <path d="M 0 60 L 30 50 L 60 55 L 90 40 L 120 45 L 150 30 L 180 35 L 210 22 L 240 28 L 270 12 L 300 18" fill="none" stroke="#C2521C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMPARE ── */}
      <section className="lp-compare" id="compare">
        <div className="lp-container">
          <div className="lp-eyebrow-label" style={{ color: '#E07A3B' }}>How we stack up</div>
          <h2 className="lp-section-title" style={{ color: '#F0E6D8' }}>More than a tracker. <em>Less than the cost of one.</em></h2>
          <p className="lp-section-sub" style={{ color: '#A89687' }}>Most journals were built for retail traders, not prop firm traders. We were built for you.</p>
          <div className="lp-compare-table">
            <div className="lp-compare-row head">
              <div>Feature</div>
              <div className="us">TradeEdge</div>
              <div>TradeZella</div>
              <div>Prop Firm One</div>
              <div className="hide-mobile">PFT</div>
            </div>
            {[
              { label: 'Multi-firm dashboard', us: '✓', tz: '—', pf: '✓', pft: '✓' },
              { label: 'Automated trade imports', us: '✓', tz: '✓', pf: '—', pft: '—' },
              { label: 'AI live news feed', us: '✓', tz: '—', pf: '—', pft: '—' },
              { label: 'Drawdown compliance alerts', us: '✓', tz: '—', pf: '✓', pft: '—' },
              { label: 'Backtesting included', us: 'Coming soon', tz: '—', pf: '—', pft: '—', usSmall: true },
              { label: 'Monthly price', us: '$19', tz: '$50', pf: '$45–80', pft: '$5', price: true },
            ].map(r => (
              <div key={r.label} className="lp-compare-row">
                <div className="lp-compare-label">{r.label}</div>
                <div className="col-us">
                  {r.price ? <span className="lp-price us">{r.us}</span> :
                   r.usSmall ? <span style={{ fontSize: '12px', color: '#A89687' }}>{r.us}</span> :
                   <span className={r.us === '✓' ? 'lp-check' : 'lp-x'}>{r.us}</span>}
                </div>
                <div>{r.price ? <span className="lp-price">{r.tz}</span> : <span className={r.tz === '✓' ? 'lp-check' : 'lp-x'}>{r.tz}</span>}</div>
                <div>{r.price ? <span className="lp-price">{r.pf}</span> : <span className={r.pf === '✓' ? 'lp-check' : 'lp-x'}>{r.pf}</span>}</div>
                <div className="hide-mobile">{r.price ? <span className="lp-price">{r.pft}</span> : <span className={r.pft === '✓' ? 'lp-check' : 'lp-x'}>{r.pft}</span>}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FIRM ROI CALCULATOR ─────────────────────────────────────────────
        * Public free tool — picks the best prop firm based on YOUR profile.
        *
        * Logic per firm:
        *   monthlyTake     = monthlyProfit × profitSplit − monthlyFee
        *   breakEvenMonths = evalFee / monthlyTake    (when monthlyTake > 0)
        *   yearNet         = monthlyTake × 12 − evalFee
        *
        * Firm data is hand-coded below. ALL VALUES MARKED `TODO:VERIFY` are
        * rough estimates pending Jens's review against the actual pricing pages.
        * Update before merge.
        */}
      <FirmRoiCalculator />

      {/* ── PRICING ── */}
      <section className="lp-section" id="pricing">
        <div className="lp-container">
          <div className="lp-eyebrow-label">Pricing</div>
          <h2 className="lp-section-title">Simple. <em>Honest.</em> Cheaper than your last reset.</h2>
          <p className="lp-section-sub">Start free. Upgrade when you want more — automated imports, drawdown alerts, AI news. Cancel anytime — no contracts.</p>
          <div className="lp-pricing-grid">
            {/* Starter */}
            <div className="lp-price-card">
              <div className="lp-price-tier">Starter</div>
              <div className="lp-price-amount">$0<span className="lp-per"> / month</span></div>
              <div className="lp-price-desc">Get the basics. Built for traders just starting their first prop firm journey.</div>
              <ul className="lp-price-list">
                {['1 connected account','Manual + CSV trade import','Stats, calendar & journal','Full history'].map(f => <li key={f}>{f}</li>)}
              </ul>
              <button className="lp-btn lp-btn-outline lp-btn-lg lp-btn-full" onClick={onStartTrial}>Start free</button>
              <div className="lp-price-reassurance">No credit card required</div>
            </div>
            {/* Pro */}
            <div className="lp-price-card featured">
              <div className="lp-price-badge">Most popular</div>
              <div className="lp-price-tier">Pro</div>
              <div className="lp-price-amount">$19<span className="lp-per"> / month</span></div>
              <div className="lp-price-desc">Everything. Every feature, every firm, no limits.</div>
              <ul className="lp-price-list">
                {['Unlimited accounts & firms','Automated trade imports','Drawdown compliance alerts','Cost vs payout analytics','AI live news feed','Unlimited history'].map(f => <li key={f}>{f}</li>)}
              </ul>
              <div className="lp-backtest-addon">
                <div>
                  <div style={{ fontFamily: 'Fraunces, serif', fontSize: '15px', letterSpacing: '-0.01em' }}><em style={{ fontStyle: 'italic', color: 'var(--lp-accent)' }}>Backtesting</em></div>
                  <div style={{ fontSize: '12px', color: 'var(--lp-text3)', marginTop: '2px' }}>5 years of tick data · same dashboard</div>
                </div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 700, color: 'var(--lp-accent)', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', background: 'rgba(224,122,59,0.1)', border: '1px solid rgba(224,122,59,0.35)', padding: '4px 10px', borderRadius: '100px' }}>Coming soon</div>
              </div>
              <button className="lp-btn lp-btn-primary lp-btn-lg lp-btn-full" onClick={onStartTrial}>Start 7-day free trial</button>
              <div className="lp-price-reassurance">Card required · cancel anytime during trial</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="lp-section lp-pain" id="faq">
        <div className="lp-container" style={{ maxWidth: '880px' }}>
          <div className="lp-eyebrow-label">FAQ</div>
          <h2 className="lp-section-title">Things you're <em>probably wondering</em>.</h2>
          <div className="lp-faq-list">
            {[
              { q: 'Which prop firms are supported?', a: 'Today: any firm using Tradovate (live API connection) plus CSV imports from Tradovate, Rithmic, NinjaTrader, DAS Trader, and Thinkorswim. That covers most accounts at TopStep, Apex, MyFundedFutures, Tradeify, and similar. MetaTrader 4/5 and cTrader integrations are on the roadmap. If your firm exports CSVs in a different format, email us — we add new parsers fast.' },
              { q: 'Do I have to give you my broker passwords?', a: 'No. We connect via read-only API keys or trade exports — never your login credentials. We can\'t place trades, can\'t move money, can\'t see anything except your trade history.' },
              { q: 'How accurate is drawdown tracking?', a: 'Tick-level accurate during market hours. We calculate trailing and static drawdown the same way every prop firm does — so what you see in TradeEdge matches what your firm sees, to the dollar.' },
              { q: 'What happens after the free trial?', a: 'Your card is charged $19/month on day 8 unless you cancel during the trial. We require a card up front so the transition is seamless if you decide to keep going. You can cancel any time from Settings — no questions asked, and your data stays put on the free tier.' },
              { q: 'Can I export my data?', a: 'Always. CSV, JSON, or PDF reports — your trades belong to you, not us.' },
            ].map(item => <FaqItem key={item.q} {...item} />)}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="lp-final-cta">
        <div className="lp-container">
          <h2 className="lp-final-h2">See your <em>real numbers</em>.</h2>
          <p className="lp-final-sub">Whether you trade one account or twenty — TradeEdge shows your true edge in under 5 minutes.</p>
          <div className="lp-cta-row" style={{ justifyContent: 'center' }}>
            <button className="lp-btn lp-btn-primary lp-btn-lg" onClick={onStartTrial}>Start free trial →</button>
            <button className="lp-btn lp-btn-outline lp-btn-lg" onClick={onSignIn}>See the product</button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-row">
            <div className="lp-footer-brand">
              <div className="lp-wordmark">tradeedge<span className="lp-dot">.</span></div>
              <p>The trading journal built for prop firm traders. Log every trade, see every account, track every payout — whether you run one challenge or six.</p>
            </div>
            <div className="lp-footer-col">
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#compare">Compare</a>
              <a href="#pricing">Pricing</a>
              <a href={`mailto:${CONTACT_EMAIL}?subject=Changelog%20updates`}>
                Changelog <span className="lp-soon">soon</span>
              </a>
            </div>
            <div className="lp-footer-col">
              <h4>Resources</h4>
              <a href="#firms">Supported firms</a>
              <a href={`mailto:${SUPPORT_EMAIL}?subject=Help%20with%20TradeEdge`}>
                Help center
              </a>
              <a href={`mailto:${CONTACT_EMAIL}?subject=API%20access`}>
                API docs <span className="lp-soon">soon</span>
              </a>
              <a href="#" onClick={e => e.preventDefault()} style={{ cursor: 'default' }}>
                <span className="lp-status-dot" /> All systems normal
              </a>
            </div>
            <div className="lp-footer-col">
              <h4>Company</h4>
              <a href={`mailto:${CONTACT_EMAIL}?subject=About%20TradeEdge`}>About</a>
              <a href={`mailto:${CONTACT_EMAIL}?subject=Blog%20updates`}>
                Blog <span className="lp-soon">soon</span>
              </a>
              <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
              <a
                href="#privacy"
                onClick={e => { e.preventDefault(); onShowPrivacy && onShowPrivacy(); }}
              >Privacy</a>
              <a
                href="#terms"
                onClick={e => { e.preventDefault(); onShowTerms && onShowTerms(); }}
              >Terms</a>
            </div>
          </div>
          <div className="lp-footer-legal">
            <span>© 2026 TradeEdge, Inc.</span>
            <span>Trading involves risk. Past performance does not guarantee future results.</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

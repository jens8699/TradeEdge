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
            <button className="lp-btn lp-btn-primary" onClick={onStartTrial}>Start free trial</button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <header className="lp-hero">
        <div className="lp-container">
          <div className="lp-eyebrow">
            <span className="lp-eyebrow-dot" />
            <span>Built for prop firm traders managing 3+ accounts</span>
          </div>
          <h1 className="lp-h1">One dashboard for all your <em>prop firm accounts</em>.</h1>
          <p className="lp-hero-sub">Stop logging into FTMO, TopStep, and Apex separately. Track performance, costs, and payouts across every prop firm — in one place, in real time.</p>
          <div className="lp-cta-row">
            <button className="lp-btn lp-btn-primary lp-btn-lg" onClick={onStartTrial}>Start free trial →</button>
            <button className="lp-btn lp-btn-outline lp-btn-lg" onClick={onSignIn}>See it live</button>
          </div>
          <div className="lp-reassurance">
            <span><span className="lp-check">✓</span> 2-week free trial</span>
            <span><span className="lp-check">✓</span> No credit card required</span>
            <span><span className="lp-check">✓</span> Free tier for 1–2 accounts</span>
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
              <div className="lp-feature-title">Backtesting, <em>included</em>.</div>
              <div className="lp-feature-desc">Test your setup against 5 years of tick data. No extra subscription — same login, same data, same dashboard.</div>
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
          <p className="lp-section-sub" style={{ color: '#A89687' }}>Most journals were built for retail traders, not prop firm operators. We were built for you.</p>
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
              { label: 'Backtesting included', us: '+$10 add-on', tz: '—', pf: '—', pft: '—', usSmall: true },
              { label: 'Monthly price', us: '$19', tz: '$50', pf: '$45–80', pft: '$5', price: true },
            ].map(r => (
              <div key={r.label} className="lp-compare-row">
                <div className="lp-compare-label">{r.label}</div>
                <div className="col-us">
                  {r.price ? <span className="lp-price us">{r.us}</span> :
                   r.usSmall ? <span style={{ fontSize: '12px', color: '#A89687' }}>{r.us}</span> :
                   <span className={r.us === '✓' ? 'lp-check' : 'lp-x'}>{r.us}</span>}
                  {r.price && <span style={{ fontSize: '11px', color: 'var(--lp-text3)', display: 'block', marginTop: '2px' }}>+$10 backtesting</span>}
                </div>
                <div>{r.price ? <span className="lp-price">{r.tz}</span> : <span className={r.tz === '✓' ? 'lp-check' : 'lp-x'}>{r.tz}</span>}</div>
                <div>{r.price ? <span className="lp-price">{r.pf}</span> : <span className={r.pf === '✓' ? 'lp-check' : 'lp-x'}>{r.pf}</span>}</div>
                <div className="hide-mobile">{r.price ? <span className="lp-price">{r.pft}</span> : <span className={r.pft === '✓' ? 'lp-check' : 'lp-x'}>{r.pft}</span>}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="lp-section" id="pricing">
        <div className="lp-container">
          <div className="lp-eyebrow-label">Pricing</div>
          <h2 className="lp-section-title">Simple. <em>Honest.</em> Cheaper than your last reset.</h2>
          <p className="lp-section-sub">Start free. Upgrade when you're tracking more than two accounts. Cancel anytime — no contracts.</p>
          <div className="lp-pricing-grid">
            {/* Starter */}
            <div className="lp-price-card">
              <div className="lp-price-tier">Starter</div>
              <div className="lp-price-amount">$0<span className="lp-per"> / month</span></div>
              <div className="lp-price-desc">Get the basics. Built for traders just starting their first prop firm journey.</div>
              <ul className="lp-price-list">
                {['Up to 2 accounts','Manual trade entry','Basic stats & calendar','14 days of history'].map(f => <li key={f}>{f}</li>)}
              </ul>
              <button className="lp-btn lp-btn-outline lp-btn-lg lp-btn-full" onClick={onStartTrial}>Start free</button>
              <div className="lp-price-reassurance">No credit card required</div>
            </div>
            {/* Pro */}
            <div className="lp-price-card featured">
              <div className="lp-price-badge">Most popular</div>
              <div className="lp-price-tier">Pro</div>
              <div className="lp-price-amount">$19<span className="lp-per"> / month</span></div>
              <div className="lp-price-desc">Everything. Built for traders managing 3+ prop firm accounts.</div>
              <ul className="lp-price-list">
                {['Unlimited accounts & firms','Automated trade imports','Drawdown compliance alerts','Cost vs payout analytics','AI live news feed','Unlimited history'].map(f => <li key={f}>{f}</li>)}
              </ul>
              <div className="lp-backtest-addon">
                <div>
                  <div style={{ fontFamily: 'Fraunces, serif', fontSize: '15px', letterSpacing: '-0.01em' }}>Add <em style={{ fontStyle: 'italic', color: 'var(--lp-accent)' }}>backtesting</em></div>
                  <div style={{ fontSize: '12px', color: 'var(--lp-text3)', marginTop: '2px' }}>5 years of tick data · same dashboard</div>
                </div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '18px', fontWeight: 600, color: 'var(--lp-accent)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>+$10<span style={{ fontSize: '12px', color: 'var(--lp-text3)', fontWeight: 400 }}> /mo</span></div>
              </div>
              <button className="lp-btn lp-btn-primary lp-btn-lg lp-btn-full" onClick={onStartTrial}>Start 2-week free trial</button>
              <div className="lp-price-reassurance">No credit card · cancel anytime</div>
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
              { q: 'Which prop firms are supported?', a: 'FTMO, TopStep, Apex, Tradeify, MyFundedFutures, The5%ers, FundedNext, and most other major firms running on Rithmic, Tradovate, NinjaTrader, MetaTrader 4/5, or cTrader. If your firm uses one of those platforms, you\'re covered.' },
              { q: 'Do I have to give you my broker passwords?', a: 'No. We connect via read-only API keys or trade exports — never your login credentials. We can\'t place trades, can\'t move money, can\'t see anything except your trade history.' },
              { q: 'How accurate is drawdown tracking?', a: 'Tick-level accurate during market hours. We calculate trailing and static drawdown the same way every prop firm does — so what you see in TradeEdge matches what your firm sees, to the dollar.' },
              { q: 'What happens after the free trial?', a: 'Nothing automatic. We don\'t take a card up front, so when 14 days are up your account drops to the free Starter tier and your data stays put. Upgrade when you\'re ready.' },
              { q: 'Can I export my data?', a: 'Always. CSV, JSON, or PDF reports — your trades belong to you, not us.' },
            ].map(item => <FaqItem key={item.q} {...item} />)}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="lp-final-cta">
        <div className="lp-container">
          <h2 className="lp-final-h2">Stop the <em>fragmentation</em>.</h2>
          <p className="lp-final-sub">One dashboard. Every account. Every firm. See your real numbers in under 5 minutes.</p>
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
              <p>The trading journal built for prop firm traders. One dashboard for every account, every firm, every payout.</p>
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

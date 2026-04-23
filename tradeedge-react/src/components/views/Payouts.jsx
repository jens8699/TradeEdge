import { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { fmt, filterPeriod } from '../../lib/utils';

// ── Challenge helpers (localStorage) ─────────────────────────────────────────
const CK = 'te_challenges';
function loadChallenges() { try { return JSON.parse(localStorage.getItem(CK) || '[]'); } catch { return []; } }
function saveChallenges(list) { localStorage.setItem(CK, JSON.stringify(list)); }
function cuid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

const FIRM_COLORS = ['#E07A3B','#E07A3B','#A89687','#EFC97A','#B085EB','#EB85B3'];
const EMPTY_FORM = { firm: '', accountSize: '', profitTarget: 10, dailyLossLimit: 5, maxDrawdown: 10, startDate: new Date().toISOString().slice(0, 10) };

// ── Main component ────────────────────────────────────────────────────────────
export default function Payouts({ showToast }) {
  const { payouts, addPayout, deletePayout, trades } = useApp();

  // Challenge state
  const [challenges,   setChallenges]   = useState(loadChallenges);
  const [showAddChal,  setShowAddChal]  = useState(false);
  const [chalForm,     setChalForm]     = useState(EMPTY_FORM);
  const [chalSaving,   setChalSaving]   = useState(false);

  // Payout form state
  const [date,   setDate]   = useState(new Date().toISOString().slice(0, 10));
  const [firm,   setFirm]   = useState('');
  const [amount, setAmount] = useState('');
  const [notes,  setNotes]  = useState('');
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState('');
  const [confirmDel,    setConfirmDel]    = useState(null);
  const [confirmDelChal, setConfirmDelChal] = useState(null);

  const chartRef  = useRef(null);
  const chartInst = useRef(null);
  const total = payouts.reduce((s, p) => s + p.amount, 0);

  // Payout chart
  useEffect(() => {
    if (!payouts.length) return;
    import('chart.js').then(({ Chart, registerables }) => {
      Chart.register(...registerables);
      if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; }
      const ctx = chartRef.current;
      if (!ctx) return;
      const sorted = [...payouts].sort((a, b) => a.date.localeCompare(b.date));
      let cum = 0;
      const labels = [], data = [];
      sorted.forEach(p => { cum += p.amount; labels.push(p.date); data.push(Math.round(cum * 100) / 100); });
      chartInst.current = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ data, borderColor: '#E07A3B', backgroundColor: 'rgba(224,122,59,0.12)', fill: true, tension: 0.35, pointRadius: 4, pointBackgroundColor: '#E07A3B', pointBorderColor: '#17150F', pointBorderWidth: 2, borderWidth: 2.5 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0E0C08', titleColor: '#F5F3ED', bodyColor: '#E8E6E1', borderColor: '#2A2720', borderWidth: 1, padding: 10, cornerRadius: 8, callbacks: { label: c => '$' + c.raw.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) } } }, scales: { y: { ticks: { color: '#8B8882', callback: v => '$' + v }, grid: { color: 'rgba(255,255,255,0.04)' } }, x: { ticks: { color: '#8B8882' }, grid: { display: false } } } }
      });
    });
  }, [payouts]);

  useEffect(() => () => { if (chartInst.current) chartInst.current.destroy(); }, []);

  // Challenge P&L: trades since challenge startDate
  function getChallengeStats(ch) {
    const since = trades.filter(t => t.date >= ch.startDate);
    const pnl   = since.reduce((s, t) => s + t.pnl, 0);
    const acct  = parseFloat(ch.accountSize) || 1;
    const profitTarget  = acct * (ch.profitTarget  / 100);
    const dailyLimit    = acct * (ch.dailyLossLimit / 100);
    const maxDD         = acct * (ch.maxDrawdown    / 100);
    const todayPnl      = since.filter(t => t.date === new Date().toISOString().slice(0, 10)).reduce((s, t) => s + t.pnl, 0);
    const profitPct     = Math.min(1, Math.max(0, pnl / profitTarget));
    const dailyUsedPct  = todayPnl < 0 ? Math.min(1, Math.abs(todayPnl) / dailyLimit) : 0;
    const drawdownAmt   = Math.min(0, pnl); // simplified: running PnL low
    const ddPct         = Math.min(1, Math.abs(drawdownAmt) / maxDD);
    const passed        = pnl >= profitTarget;
    const failedDailyLimit = todayPnl <= -dailyLimit;
    const failedDrawdown   = pnl <= -maxDD;
    const failed        = failedDailyLimit || failedDrawdown;
    return { pnl, profitTarget, dailyLimit, maxDD, todayPnl, profitPct, dailyUsedPct, ddPct, passed, failed, failedDailyLimit, failedDrawdown, tradeCount: since.length };
  }

  // Save challenge
  function saveChal() {
    if (!chalForm.firm.trim() || !chalForm.accountSize || !chalForm.startDate) {
      setChalSaving(false); return;
    }
    const color = FIRM_COLORS[challenges.length % FIRM_COLORS.length];
    const newChal = { ...chalForm, id: cuid(), color, accountSize: parseFloat(chalForm.accountSize) };
    const updated = [...challenges, newChal];
    setChallenges(updated);
    saveChallenges(updated);
    setShowAddChal(false);
    setChalForm(EMPTY_FORM);
    showToast('Challenge added', 'success');
  }

  function deleteChal(id) {
    const updated = challenges.filter(c => c.id !== id);
    setChallenges(updated);
    saveChallenges(updated);
    setConfirmDelChal(null);
    showToast('Challenge removed', 'success');
  }

  // Save payout
  const save = async () => {
    if (!date || !firm || !parseFloat(amount) || parseFloat(amount) <= 0) {
      setMsg('Need date, firm, and amount'); setTimeout(() => setMsg(''), 3000); return;
    }
    setSaving(true);
    const result = await addPayout({ date, firm: firm.trim(), amount: parseFloat(amount), notes: notes.trim() });
    setSaving(false);
    if (!result.ok) { setMsg('Save failed: ' + result.error); return; }
    showToast(result.offline ? 'Saved offline' : 'Payout logged', result.offline ? 'warn' : 'success');
    setFirm(''); setAmount(''); setNotes('');
  };

  const handleDelete = async (id) => {
    await deletePayout(id);
    setConfirmDel(null);
    showToast('Payout deleted', 'success');
  };

  // Group payouts by firm for the summary
  const byFirm = useMemo(() => {
    const map = {};
    payouts.forEach(p => {
      if (!map[p.firm]) map[p.firm] = 0;
      map[p.firm] += p.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [payouts]);

  return (
    <div className="jm-view">
      <div className="jm-greeting">
        <p className="jm-hello">Your prop firms at a glance</p>
        <h1 className="jm-page-title">Prop Firm <span>HQ</span></h1>
      </div>

      {/* ── CHALLENGES ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h2 className="jm-card-title" style={{ margin: 0 }}>Active Challenges</h2>
        <button
          onClick={() => setShowAddChal(true)}
          style={{ fontSize: '12px', fontWeight: 700, color: '#E07A3B', background: 'rgba(224,122,59,0.1)', border: '1px solid rgba(224,122,59,0.25)', borderRadius: '8px', padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          + Add challenge
        </button>
      </div>

      {challenges.length === 0 && (
        <div className="jm-empty" style={{ marginBottom: '20px' }}>
          <div className="jm-empty-icon">◎</div>
          No challenges yet. Add your first prop firm challenge above.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        {challenges.map(ch => {
          const s = getChallengeStats(ch);
          const statusColor = s.passed ? '#E07A3B' : s.failed ? '#E24B4A' : ch.color;
          const statusLabel = s.passed ? '✓ PASSED' : s.failed ? '✗ FAILED' : '● ACTIVE';
          return (
            <div key={ch.id} style={{
              background: 'var(--c-surface)', border: `1px solid ${s.failed ? 'rgba(226,75,74,0.4)' : s.passed ? 'rgba(224,122,59,0.4)' : 'var(--c-border)'}`,
              borderRadius: '16px', padding: '18px', position: 'relative', overflow: 'hidden'
            }}>
              {/* Top accent bar */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: statusColor, borderRadius: '16px 16px 0 0' }} />

              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--c-text)' }}>{ch.firm}</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: `${statusColor}22`, color: statusColor, letterSpacing: '0.5px' }}>
                      {statusLabel}
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--c-text-2)' }}>
                    ${parseFloat(ch.accountSize).toLocaleString()} account · since {ch.startDate} · {s.tradeCount} trades
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <span style={{ fontSize: '20px', fontWeight: 900, color: s.pnl >= 0 ? '#E07A3B' : '#F09595' }}>
                    {s.pnl >= 0 ? '+' : ''}{fmt(s.pnl)}
                  </span>
                  <button onClick={() => setConfirmDelChal(ch.id)} style={{ background: 'transparent', border: 'none', color: '#5F5C56', fontSize: '16px', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }} title="Remove challenge">×</button>
                </div>
              </div>

              {/* Progress bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Profit target */}
                <ProgressBar
                  label="Profit Target"
                  value={s.pnl}
                  target={s.profitTarget}
                  pct={s.profitPct}
                  color={s.passed ? '#E07A3B' : ch.color}
                  valueStr={`${fmt(s.pnl)} / ${fmt(s.profitTarget)}`}
                  suffix={`${(s.profitPct * 100).toFixed(1)}%`}
                />

                {/* Daily loss limit */}
                <ProgressBar
                  label={`Daily Loss Used${s.failedDailyLimit ? ' ⚠' : ''}`}
                  value={Math.abs(Math.min(0, s.todayPnl))}
                  target={s.dailyLimit}
                  pct={s.dailyUsedPct}
                  color={s.dailyUsedPct > 0.75 ? '#F09595' : s.dailyUsedPct > 0.5 ? '#EFC97A' : '#E07A3B'}
                  valueStr={s.todayPnl < 0 ? `${fmt(Math.abs(s.todayPnl))} used of ${fmt(s.dailyLimit)}` : `${fmt(0)} used today`}
                  suffix={`${(s.dailyUsedPct * 100).toFixed(1)}%`}
                  danger={s.failedDailyLimit}
                />

                {/* Max drawdown */}
                <ProgressBar
                  label={`Max Drawdown${s.failedDrawdown ? ' ⚠' : ''}`}
                  value={Math.abs(Math.min(0, s.pnl))}
                  target={s.maxDD}
                  pct={s.ddPct}
                  color={s.ddPct > 0.75 ? '#F09595' : s.ddPct > 0.5 ? '#EFC97A' : '#A89687'}
                  valueStr={s.pnl < 0 ? `${fmt(Math.abs(s.pnl))} / ${fmt(s.maxDD)}` : `No drawdown`}
                  suffix={`${(s.ddPct * 100).toFixed(1)}%`}
                  danger={s.failedDrawdown}
                />
              </div>

              {/* Stats row */}
              <div style={{ display: 'flex', gap: '16px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--c-border)', flexWrap: 'wrap' }}>
                <Stat label="Profit Target" val={`${ch.profitTarget}%`} />
                <Stat label="Daily Loss Limit" val={`${ch.dailyLossLimit}%`} />
                <Stat label="Max Drawdown" val={`${ch.maxDrawdown}%`} />
                <Stat label="Remaining" val={fmt(Math.max(0, s.profitTarget - s.pnl))} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── PAYOUTS SECTION ───────────────────────────────────────────────── */}
      <h2 className="jm-card-title" style={{ marginBottom: '12px' }}>Withdrawal History</h2>

      {/* Hero total */}
      {payouts.length > 0 && (
        <div className="jm-hero" style={{ background: 'radial-gradient(ellipse at top right, rgba(224,122,59,0.2) 0%, rgba(224,122,59,0.04) 50%, #1E1C16 100%)', borderColor: 'rgba(224,122,59,0.35)', marginBottom: '12px' }}>
          <p className="jm-hero-label">Total withdrawn</p>
          <p className="jm-hero-val" style={{ color: '#B6EBD8' }}>{fmt(total)}</p>
          <p className="jm-hero-meta">{payouts.length} payout{payouts.length === 1 ? '' : 's'} across {byFirm.length} firm{byFirm.length === 1 ? '' : 's'}</p>
        </div>
      )}

      {/* By-firm breakdown */}
      {byFirm.length > 1 && (
        <div className="jm-card" style={{ marginBottom: '12px' }}>
          <h2 className="jm-card-title">By firm</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {byFirm.map(([firm, amt]) => {
              const pct = total > 0 ? amt / total : 0;
              return (
                <div key={firm}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--c-text)' }}>{firm}</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#E07A3B' }}>{fmt(amt)}</span>
                  </div>
                  <div style={{ height: '4px', borderRadius: '2px', background: 'var(--c-border)' }}>
                    <div style={{ height: '100%', borderRadius: '2px', background: '#E07A3B', width: `${pct * 100}%`, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Chart */}
      {payouts.length > 1 && (
        <div className="jm-card" style={{ marginBottom: '12px' }}>
          <h2 className="jm-card-title">Cumulative payouts</h2>
          <div style={{ position: 'relative', height: '180px' }}>
            <canvas ref={chartRef} />
          </div>
        </div>
      )}

      {/* Add payout form */}
      <div className="jm-card" style={{ marginBottom: '14px' }}>
        <h2 className="jm-card-title">Log a withdrawal</h2>
        <div className="jm-g2">
          <div className="jm-field">
            <label>Date</label>
            <input type="date" className="jm-in" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="jm-field">
            <label>Prop firm / source</label>
            <input type="text" className="jm-in" placeholder="FTMO, Apex, MFF…" value={firm} onChange={e => setFirm(e.target.value)} />
          </div>
        </div>
        <div className="jm-field" style={{ marginBottom: '16px' }}>
          <label>Amount ($)</label>
          <input type="number" className="jm-in" placeholder="500.00" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div className="jm-field" style={{ marginBottom: '20px' }}>
          <label>Notes (optional)</label>
          <textarea className="jm-in" rows={2} placeholder="First payout from FTMO challenge…" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="jm-btn" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Log withdrawal'}
          </button>
          {msg && <span style={{ fontSize: '12px', color: '#E24B4A', fontWeight: 500 }}>{msg}</span>}
        </div>
      </div>

      {/* Payout list */}
      {payouts.length === 0 ? (
        <div className="jm-empty">
          <div className="jm-empty-icon">$</div>
          No withdrawals logged yet.
        </div>
      ) : (
        <div>
          {payouts.map(p => (
            <div key={p.id} className="jm-trade">
              <div className="jm-trade-head">
                <div>
                  <strong style={{ fontSize: '15px', color: '#F5F3ED' }}>{p.firm}</strong>
                  <span style={{ fontSize: '12px', color: '#6B6862', marginLeft: '10px' }}>{p.date}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 600, color: '#E07A3B' }}>{fmt(p.amount)}</span>
                  <button onClick={() => setConfirmDel(p.id)} style={{ background: 'transparent', border: '0.5px solid #2A2720', color: '#8B8882', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(226,75,74,0.5)'; e.currentTarget.style.color = '#F09595'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#2A2720'; e.currentTarget.style.color = '#8B8882'; }}>
                    Delete
                  </button>
                </div>
              </div>
              {p.notes && <p style={{ fontSize: '13px', color: '#A8A49E', margin: '6px 0 0', lineHeight: 1.55 }}>{p.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {/* ── MODALS ────────────────────────────────────────────────────────── */}

      {/* Add challenge modal */}
      {showAddChal && (
        <>
          <div className="edit-overlay" onClick={() => setShowAddChal(false)} />
          <div className="edit-modal">
            <div className="edit-card" style={{ maxWidth: '420px', width: '92vw' }}>
              <h2 style={{ fontSize: '17px', marginBottom: '18px' }}>New Challenge</h2>

              <div className="jm-g2" style={{ marginBottom: '12px' }}>
                <div className="jm-field">
                  <label>Prop firm name</label>
                  <input type="text" className="jm-in" placeholder="FTMO, Apex…" value={chalForm.firm} onChange={e => setChalForm(f => ({ ...f, firm: e.target.value }))} />
                </div>
                <div className="jm-field">
                  <label>Account size ($)</label>
                  <input type="number" className="jm-in" placeholder="100000" value={chalForm.accountSize} onChange={e => setChalForm(f => ({ ...f, accountSize: e.target.value }))} />
                </div>
              </div>

              <div className="jm-field" style={{ marginBottom: '12px' }}>
                <label>Challenge start date</label>
                <input type="date" className="jm-in" value={chalForm.startDate} onChange={e => setChalForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>

              <div className="jm-g2" style={{ marginBottom: '12px' }}>
                <div className="jm-field">
                  <label>Profit target (%)</label>
                  <input type="number" className="jm-in" placeholder="10" step="0.5" value={chalForm.profitTarget} onChange={e => setChalForm(f => ({ ...f, profitTarget: parseFloat(e.target.value) || 0 }))} />
                  <span style={{ fontSize: '11px', color: '#6B6862', marginTop: '3px' }}>
                    = {chalForm.accountSize ? fmt((parseFloat(chalForm.accountSize) || 0) * chalForm.profitTarget / 100) : '$—'}
                  </span>
                </div>
                <div className="jm-field">
                  <label>Daily loss limit (%)</label>
                  <input type="number" className="jm-in" placeholder="5" step="0.5" value={chalForm.dailyLossLimit} onChange={e => setChalForm(f => ({ ...f, dailyLossLimit: parseFloat(e.target.value) || 0 }))} />
                  <span style={{ fontSize: '11px', color: '#6B6862', marginTop: '3px' }}>
                    = {chalForm.accountSize ? fmt((parseFloat(chalForm.accountSize) || 0) * chalForm.dailyLossLimit / 100) : '$—'}
                  </span>
                </div>
              </div>

              <div className="jm-field" style={{ marginBottom: '20px' }}>
                <label>Max drawdown (%)</label>
                <input type="number" className="jm-in" placeholder="10" step="0.5" style={{ maxWidth: '180px' }} value={chalForm.maxDrawdown} onChange={e => setChalForm(f => ({ ...f, maxDrawdown: parseFloat(e.target.value) || 0 }))} />
                <span style={{ fontSize: '11px', color: '#6B6862', marginTop: '3px' }}>
                  = {chalForm.accountSize ? fmt((parseFloat(chalForm.accountSize) || 0) * chalForm.maxDrawdown / 100) : '$—'}
                </span>
              </div>

              <div className="edit-actions">
                <button className="btn-ghost" onClick={() => { setShowAddChal(false); setChalForm(EMPTY_FORM); }}>Cancel</button>
                <button className="jm-btn" onClick={saveChal} disabled={chalSaving}>Add Challenge</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete challenge confirm */}
      {confirmDelChal && (
        <>
          <div className="edit-overlay" onClick={() => setConfirmDelChal(null)} />
          <div className="edit-modal">
            <div className="edit-card" style={{ maxWidth: '360px' }}>
              <h2 style={{ fontSize: '17px' }}>Remove this challenge?</h2>
              <p style={{ fontSize: '13px', color: '#8B8882', margin: '0 0 20px', lineHeight: 1.5 }}>Your trades won't be affected.</p>
              <div className="edit-actions">
                <button className="btn-ghost" onClick={() => setConfirmDelChal(null)}>Cancel</button>
                <button className="btn-danger" onClick={() => deleteChal(confirmDelChal)}>Remove</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete payout confirm */}
      {confirmDel && (
        <>
          <div className="edit-overlay" onClick={() => setConfirmDel(null)} />
          <div className="edit-modal">
            <div className="edit-card" style={{ maxWidth: '380px' }}>
              <h2 style={{ fontSize: '17px' }}>Delete this payout?</h2>
              <p style={{ fontSize: '13px', color: '#8B8882', margin: '0 0 20px', lineHeight: 1.5 }}>This can't be undone.</p>
              <div className="edit-actions">
                <button className="btn-ghost" onClick={() => setConfirmDel(null)}>Cancel</button>
                <button className="btn-danger" onClick={() => handleDelete(confirmDel)}>Delete</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProgressBar({ label, value, target, pct, color, valueStr, suffix, danger }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: danger ? '#F09595' : 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--c-text-2)' }}>{valueStr}</span>
          <span style={{ fontSize: '11px', fontWeight: 700, color }}>{suffix}</span>
        </div>
      </div>
      <div style={{ height: '6px', borderRadius: '3px', background: 'var(--c-border)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: '3px', background: color,
          width: `${Math.max(0, Math.min(100, pct * 100))}%`,
          transition: 'width 0.5s ease',
          boxShadow: pct > 0.9 ? `0 0 8px ${color}` : 'none',
        }} />
      </div>
    </div>
  );
}

function Stat({ label, val }) {
  return (
    <div>
      <p style={{ margin: '0 0 2px', fontSize: '10px', color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--c-text)' }}>{val}</p>
    </div>
  );
}

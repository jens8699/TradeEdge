import { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { fmt } from '../../lib/utils';

// ── Challenge helpers ─────────────────────────────────────────────────────────

const CK = 'te_challenges';
function loadChallenges() { try { return JSON.parse(localStorage.getItem(CK) || '[]'); } catch { return []; } }
function saveChallenges(list) { localStorage.setItem(CK, JSON.stringify(list)); }
function cuid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

const FIRM_COLORS = ['#E07A3B', '#A89687', '#EFC97A', '#B085EB', '#EB85B3', '#5DCAA5'];
const EMPTY_FORM  = { firm: '', accountSize: '', profitTarget: 10, dailyLossLimit: 5, maxDrawdown: 10, startDate: new Date().toISOString().slice(0, 10) };

// ── Layout helpers ────────────────────────────────────────────────────────────

function HR() {
  return <div style={{ height: 1, background: 'var(--c-border)', margin: '28px 0' }} />;
}

function Eyebrow({ children, style }) {
  return (
    <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10, ...style }}>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: 'transparent', border: '1px solid var(--c-border)', borderRadius: 8,
  padding: '9px 12px', fontSize: 13, color: 'var(--c-text)', fontFamily: "'Inter', sans-serif",
  outline: 'none',
};

// ── Main component ────────────────────────────────────────────────────────────

export default function Payouts({ showToast }) {
  const { payouts, addPayout, deletePayout, trades } = useApp();

  // Challenge state
  const [challenges,     setChallenges]     = useState(loadChallenges);
  const [showAddChal,    setShowAddChal]    = useState(false);
  const [chalForm,       setChalForm]       = useState(EMPTY_FORM);
  const [confirmDelChal, setConfirmDelChal] = useState(null);

  // Payout form state
  const [date,       setDate]       = useState(new Date().toISOString().slice(0, 10));
  const [firm,       setFirm]       = useState('');
  const [amount,     setAmount]     = useState('');
  const [notes,      setNotes]      = useState('');
  const [saving,     setSaving]     = useState(false);
  const [msg,        setMsg]        = useState('');
  const [confirmDel, setConfirmDel] = useState(null);

  const total  = payouts.reduce((s, p) => s + p.amount, 0);
  const sorted = useMemo(() => [...payouts].sort((a, b) => b.date.localeCompare(a.date)), [payouts]);

  // Group payouts by firm
  const byFirm = useMemo(() => {
    const map = {};
    payouts.forEach(p => { if (!map[p.firm]) map[p.firm] = 0; map[p.firm] += p.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [payouts]);

  // Challenge stats
  function getChallengeStats(ch) {
    const since     = trades.filter(t => t.date >= ch.startDate);
    const pnl       = since.reduce((s, t) => s + t.pnl, 0);
    const acct      = parseFloat(ch.accountSize) || 1;
    const profitTarget     = acct * (ch.profitTarget  / 100);
    const dailyLimit       = acct * (ch.dailyLossLimit / 100);
    const maxDD            = acct * (ch.maxDrawdown    / 100);
    const todayPnl         = since.filter(t => t.date === new Date().toISOString().slice(0, 10)).reduce((s, t) => s + t.pnl, 0);
    const profitPct        = Math.min(1, Math.max(0, pnl / profitTarget));
    const dailyUsedPct     = todayPnl < 0 ? Math.min(1, Math.abs(todayPnl) / dailyLimit) : 0;
    const ddPct            = Math.min(1, Math.abs(Math.min(0, pnl)) / maxDD);
    const passed           = pnl >= profitTarget;
    const failedDailyLimit = todayPnl <= -dailyLimit;
    const failedDrawdown   = pnl <= -maxDD;
    const failed           = failedDailyLimit || failedDrawdown;
    return { pnl, profitTarget, dailyLimit, maxDD, todayPnl, profitPct, dailyUsedPct, ddPct, passed, failed, failedDailyLimit, failedDrawdown, tradeCount: since.length };
  }

  // Challenge handlers
  function saveChal() {
    if (!chalForm.firm.trim() || !chalForm.accountSize || !chalForm.startDate) return;
    const color   = FIRM_COLORS[challenges.length % FIRM_COLORS.length];
    const newChal = { ...chalForm, id: cuid(), color, accountSize: parseFloat(chalForm.accountSize) };
    const updated = [...challenges, newChal];
    setChallenges(updated);
    saveChallenges(updated);
    setShowAddChal(false);
    setChalForm(EMPTY_FORM);
    showToast('Challenge added');
  }

  function deleteChal(id) {
    const updated = challenges.filter(c => c.id !== id);
    setChallenges(updated);
    saveChallenges(updated);
    setConfirmDelChal(null);
    showToast('Challenge removed');
  }

  // Payout handlers
  const save = async () => {
    if (!date || !firm || !parseFloat(amount) || parseFloat(amount) <= 0) {
      setMsg('Need date, firm, and amount'); setTimeout(() => setMsg(''), 3000); return;
    }
    setSaving(true);
    const result = await addPayout({ date, firm: firm.trim(), amount: parseFloat(amount), notes: notes.trim() });
    setSaving(false);
    if (!result.ok) { setMsg('Save failed: ' + result.error); return; }
    showToast(result.offline ? 'Saved offline' : 'Payout logged');
    setFirm(''); setAmount(''); setNotes('');
  };

  const handleDelete = async (id) => {
    await deletePayout(id);
    setConfirmDel(null);
    showToast('Payout deleted');
  };

  return (
    <div style={{ padding: '36px 44px', maxWidth: 980, paddingBottom: 64 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <Eyebrow>Payouts</Eyebrow>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 34, letterSpacing: '-0.03em', color: 'var(--c-text)', lineHeight: 1.1 }}>
            Prop firm <em style={{ fontStyle: 'italic', color: 'var(--c-accent)' }}>HQ</em>.
          </div>
        </div>
      </div>

      <HR />

      {/* ── Challenges ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
        <Eyebrow style={{ marginBottom: 0 }}>Active challenges</Eyebrow>
        <button
          onClick={() => setShowAddChal(true)}
          style={{
            fontSize: 11, fontWeight: 600, color: 'var(--c-accent)',
            background: 'rgba(224,122,59,0.08)', border: '1px solid rgba(224,122,59,0.25)',
            borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
          }}
        >
          + Add challenge
        </button>
      </div>

      {challenges.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--c-text-2)', fontSize: 13, lineHeight: 1.8, marginBottom: 8 }}>
          No challenges yet.<br />
          <span style={{ opacity: 0.6 }}>Add your first prop firm challenge above.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 4 }}>
          {challenges.map(ch => {
            const s = getChallengeStats(ch);
            const statusColor = s.passed ? 'var(--c-accent)' : s.failed ? '#C65A45' : ch.color;
            const statusLabel = s.passed ? 'Passed' : s.failed ? 'Failed' : 'Active';

            return (
              <div key={ch.id} style={{
                border: `1px solid ${s.failed ? 'rgba(198,90,69,0.35)' : s.passed ? 'rgba(224,122,59,0.35)' : 'var(--c-border)'}`,
                borderRadius: 14, padding: '20px 22px', position: 'relative', overflow: 'hidden',
              }}>
                {/* Top accent line */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: statusColor, borderRadius: '14px 14px 0 0' }} />

                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, color: 'var(--c-text)', letterSpacing: '-0.02em' }}>{ch.firm}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${statusColor}22`, color: statusColor, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        {statusLabel}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--c-text-2)' }}>
                      ${parseFloat(ch.accountSize).toLocaleString()} · since {ch.startDate} · {s.tradeCount} trade{s.tradeCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 22, fontWeight: 700, color: s.pnl >= 0 ? 'var(--c-accent)' : '#C65A45', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                      {s.pnl >= 0 ? '+' : ''}{fmt(s.pnl)}
                    </div>
                    <button
                      onClick={() => setConfirmDelChal(ch.id)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--c-text-2)', fontSize: 18, cursor: 'pointer', padding: '0 2px', lineHeight: 1, opacity: 0.4 }}
                      title="Remove"
                    >×</button>
                  </div>
                </div>

                {/* Progress bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <ChallengeBar
                    label="Profit target"
                    valueStr={`${fmt(s.pnl)} / ${fmt(s.profitTarget)}`}
                    pct={s.profitPct}
                    color={s.passed ? 'var(--c-accent)' : ch.color}
                    suffix={`${(s.profitPct * 100).toFixed(1)}%`}
                    danger={false}
                  />
                  <ChallengeBar
                    label={`Daily loss${s.failedDailyLimit ? ' — BREACHED' : ''}`}
                    valueStr={s.todayPnl < 0 ? `${fmt(Math.abs(s.todayPnl))} of ${fmt(s.dailyLimit)}` : 'Clear today'}
                    pct={s.dailyUsedPct}
                    color={s.dailyUsedPct > 0.75 ? '#C65A45' : s.dailyUsedPct > 0.5 ? '#EFC97A' : 'var(--c-accent)'}
                    suffix={`${(s.dailyUsedPct * 100).toFixed(1)}%`}
                    danger={s.failedDailyLimit}
                  />
                  <ChallengeBar
                    label={`Max drawdown${s.failedDrawdown ? ' — BREACHED' : ''}`}
                    valueStr={s.pnl < 0 ? `${fmt(Math.abs(s.pnl))} of ${fmt(s.maxDD)}` : 'No drawdown'}
                    pct={s.ddPct}
                    color={s.ddPct > 0.75 ? '#C65A45' : s.ddPct > 0.5 ? '#EFC97A' : '#A89687'}
                    suffix={`${(s.ddPct * 100).toFixed(1)}%`}
                    danger={s.failedDrawdown}
                  />
                </div>

                {/* Stats strip */}
                <div style={{ display: 'flex', gap: 24, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--c-border)', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Target', val: `${ch.profitTarget}% (${fmt((ch.accountSize) * ch.profitTarget / 100)})` },
                    { label: 'Daily limit', val: `${ch.dailyLossLimit}% (${fmt((ch.accountSize) * ch.dailyLossLimit / 100)})` },
                    { label: 'Max DD', val: `${ch.maxDrawdown}% (${fmt((ch.accountSize) * ch.maxDrawdown / 100)})` },
                    { label: 'Remaining', val: fmt(Math.max(0, s.profitTarget - s.pnl)) },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <div style={{ fontSize: 9, color: 'var(--c-text-2)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <HR />

      {/* ── Withdrawal hero ── */}
      {payouts.length > 0 && (
        <>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
              Total withdrawn
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 48, fontWeight: 700, color: 'var(--c-accent)', letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {fmt(total)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--c-text-2)', marginTop: 8 }}>
              {payouts.length} payout{payouts.length === 1 ? '' : 's'} across {byFirm.length} firm{byFirm.length === 1 ? '' : 's'}
            </div>
          </div>

          {/* By-firm breakdown */}
          {byFirm.length > 1 && (
            <div style={{ marginBottom: 28 }}>
              <Eyebrow>By firm</Eyebrow>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {byFirm.map(([firmName, amt]) => (
                  <div key={firmName}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>{firmName}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-accent)', fontVariantNumeric: 'tabular-nums' }}>{fmt(amt)}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                      <div style={{ height: '100%', borderRadius: 2, background: 'var(--c-accent)', width: `${total > 0 ? (amt / total) * 100 : 0}%`, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Log a withdrawal form ── */}
      <div style={{ marginBottom: 32 }}>
        <Eyebrow>Log a withdrawal</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--c-text-2)', marginBottom: 6 }}>Date</div>
            <input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--c-text-2)', marginBottom: 6 }}>Prop firm / source</div>
            <input type="text" style={inputStyle} placeholder="FTMO, Apex, MFF…" value={firm} onChange={e => setFirm(e.target.value)} />
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--c-text-2)', marginBottom: 6 }}>Amount ($)</div>
          <input type="number" style={{ ...inputStyle, maxWidth: 200 }} placeholder="500.00" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--c-text-2)', marginBottom: 6, fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontSize: 14 }}>Notes</div>
          <textarea style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} rows={2} placeholder="First payout from Phase 1 challenge…" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={save}
            disabled={saving}
            style={{
              padding: '10px 24px', borderRadius: 8, border: '1px solid rgba(224,122,59,0.4)',
              background: 'rgba(224,122,59,0.1)', color: 'var(--c-accent)',
              fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer',
              fontFamily: "'Inter', sans-serif", opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Log withdrawal'}
          </button>
          {msg && <span style={{ fontSize: 12, color: '#C65A45' }}>{msg}</span>}
        </div>
      </div>

      {/* ── Payout list ── */}
      {payouts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--c-text-2)', fontSize: 13, lineHeight: 1.8 }}>
          No withdrawals logged yet.<br />
          <span style={{ opacity: 0.6 }}>Log your first payout above.</span>
        </div>
      ) : (
        <>
          <div style={{ height: 1, background: 'var(--c-border)', marginBottom: 0 }} />
          {sorted.map((p, i) => (
            <div key={p.id} style={{
              display: 'grid', gridTemplateColumns: '1fr auto',
              gap: 16, padding: '14px 0', alignItems: 'center',
              borderBottom: i < sorted.length - 1 ? '1px solid var(--c-border)' : 'none',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: p.notes ? 4 : 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)' }}>{p.firm}</span>
                  <span style={{ fontSize: 11, color: 'var(--c-text-2)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.02em' }}>{p.date}</span>
                </div>
                {p.notes && <div style={{ fontSize: 12, color: 'var(--c-text-2)', lineHeight: 1.5 }}>{p.notes}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-accent)', fontVariantNumeric: 'tabular-nums' }}>{fmt(p.amount)}</span>
                <button
                  onClick={() => setConfirmDel(p.id)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--c-text-2)', fontSize: 13, cursor: 'pointer', opacity: 0.4, padding: '2px 4px', lineHeight: 1 }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#C65A45'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '0.4'; e.currentTarget.style.color = 'var(--c-text-2)'; }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── Add challenge modal ── */}
      {showAddChal && (
        <>
          <div onClick={() => setShowAddChal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9998 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 18, padding: '28px', maxWidth: 440, width: '92vw', zIndex: 9999, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, color: 'var(--c-text)', marginBottom: 22, letterSpacing: '-0.02em' }}>
              New challenge
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--c-text-2)', marginBottom: 6 }}>Prop firm</div>
                <input type="text" style={inputStyle} placeholder="FTMO, Apex…" value={chalForm.firm} onChange={e => setChalForm(f => ({ ...f, firm: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--c-text-2)', marginBottom: 6 }}>Account size ($)</div>
                <input type="number" style={inputStyle} placeholder="100000" value={chalForm.accountSize} onChange={e => setChalForm(f => ({ ...f, accountSize: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--c-text-2)', marginBottom: 6 }}>Challenge start date</div>
              <input type="date" style={inputStyle} value={chalForm.startDate} onChange={e => setChalForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--c-text-2)', marginBottom: 6 }}>Profit target (%)</div>
                <input type="number" style={inputStyle} placeholder="10" step="0.5" value={chalForm.profitTarget} onChange={e => setChalForm(f => ({ ...f, profitTarget: parseFloat(e.target.value) || 0 }))} />
                {chalForm.accountSize && <div style={{ fontSize: 10, color: 'var(--c-text-2)', marginTop: 4 }}>= {fmt((parseFloat(chalForm.accountSize) || 0) * chalForm.profitTarget / 100)}</div>}
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--c-text-2)', marginBottom: 6 }}>Daily loss limit (%)</div>
                <input type="number" style={inputStyle} placeholder="5" step="0.5" value={chalForm.dailyLossLimit} onChange={e => setChalForm(f => ({ ...f, dailyLossLimit: parseFloat(e.target.value) || 0 }))} />
                {chalForm.accountSize && <div style={{ fontSize: 10, color: 'var(--c-text-2)', marginTop: 4 }}>= {fmt((parseFloat(chalForm.accountSize) || 0) * chalForm.dailyLossLimit / 100)}</div>}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: 'var(--c-text-2)', marginBottom: 6 }}>Max drawdown (%)</div>
              <input type="number" style={{ ...inputStyle, maxWidth: 200 }} placeholder="10" step="0.5" value={chalForm.maxDrawdown} onChange={e => setChalForm(f => ({ ...f, maxDrawdown: parseFloat(e.target.value) || 0 }))} />
              {chalForm.accountSize && <div style={{ fontSize: 10, color: 'var(--c-text-2)', marginTop: 4 }}>= {fmt((parseFloat(chalForm.accountSize) || 0) * chalForm.maxDrawdown / 100)}</div>}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setShowAddChal(false); setChalForm(EMPTY_FORM); }}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--c-border)', background: 'transparent', color: 'var(--c-text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancel
              </button>
              <button
                onClick={saveChal}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(224,122,59,0.4)', background: 'rgba(224,122,59,0.1)', color: 'var(--c-accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Add challenge
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Delete challenge confirm ── */}
      {confirmDelChal && <ConfirmModal title="Remove this challenge?" body="Your trades won't be affected." onCancel={() => setConfirmDelChal(null)} onConfirm={() => deleteChal(confirmDelChal)} confirmLabel="Remove" />}

      {/* ── Delete payout confirm ── */}
      {confirmDel && <ConfirmModal title="Delete this payout?" body="This can't be undone." onCancel={() => setConfirmDel(null)} onConfirm={() => handleDelete(confirmDel)} confirmLabel="Delete" />}
    </div>
  );
}

// ── Challenge progress bar ────────────────────────────────────────────────────

function ChallengeBar({ label, valueStr, pct, color, suffix, danger }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: danger ? '#C65A45' : 'var(--c-text-2)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
          <span style={{ fontSize: 11, color: 'var(--c-text-2)', fontVariantNumeric: 'tabular-nums' }}>{valueStr}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color }}>{suffix}</span>
        </div>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3, background: color,
          width: `${Math.max(0, Math.min(100, pct * 100))}%`,
          transition: 'width 0.5s ease',
          boxShadow: pct > 0.9 ? `0 0 8px ${color}99` : 'none',
        }} />
      </div>
    </div>
  );
}

// ── Generic confirm modal ─────────────────────────────────────────────────────

function ConfirmModal({ title, body, onCancel, onConfirm, confirmLabel }) {
  return (
    <>
      <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9998 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 16, padding: '28px', maxWidth: 360, width: '90%', zIndex: 9999 }}>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, color: 'var(--c-text)', marginBottom: 10, letterSpacing: '-0.02em' }}>{title}</div>
        <p style={{ fontSize: 13, color: 'var(--c-text-2)', margin: '0 0 22px', lineHeight: 1.6 }}>{body}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--c-border)', background: 'transparent', color: 'var(--c-text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(198,90,69,0.35)', background: 'rgba(198,90,69,0.08)', color: '#C65A45', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{confirmLabel}</button>
        </div>
      </div>
    </>
  );
}

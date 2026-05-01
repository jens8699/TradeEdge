import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { fmt } from '../../lib/utils';

// Persisted in localStorage under this key. Move to Supabase when needed.
const STORAGE_KEY = 'te_prop_firm_accounts';

// Common prop firms — shown as suggestions in the firm-name input.
const FIRM_PRESETS = [
  'FTMO', 'TopStep', 'Apex', 'Tradeify', 'MyFundedFutures',
  'The5%ers', 'FundedNext', 'Earn2Trade', 'Trade The Pool', 'Bulenox',
];

const STATUS_OPTIONS = [
  { value: 'funded',    label: 'Funded',    color: '#5DCAA5' },
  { value: 'eval',      label: 'Eval',      color: 'var(--c-text-2)' },
  { value: 'near-dd',   label: 'Near DD',   color: '#C65A45' },
  { value: 'breached',  label: 'Breached',  color: '#C65A45' },
];

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function loadAccounts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAccounts(accs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accs));
  } catch {}
}

// ── Per-firm ROI aggregation ────────────────────────────────────────────────
// Sums account costs and payout amounts per firm. Returns array sorted by net
// (most profitable first). Firm name match is case-insensitive + trim.
function computeFirmROI(accounts, payouts) {
  const byFirm = new Map();

  function getOrInit(firmName) {
    const key = (firmName || '').toLowerCase().trim();
    if (!key) return null;
    if (!byFirm.has(key)) {
      byFirm.set(key, {
        firm: firmName.trim(),
        spent: 0,
        earned: 0,
        accountCount: 0,
        payoutCount: 0,
      });
    }
    return byFirm.get(key);
  }

  for (const a of accounts) {
    const entry = getOrInit(a.firm);
    if (!entry) continue;
    entry.spent += Number(a.cost) || 0;
    entry.accountCount++;
  }

  for (const p of (payouts || [])) {
    const entry = getOrInit(p.firm);
    if (!entry) continue;
    entry.earned += Number(p.amount) || 0;
    entry.payoutCount++;
  }

  return Array.from(byFirm.values())
    .map(e => ({
      ...e,
      net: e.earned - e.spent,
      // null when no money spent — prevents "Infinity%" on payout-only firms
      roi: e.spent > 0 ? ((e.earned - e.spent) / e.spent) * 100 : null,
    }))
    .sort((a, b) => b.net - a.net);
}

// ── Edit / Add modal ─────────────────────────────────────────────────────────

function AccountModal({ initial, onSave, onClose }) {
  const [acc, setAcc] = useState(initial || {
    id: uid(),
    firm: '',
    name: '',
    accountSize: 50000,
    status: 'eval',
    pnl: 0,
    ddRemaining: 2000,
    ddMax: 2000,
    payoutPct: 0,
    cost: 0, // total spent on this account (challenge fee + resets + monthly subs)
    notes: '',
  });

  function set(field, v) { setAcc(a => ({ ...a, [field]: v })); }

  function handleSubmit() {
    if (!acc.firm.trim()) { alert('Pick a firm name'); return; }
    onSave({
      ...acc,
      accountSize: Number(acc.accountSize) || 0,
      pnl: Number(acc.pnl) || 0,
      ddRemaining: Number(acc.ddRemaining) || 0,
      ddMax: Number(acc.ddMax) || 0,
      payoutPct: Math.max(0, Math.min(100, Number(acc.payoutPct) || 0)),
      cost: Math.max(0, Number(acc.cost) || 0),
    });
  }

  return (
    <div style={modalStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modalStyles.modal}>
        <div style={modalStyles.header}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--c-text)' }}>
            {initial ? 'Edit account' : 'Add prop firm account'}
          </h3>
          <button onClick={onClose} style={modalStyles.closeBtn}>✕</button>
        </div>

        <div style={modalStyles.body}>
          <Field label="Firm">
            <input
              list="firm-presets"
              value={acc.firm}
              onChange={e => set('firm', e.target.value)}
              placeholder="FTMO, TopStep, Apex…"
              style={modalStyles.input}
              autoFocus
            />
            <datalist id="firm-presets">
              {FIRM_PRESETS.map(f => <option key={f} value={f} />)}
            </datalist>
          </Field>

          <Field label="Account name (optional)">
            <input
              value={acc.name}
              onChange={e => set('name', e.target.value)}
              placeholder='e.g. "Combine A1" or "Funded #2"'
              style={modalStyles.input}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Account size ($)">
              <input
                type="number"
                value={acc.accountSize}
                onChange={e => set('accountSize', e.target.value)}
                style={modalStyles.input}
              />
            </Field>
            <Field label="Status">
              <select
                value={acc.status}
                onChange={e => set('status', e.target.value)}
                style={modalStyles.input}
              >
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Current P&L ($)">
              <input
                type="number"
                value={acc.pnl}
                onChange={e => set('pnl', e.target.value)}
                style={modalStyles.input}
              />
            </Field>
            <Field label="% to next payout">
              <input
                type="number"
                min="0"
                max="100"
                value={acc.payoutPct}
                onChange={e => set('payoutPct', e.target.value)}
                style={modalStyles.input}
              />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Drawdown left ($)">
              <input
                type="number"
                value={acc.ddRemaining}
                onChange={e => set('ddRemaining', e.target.value)}
                style={modalStyles.input}
              />
            </Field>
            <Field label="Max drawdown ($)">
              <input
                type="number"
                value={acc.ddMax}
                onChange={e => set('ddMax', e.target.value)}
                style={modalStyles.input}
              />
            </Field>
          </div>

          <Field label="Total spent on this account ($)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={acc.cost}
              onChange={e => set('cost', e.target.value)}
              placeholder="e.g. 200 (challenge fee + any resets)"
              style={modalStyles.input}
            />
            <div style={{ fontSize: 10.5, color: 'var(--c-text-2)', opacity: 0.7, marginTop: 5, lineHeight: 1.4 }}>
              Add up everything you've paid for this account: original challenge fee, resets, monthly subs. Used to calculate ROI vs payouts received.
            </div>
          </Field>

          <Field label="Notes (optional)">
            <textarea
              value={acc.notes}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              style={{ ...modalStyles.input, fontFamily: 'inherit', resize: 'vertical' }}
            />
          </Field>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={onClose} style={modalStyles.ghostBtn}>Cancel</button>
            <button onClick={handleSubmit} style={modalStyles.primaryBtn}>
              {initial ? 'Save changes' : 'Add account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--c-text-2)', marginBottom: 5, fontWeight: 500, letterSpacing: '0.04em' }}>
        {label}
      </div>
      {children}
    </label>
  );
}

// ── Account row ──────────────────────────────────────────────────────────────

function AccountRow({ account, onEdit, onDelete }) {
  const isWarn = account.status === 'near-dd' || account.status === 'breached' || account.pnl < 0;
  const status = STATUS_OPTIONS.find(s => s.value === account.status) || STATUS_OPTIONS[1];
  const ddPct = account.ddMax > 0 ? Math.max(0, Math.min(100, 100 - (account.ddRemaining / account.ddMax) * 100)) : 0;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'auto 1fr auto auto',
      gap: 16,
      alignItems: 'center',
      padding: '14px 18px',
      border: `1px solid ${isWarn ? 'rgba(198,90,69,0.4)' : 'var(--c-border)'}`,
      background: isWarn ? 'rgba(198,90,69,0.04)' : 'var(--c-surface)',
      borderRadius: 14,
      transition: 'border-color 0.2s',
    }}>
      {/* Firm mark */}
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: isWarn ? 'rgba(198,90,69,0.1)' : 'rgba(224,122,59,0.12)',
        border: `1px solid ${isWarn ? 'rgba(198,90,69,0.3)' : 'rgba(224,122,59,0.25)'}`,
        color: isWarn ? '#C65A45' : 'var(--c-accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Fraunces', Georgia, serif",
        fontSize: 18, fontWeight: 500,
      }}>
        {(account.firm[0] || '?').toUpperCase()}
      </div>

      {/* Info */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)' }}>
            {account.firm}{account.name ? ` · ${account.name}` : ''}
          </span>
          <span style={{ fontSize: 12, color: 'var(--c-text-2)' }}>
            ${(account.accountSize || 0).toLocaleString()}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--c-text-2)' }}>
          <span style={{
            display: 'inline-block',
            fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500,
            padding: '2px 7px', borderRadius: 4,
            background: status.value === 'funded' ? 'rgba(93,202,165,0.12)' :
                        status.value === 'near-dd' || status.value === 'breached' ? 'rgba(198,90,69,0.12)' :
                        'var(--c-overlay-medium)',
            color: status.color,
          }}>
            {status.label}
          </span>
          {account.payoutPct > 0 && (
            <span>{account.payoutPct.toFixed(0)}% to next payout</span>
          )}
          {account.ddMax > 0 && (
            <span>· ${account.ddRemaining.toLocaleString()} / ${account.ddMax.toLocaleString()} DD left</span>
          )}
        </div>
        {/* Drawdown progress bar */}
        {account.ddMax > 0 && (
          <div style={{ height: 4, background: 'var(--c-border)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${ddPct}%`,
              background: ddPct > 70 ? '#C65A45' : ddPct > 40 ? '#EFC97A' : '#5DCAA5',
              transition: 'width 0.3s ease',
            }} />
          </div>
        )}
      </div>

      {/* P&L */}
      <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        <div style={{
          fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
          color: account.pnl >= 0 ? 'var(--c-accent)' : '#C65A45',
        }}>
          {account.pnl >= 0 ? '+' : ''}{fmt(account.pnl)}
        </div>
        <div style={{ fontSize: 10, color: 'var(--c-text-2)', marginTop: 2 }}>
          MTD
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button
          onClick={() => onEdit(account)}
          style={iconBtn}
          title="Edit"
        >✎</button>
        <button
          onClick={() => onDelete(account.id)}
          style={{ ...iconBtn, color: '#C65A45' }}
          title="Delete"
        >×</button>
      </div>
    </div>
  );
}

const iconBtn = {
  background: 'transparent',
  border: '1px solid var(--c-border)',
  color: 'var(--c-text-2)',
  width: 26, height: 26,
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 14,
  lineHeight: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'inherit',
};

// ── Main view ────────────────────────────────────────────────────────────────

export default function PropFirmTracker() {
  const { payouts } = useApp();
  const [accounts, setAccounts] = useState(loadAccounts);
  const [editing, setEditing] = useState(null); // account being edited, or 'new', or null

  useEffect(() => { saveAccounts(accounts); }, [accounts]);

  // Per-firm ROI: aggregate cost from accounts + payouts received per firm.
  // Includes firms that only appear in payouts (no account in tracker yet) so
  // nothing is lost; that's a soft nudge to add the account.
  const firmROI = useMemo(() => computeFirmROI(accounts, payouts), [accounts, payouts]);
  const roiTotals = useMemo(() => {
    const t = firmROI.reduce(
      (acc, f) => {
        acc.spent += f.spent;
        acc.earned += f.earned;
        return acc;
      },
      { spent: 0, earned: 0 },
    );
    t.net = t.earned - t.spent;
    t.roi = t.spent > 0 ? (t.net / t.spent) * 100 : null;
    return t;
  }, [firmROI]);

  function handleSave(acc) {
    setAccounts(prev => {
      const idx = prev.findIndex(a => a.id === acc.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = acc;
        return next;
      }
      return [...prev, acc];
    });
    setEditing(null);
  }

  function handleDelete(id) {
    if (!confirm('Delete this account from the tracker?')) return;
    setAccounts(prev => prev.filter(a => a.id !== id));
  }

  // Derived stats
  const totalPnl   = accounts.reduce((s, a) => s + (a.pnl || 0), 0);
  const fundedCount = accounts.filter(a => a.status === 'funded').length;
  const evalCount   = accounts.filter(a => a.status === 'eval').length;
  const closestDD = accounts
    .filter(a => a.ddMax > 0 && a.ddRemaining < a.ddMax)
    .reduce((min, a) => (a.ddRemaining < min.ddRemaining || min.ddRemaining < 0 ? a : min), { ddRemaining: -1 });

  // Sort: warn first, then funded by P&L desc, then eval
  const sorted = [...accounts].sort((a, b) => {
    const aWarn = a.status === 'near-dd' || a.status === 'breached' ? 1 : 0;
    const bWarn = b.status === 'near-dd' || b.status === 'breached' ? 1 : 0;
    if (aWarn !== bWarn) return bWarn - aWarn;
    return (b.pnl || 0) - (a.pnl || 0);
  });

  return (
    <div style={{ padding: 'clamp(20px, 5vw, 36px) clamp(16px, 4.5vw, 44px) 64px', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>
          Across all firms
        </div>
        <div style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: 34, letterSpacing: '-0.03em', color: 'var(--c-text)',
          lineHeight: 1.1, marginBottom: 10,
        }}>
          Prop Firm Tracker<span style={{ color: 'var(--c-accent)' }}>.</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--c-text-2)', lineHeight: 1.6, maxWidth: 580 }}>
          One view of every account you're trading. Track funded vs eval, monitor drawdown across firms, and see the only number that matters at the bottom.
        </div>
      </div>

      {/* Summary */}
      {accounts.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}>
          <Stat label="Net P&L · MTD" value={`${totalPnl >= 0 ? '+' : ''}${fmt(totalPnl)}`} accent={totalPnl >= 0 ? 'accent' : 'warn'} />
          <Stat label="Active accounts" value={accounts.length} sub={`${fundedCount} funded · ${evalCount} eval`} />
          <Stat label="Funded" value={fundedCount} />
          <Stat
            label="Closest to DD"
            value={closestDD.ddRemaining >= 0 ? fmt(closestDD.ddRemaining) : '—'}
            sub={closestDD.ddRemaining >= 0 ? `${closestDD.firm}` : 'Nothing in danger'}
            accent="warn"
          />
        </div>
      )}

      {/* ── Per-firm ROI ── */}
      {firmROI.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                Per-firm ROI
              </div>
              <div style={{ fontSize: 13, color: 'var(--c-text-2)', lineHeight: 1.5, maxWidth: 540 }}>
                What you've actually paid each firm vs. what you've actually been paid back. The number that matters most.
              </div>
            </div>
          </div>

          {/* Total summary — across all firms */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12,
            marginBottom: 14,
            padding: '14px 18px',
            border: '1px solid var(--c-border)',
            borderRadius: 14,
            background: roiTotals.net >= 0 ? 'rgba(224,122,59,0.04)' : 'rgba(198,90,69,0.04)',
          }}>
            <ROIStatCell label="Total spent" value={fmt(roiTotals.spent)} />
            <ROIStatCell label="Total earned" value={fmt(roiTotals.earned)} />
            <ROIStatCell
              label="Net"
              value={`${roiTotals.net >= 0 ? '+' : ''}${fmt(roiTotals.net)}`}
              accent={roiTotals.net >= 0 ? 'good' : 'bad'}
            />
            <ROIStatCell
              label="ROI"
              value={roiTotals.roi != null ? `${roiTotals.roi >= 0 ? '+' : ''}${roiTotals.roi.toFixed(0)}%` : '—'}
              accent={roiTotals.roi == null ? 'muted' : roiTotals.roi >= 0 ? 'good' : 'bad'}
            />
          </div>

          {/* Per-firm rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {firmROI.map(f => {
              const isProfit = f.net >= 0;
              return (
                <div key={f.firm} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto auto auto',
                  gap: 16, alignItems: 'center',
                  padding: '12px 18px',
                  border: '1px solid var(--c-border)',
                  borderRadius: 12,
                  background: 'var(--c-surface)',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--c-text)', marginBottom: 3 }}>
                      {f.firm}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--c-text-2)' }}>
                      {f.accountCount} account{f.accountCount !== 1 ? 's' : ''} · {f.payoutCount} payout{f.payoutCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <ROICell label="Spent"  value={fmt(f.spent)} />
                  <ROICell label="Earned" value={fmt(f.earned)} />
                  <ROICell
                    label="Net"
                    value={`${isProfit ? '+' : ''}${fmt(f.net)}`}
                    accent={isProfit ? 'good' : 'bad'}
                  />
                  <ROICell
                    label="ROI"
                    value={f.roi != null ? `${f.roi >= 0 ? '+' : ''}${f.roi.toFixed(0)}%` : '—'}
                    accent={f.roi == null ? 'muted' : f.roi >= 0 ? 'good' : 'bad'}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Add button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontStyle: 'italic',
          fontSize: 16, color: 'var(--c-text-2)',
        }}>
          {accounts.length === 0 ? 'No accounts yet' : `${accounts.length} account${accounts.length !== 1 ? 's' : ''}, sorted by status`}
        </div>
        <button
          onClick={() => setEditing('new')}
          style={{
            background: 'var(--c-accent)', color: '#fff', border: 'none',
            borderRadius: 10, padding: '9px 16px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif",
          }}
        >
          + Add account
        </button>
      </div>

      {/* List */}
      {accounts.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '64px 24px',
          border: '1px dashed var(--c-border)',
          borderRadius: 16,
          color: 'var(--c-text-2)',
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🪙</div>
          <p style={{ margin: '0 0 6px', fontSize: 15, color: 'var(--c-text)', fontWeight: 500 }}>
            Start tracking your accounts
          </p>
          <p style={{ margin: '0 0 16px', fontSize: 13, lineHeight: 1.6, maxWidth: 380, marginInline: 'auto' }}>
            Add each FTMO, TopStep, Apex (or other) account you're trading and TradeEdge will surface them all in one place.
          </p>
          <button
            onClick={() => setEditing('new')}
            style={{
              background: 'var(--c-accent)', color: '#fff', border: 'none',
              borderRadius: 10, padding: '9px 18px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif",
            }}
          >
            + Add your first account
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map(a => (
            <AccountRow
              key={a.id}
              account={a}
              onEdit={() => setEditing(a)}
              onDelete={handleDelete}
            />
          ))}
          {/* Footer total */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            padding: '14px 18px',
            marginTop: 4,
            borderTop: '1px dashed var(--c-border)',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: '0.06em',
            color: 'var(--c-text-2)',
          }}>
            <span>{accounts.length} accounts · MTD</span>
            <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: 14, color: 'var(--c-text-2)', textTransform: 'none' }}>
              Net <b style={{ fontStyle: 'normal', fontWeight: 600, color: totalPnl >= 0 ? 'var(--c-accent)' : '#C65A45', fontFamily: "'Inter', sans-serif" }}>
                {totalPnl >= 0 ? '+' : ''}{fmt(totalPnl)}
              </b>
            </span>
          </div>
        </div>
      )}

      {editing && (
        <AccountModal
          initial={editing === 'new' ? null : editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function Stat({ label, value, sub, accent }) {
  const color = accent === 'accent' ? 'var(--c-accent)' : accent === 'warn' ? '#C65A45' : 'var(--c-text)';
  return (
    <div style={{ border: '1px solid var(--c-border)', borderRadius: 14, padding: '14px 16px', background: 'var(--c-surface)' }}>
      <div style={{ fontSize: 10, color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--c-text-2)', marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

// Small inline cell for the per-firm ROI rows (fits in a tight grid column).
function ROICell({ label, value, accent }) {
  const color =
    accent === 'good' ? 'var(--c-accent)' :
    accent === 'bad'  ? '#C65A45' :
    accent === 'muted' ? 'var(--c-text-2)' :
    'var(--c-text)';
  return (
    <div style={{ minWidth: 70, textAlign: 'right' }}>
      <div style={{ fontSize: 9.5, color: 'var(--c-text-2)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2, fontFamily: "'JetBrains Mono', monospace" }}>
        {label}
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
        {value}
      </div>
    </div>
  );
}

// Larger version for the across-all-firms summary card.
function ROIStatCell({ label, value, accent }) {
  const color =
    accent === 'good' ? 'var(--c-accent)' :
    accent === 'bad'  ? '#C65A45' :
    accent === 'muted' ? 'var(--c-text-2)' :
    'var(--c-text)';
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, color: 'var(--c-text-2)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value}
      </div>
    </div>
  );
}

// ── Modal styles ─────────────────────────────────────────────────────────────

const modalStyles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, padding: 16,
  },
  modal: {
    background: 'var(--c-surface)', borderRadius: 20,
    border: '1px solid var(--c-border)', width: '100%', maxWidth: 460,
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 20px', borderBottom: '1px solid var(--c-border)',
  },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--c-text-2)',
    cursor: 'pointer', fontSize: 16, padding: 4, lineHeight: 1,
  },
  body: { padding: 20 },
  input: {
    width: '100%', background: 'var(--c-overlay-medium)',
    border: '1px solid var(--c-border)', borderRadius: 8,
    padding: '9px 12px', color: 'var(--c-text)',
    fontSize: 13, boxSizing: 'border-box', outline: 'none',
    fontFamily: "'Inter', sans-serif",
  },
  primaryBtn: {
    flex: 1, padding: 11, background: 'var(--c-accent)',
    color: '#fff', border: 'none', borderRadius: 10,
    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif",
  },
  ghostBtn: {
    padding: '11px 16px', background: 'transparent',
    color: 'var(--c-text)', border: '1px solid var(--c-border)',
    borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
  },
};

import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { tradovateAuth, tradovateAuthMFA, tradovateGetAccounts, tradovateSyncTrades } from '../../lib/tradovate';
import { sb } from '../../lib/supabase';

// ── Platform definitions ──────────────────────────────────────────────────────

const PLATFORMS = [
  {
    id: 'tradovate',
    name: 'Tradovate',
    logo: '⬡',
    color: '#00C2E0',
    description: 'Futures trading — used by Apex, TopStep, Earn2Trade',
    status: 'available',
    tags: ['Futures', 'Prop Firms'],
  },
  {
    id: 'rithmic',
    name: 'Rithmic',
    logo: '◈',
    color: '#7C5CFC',
    description: 'Futures & options — used by many prop firms',
    status: 'coming_soon',
    tags: ['Futures', 'Prop Firms'],
  },
  {
    id: 'tradestation',
    name: 'TradeStation',
    logo: '◇',
    color: '#E8724A',
    description: 'Stocks, options & futures broker',
    status: 'coming_soon',
    tags: ['Stocks', 'Options', 'Futures'],
  },
  {
    id: 'ibkr',
    name: 'Interactive Brokers',
    logo: '⬛',
    color: '#C41230',
    description: 'Multi-asset broker with global reach',
    status: 'coming_soon',
    tags: ['Stocks', 'Options', 'Forex'],
  },
  {
    id: 'alpaca',
    name: 'Alpaca',
    logo: '⬟',
    color: '#FFCE00',
    description: 'Commission-free stocks & crypto API',
    status: 'coming_soon',
    tags: ['Stocks', 'Crypto'],
  },
  {
    id: 'mt4mt5',
    name: 'MT4 / MT5',
    logo: '⬢',
    color: '#4E9AF1',
    description: 'MetaTrader — Forex & CFD platforms',
    status: 'guide',
    tags: ['Forex', 'CFDs'],
  },
  {
    id: 'ninjatrader',
    name: 'NinjaTrader',
    logo: '◎',
    color: '#F4A460',
    description: 'Advanced futures & forex platform',
    status: 'coming_soon',
    tags: ['Futures', 'Forex'],
  },
  {
    id: 'thinkorswim',
    name: 'thinkorswim',
    logo: '◉',
    color: '#00A651',
    description: 'TD Ameritrade / Schwab flagship platform',
    status: 'coming_soon',
    tags: ['Stocks', 'Options', 'Futures'],
  },
];

// ── Tradovate Connect Modal ───────────────────────────────────────────────────

function TradovateModal({ onClose, onConnected, existingAccount }) {
  const [step, setStep] = useState(existingAccount ? 'connected' : 'credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  // MFA state
  const [mfaState, setMfaState] = useState(null); // { pTicket, pTime, pCaptcha }
  const [mfaCode, setMfaCode] = useState('');

  async function handleConnect() {
    if (!username.trim() || !password.trim()) {
      setError('Please enter your Tradovate username and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const auth = await tradovateAuth({ username: username.trim(), password, isDemo });
      if (auth.mfaRequired) {
        // MFA needed — show code input step
        setMfaState({ pTicket: auth.pTicket, pTime: auth.pTime, pCaptcha: auth.pCaptcha });
        setStep('mfa');
        return;
      }
      await finishConnect(auth);
    } catch (e) {
      setError(e.message || 'Connection failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaSubmit() {
    if (!mfaCode.trim()) { setError('Enter the code from your authenticator app or email.'); return; }
    setLoading(true);
    setError('');
    try {
      const auth = await tradovateAuthMFA({
        username: username.trim(),
        password,
        isDemo,
        pTicket: mfaState.pTicket,
        pTime: mfaState.pTime,
        pCaptcha: mfaState.pCaptcha,
        mfaCode,
      });
      if (auth.mfaRequired) throw new Error('MFA code incorrect or expired. Try again.');
      await finishConnect(auth);
    } catch (e) {
      setError(e.message || 'MFA failed.');
    } finally {
      setLoading(false);
    }
  }

  async function finishConnect(auth) {
    const accs = await tradovateGetAccounts({ accessToken: auth.accessToken, isDemo });
    setAccounts(accs);
    if (accs.length === 1) setSelectedAccountId(accs[0].id);
    window.__tvAuth = { ...auth, isDemo, username: username.trim() };
    setStep('accounts');
  }

  async function handleSaveAccount() {
    if (!selectedAccountId) return;
    const auth = window.__tvAuth;
    const acc = accounts.find(a => a.id === selectedAccountId);
    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await sb.auth.getUser();
      const row = {
        user_id: user.id,
        platform: 'tradovate',
        account_id: String(selectedAccountId),
        account_name: acc?.nickname || acc?.name || 'Tradovate',
        is_demo: auth.isDemo,
        credentials: {
          username: auth.username,
          accessToken: auth.accessToken,
          expirationTime: auth.expirationTime,
          userId: auth.userId,
        },
        last_sync_at: null,
        trade_count: 0,
        active: true,
      };
      const { error: dbErr } = await sb.from('connected_accounts').upsert(row, {
        onConflict: 'user_id,platform,account_id',
      });
      if (dbErr) throw new Error(dbErr.message);
      onConnected(row);
      setStep('connected');
    } catch (e) {
      setError(e.message || 'Failed to save account.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    const auth = window.__tvAuth || existingAccount?.credentials;
    if (!auth) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const accId = existingAccount?.account_id
        ? parseInt(existingAccount.account_id)
        : selectedAccountId;
      const since = existingAccount?.last_sync_at || null;
      const trades = await tradovateSyncTrades({
        accessToken: auth.accessToken,
        isDemo: auth.isDemo ?? existingAccount?.is_demo ?? false,
        accountId: accId,
        since,
      });

      if (!trades.length) {
        setSyncResult({ count: 0, message: 'No new trades found.' });
        return;
      }

      const { data: { user } } = await sb.auth.getUser();
      const toInsert = trades.map(t => ({ ...t, user_id: user.id }));

      // Upsert by external_id to avoid duplicates
      const { error: insertErr } = await sb.from('trades').upsert(toInsert, {
        onConflict: 'user_id,external_id',
        ignoreDuplicates: true,
      });
      if (insertErr) throw new Error(insertErr.message);

      // Update last_sync_at
      await sb.from('connected_accounts').update({
        last_sync_at: new Date().toISOString(),
        trade_count: (existingAccount?.trade_count || 0) + trades.length,
      }).eq('user_id', user.id).eq('platform', 'tradovate').eq('account_id', String(accId));

      setSyncResult({ count: trades.length, message: `${trades.length} trade${trades.length !== 1 ? 's' : ''} synced!` });
    } catch (e) {
      setSyncResult({ error: true, message: e.message || 'Sync failed.' });
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (!existingAccount) return;
    const { data: { user } } = await sb.auth.getUser();
    await sb.from('connected_accounts')
      .delete()
      .eq('user_id', user.id)
      .eq('platform', 'tradovate')
      .eq('account_id', existingAccount.account_id);
    onClose();
    window.location.reload();
  }

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ ...styles.platformIcon, background: 'rgba(0,194,224,0.12)', color: '#00C2E0', fontSize: '20px' }}>⬡</div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--c-text)' }}>Tradovate</h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--c-text-2)' }}>Live &amp; Demo accounts</p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        {/* Step: Credentials */}
        {step === 'credentials' && (
          <div style={styles.modalBody}>
            <p style={styles.hint}>
              Connect your Tradovate account to automatically sync your trade history into TradeEdge.
              Your credentials are stored securely in your account and never shared.
            </p>

            <div style={styles.toggleRow}>
              <button
                style={{ ...styles.envBtn, ...(isDemo ? {} : styles.envBtnActive) }}
                onClick={() => setIsDemo(false)}
              >
                Live
              </button>
              <button
                style={{ ...styles.envBtn, ...(isDemo ? styles.envBtnActive : {}) }}
                onClick={() => setIsDemo(true)}
              >
                Demo
              </button>
            </div>

            <label style={styles.label}>Username</label>
            <input
              style={styles.input}
              type="text"
              placeholder="Your Tradovate username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConnect()}
              autoComplete="username"
            />

            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              placeholder="Your Tradovate password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConnect()}
              autoComplete="current-password"
            />

            {error && <p style={styles.error}>{error}</p>}

            <button
              style={{ ...styles.primaryBtn, marginTop: '4px', opacity: loading ? 0.7 : 1 }}
              onClick={handleConnect}
              disabled={loading}
            >
              {loading ? 'Connecting…' : 'Connect Account'}
            </button>
          </div>
        )}

        {/* Step: MFA code */}
        {step === 'mfa' && (
          <div style={styles.modalBody}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔐</div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: 'var(--c-text)' }}>Two-factor authentication</p>
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--c-text-2)', lineHeight: 1.5 }}>
                Tradovate sent a verification code to your email or authenticator app. Enter it below.
              </p>
            </div>

            <label style={styles.label}>Verification code</label>
            <input
              style={{ ...styles.input, textAlign: 'center', fontSize: '20px', letterSpacing: '0.2em', fontWeight: 600 }}
              type="text"
              inputMode="numeric"
              placeholder="000000"
              maxLength={8}
              value={mfaCode}
              onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && handleMfaSubmit()}
              autoFocus
            />

            {error && <p style={styles.error}>{error}</p>}

            <button
              style={{ ...styles.primaryBtn, opacity: loading ? 0.7 : 1 }}
              onClick={handleMfaSubmit}
              disabled={loading}
            >
              {loading ? 'Verifying…' : 'Verify & Continue'}
            </button>
            <button
              style={{ ...styles.primaryBtn, marginTop: '8px', background: 'transparent', color: 'var(--c-text-2)', border: '1px solid var(--c-border)' }}
              onClick={() => { setStep('credentials'); setError(''); setMfaCode(''); }}
            >
              Back
            </button>
          </div>
        )}

        {/* Step: Choose account */}
        {step === 'accounts' && (
          <div style={styles.modalBody}>
            <p style={styles.hint}>Found {accounts.length} account{accounts.length !== 1 ? 's' : ''}. Choose which one to connect:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {accounts.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => setSelectedAccountId(acc.id)}
                  style={{
                    ...styles.accountRow,
                    border: selectedAccountId === acc.id
                      ? '1.5px solid #E8724A'
                      : '1px solid var(--c-border)',
                    background: selectedAccountId === acc.id
                      ? 'rgba(232,114,74,0.06)'
                      : 'var(--c-bg)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 500, color: 'var(--c-text)', fontSize: '13px' }}>{acc.nickname || acc.name}</span>
                    <span style={{ fontSize: '12px', color: 'var(--c-text-2)' }}>
                      {acc.balance != null ? `$${Number(acc.balance).toLocaleString()}` : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--c-text-2)', marginTop: '2px' }}>
                    {window.__tvAuth?.isDemo ? 'Demo' : 'Live'} · ID {acc.id}
                  </div>
                </button>
              ))}
            </div>
            {error && <p style={styles.error}>{error}</p>}
            <button
              style={{ ...styles.primaryBtn, opacity: (!selectedAccountId || loading) ? 0.6 : 1 }}
              onClick={handleSaveAccount}
              disabled={!selectedAccountId || loading}
            >
              {loading ? 'Saving…' : 'Save & Connect'}
            </button>
          </div>
        )}

        {/* Step: Connected */}
        {step === 'connected' && (
          <div style={styles.modalBody}>
            <div style={styles.successBadge}>✓ Connected</div>
            <p style={styles.hint}>
              Your Tradovate account is connected. Click <strong>Sync Now</strong> to pull in your latest trades, or it will sync automatically on your next visit.
            </p>

            {existingAccount && (
              <div style={styles.syncInfo}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--c-text-2)', marginBottom: '6px' }}>
                  <span>Account</span>
                  <span style={{ color: 'var(--c-text)' }}>{existingAccount.account_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--c-text-2)', marginBottom: '6px' }}>
                  <span>Environment</span>
                  <span style={{ color: 'var(--c-text)' }}>{existingAccount.is_demo ? 'Demo' : 'Live'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--c-text-2)', marginBottom: '6px' }}>
                  <span>Trades synced</span>
                  <span style={{ color: 'var(--c-text)' }}>{existingAccount.trade_count || 0}</span>
                </div>
                {existingAccount.last_sync_at && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--c-text-2)' }}>
                    <span>Last sync</span>
                    <span style={{ color: 'var(--c-text)' }}>
                      {new Date(existingAccount.last_sync_at).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}

            {syncResult && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                marginBottom: '12px',
                fontSize: '13px',
                background: syncResult.error ? 'rgba(239,68,68,0.08)' : 'rgba(93,202,165,0.08)',
                color: syncResult.error ? '#EF4444' : '#5DCAA5',
                border: `1px solid ${syncResult.error ? 'rgba(239,68,68,0.2)' : 'rgba(93,202,165,0.2)'}`,
              }}>
                {syncResult.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                style={{ ...styles.primaryBtn, flex: 1, opacity: syncing ? 0.7 : 1 }}
                onClick={handleSync}
                disabled={syncing}
              >
                {syncing ? 'Syncing…' : '↻ Sync Now'}
              </button>
              <button style={styles.dangerBtn} onClick={handleDisconnect}>
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tradovate CSV Import Modal ────────────────────────────────────────────────

function parseTradovateCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error('CSV appears to be empty.');

  // Normalize headers
  const rawHeaders = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());

  // Flexible column mapping
  function col(names) {
    for (const n of names) {
      const idx = rawHeaders.findIndex(h => h.includes(n));
      if (idx >= 0) return idx;
    }
    return -1;
  }

  const idxId        = col(['id', 'fill id', 'trade id', 'execution id']);
  const idxTimestamp = col(['timestamp', 'date', 'time', 'datetime', 'fill time', 'trade date']);
  const idxSymbol    = col(['symbol', 'contract', 'instrument', 'name', 'contractid']);
  const idxAction    = col(['action', 'side', 'buy/sell', 'direction', 'b/s']);
  const idxQty       = col(['qty', 'quantity', 'size', 'filled qty', 'contracts']);
  const idxPrice     = col(['price', 'fill price', 'execution price', 'avg price']);
  const idxPnl       = col(['pnl', 'net pnl', 'realized pnl', 'profit', 'gain', 'net profit', 'p&l', 'netpnl']);
  const idxComm      = col(['commission', 'fees', 'fee', 'comm']);

  const trades = [];
  const skipped = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted commas in CSV
    const cells = [];
    let inQ = false, cur = '';
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    cells.push(cur.trim());

    const get = idx => (idx >= 0 ? cells[idx] || '' : '');

    const pnlRaw = parseFloat(get(idxPnl).replace(/[$,]/g, ''));
    // Skip rows with no P&L (opening fills) — only import closing fills
    if (isNaN(pnlRaw) || pnlRaw === 0) { skipped.push(i + 1); continue; }

    const actionRaw = get(idxAction).toLowerCase();
    const direction = actionRaw.includes('sell') ? 'Long' : actionRaw.includes('buy') ? 'Short' : 'Long';

    const tsRaw = get(idxTimestamp);
    let date = new Date().toISOString().slice(0, 10);
    if (tsRaw) {
      const parsed = new Date(tsRaw);
      if (!isNaN(parsed)) date = parsed.toISOString().slice(0, 10);
    }

    const symbol = get(idxSymbol) || 'UNKNOWN';
    const external_id = get(idxId) ? `tv_csv_${get(idxId)}` : `hv_csv_${i}_${date}`;

    trades.push({
      symbol: symbol.replace(/\s+/g, '').toUpperCase(),
      direction,
      pnl: parseFloat(pnlRaw.toFixed(2)),
      date,
      entry: parseFloat(get(idxPrice)) || null,
      exit: null,
      qty: parseInt(get(idxQty)) || 1,
      notes: `Imported from Tradovate CSV`,
      source: 'tradovate_csv',
      external_id,
    });
  }

  return { trades, skipped };
}

function TradovateCSVModal({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null); // { trades, skipped }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setError('');
    setPreview(null);
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const result = parseTradovateCSV(ev.target.result);
        setPreview(result);
      } catch (err) {
        setError(err.message || 'Could not parse CSV.');
      }
    };
    reader.readAsText(f);
  }

  async function handleImport() {
    if (!preview?.trades?.length) return;
    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await sb.auth.getUser();
      const toInsert = preview.trades.map(t => ({ ...t, user_id: user.id }));
      const { error: dbErr, data } = await sb.from('trades').upsert(toInsert, {
        onConflict: 'user_id,external_id',
        ignoreDuplicates: true,
      });
      if (dbErr) throw new Error(dbErr.message);
      setDone(preview.trades.length);
      onImported?.(preview.trades.length);
    } catch (e) {
      setError(e.message || 'Import failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...styles.modal, maxWidth: '460px' }}>
        <div style={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ ...styles.platformIcon, background: 'rgba(0,194,224,0.12)', color: '#00C2E0', fontSize: '18px' }}>↑</div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--c-text)' }}>Import Tradovate CSV</h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--c-text-2)' }}>Upload your fills export</p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <div style={styles.modalBody}>
          {!done ? (
            <>
              <div style={{
                background: 'rgba(0,194,224,0.04)', border: '1px solid rgba(0,194,224,0.15)',
                borderRadius: '10px', padding: '12px 14px', marginBottom: '16px',
              }}>
                <p style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 600, color: '#00C2E0' }}>How to export from Tradovate</p>
                <ol style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--c-text-2)', lineHeight: 1.7 }}>
                  <li>Open <strong style={{ color: 'var(--c-text)' }}>trader.tradovate.com</strong></li>
                  <li>Go to <strong style={{ color: 'var(--c-text)' }}>Account → Performance</strong></li>
                  <li>Click the <strong style={{ color: 'var(--c-text)' }}>Fills</strong> tab</li>
                  <li>Click <strong style={{ color: 'var(--c-text)' }}>Export → CSV</strong></li>
                </ol>
              </div>

              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                border: `2px dashed ${file ? '#00C2E0' : 'var(--c-border)'}`,
                borderRadius: '12px', padding: '24px 16px', cursor: 'pointer',
                background: file ? 'rgba(0,194,224,0.04)' : 'var(--c-bg)',
                transition: 'all 0.2s', marginBottom: '12px',
              }}>
                <input type="file" accept=".csv,.txt" onChange={handleFile} style={{ display: 'none' }} />
                <span style={{ fontSize: '24px', marginBottom: '8px' }}>📄</span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--c-text)' }}>
                  {file ? file.name : 'Click to select CSV file'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--c-text-2)', marginTop: '3px' }}>
                  {file ? 'Click to choose a different file' : '.csv files only'}
                </span>
              </label>

              {preview && (
                <div style={{
                  background: 'rgba(93,202,165,0.06)', border: '1px solid rgba(93,202,165,0.2)',
                  borderRadius: '10px', padding: '10px 14px', marginBottom: '12px',
                }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#5DCAA5', fontWeight: 600 }}>
                    ✓ {preview.trades.length} trade{preview.trades.length !== 1 ? 's' : ''} ready to import
                  </p>
                  {preview.skipped.length > 0 && (
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--c-text-2)' }}>
                      {preview.skipped.length} rows skipped (opening fills / no P&L)
                    </p>
                  )}
                  {preview.trades.slice(0, 3).map((t, i) => (
                    <div key={i} style={{ fontSize: '11px', color: 'var(--c-text-2)', marginTop: '4px' }}>
                      {t.date} · {t.symbol} · {t.direction} · {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}
                    </div>
                  ))}
                  {preview.trades.length > 3 && (
                    <div style={{ fontSize: '11px', color: 'var(--c-text-2)', marginTop: '2px' }}>
                      …and {preview.trades.length - 3} more
                    </div>
                  )}
                </div>
              )}

              {error && <p style={styles.error}>{error}</p>}

              <button
                style={{
                  ...styles.primaryBtn,
                  opacity: (!preview?.trades?.length || loading) ? 0.5 : 1,
                }}
                onClick={handleImport}
                disabled={!preview?.trades?.length || loading}
              >
                {loading ? 'Importing…' : `Import ${preview?.trades?.length || ''} Trades`}
              </button>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎉</div>
              <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: '15px', color: 'var(--c-text)' }}>
                {done} trade{done !== 1 ? 's' : ''} imported!
              </p>
              <p style={{ margin: '0 0 20px', fontSize: '12px', color: 'var(--c-text-2)' }}>
                Your trades are now in your journal. Head to History or Stats to see them.
              </p>
              <button style={styles.primaryBtn} onClick={onClose}>Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MT4/MT5 Guide Modal ───────────────────────────────────────────────────────

function MT5GuideModal({ onClose }) {
  const steps = [
    {
      n: '1',
      title: 'Download the TradeEdge EA',
      body: 'An Expert Advisor (EA) acts as a bridge between MT4/MT5 and TradeEdge. Download the EA file (.ex4 or .ex5) from your TradeEdge settings page.',
    },
    {
      n: '2',
      title: 'Install the EA in MetaTrader',
      body: 'In MT4/MT5, go to File → Open Data Folder → MQL4 (or MQL5) → Experts. Copy the downloaded .ex4/.ex5 file into that folder, then restart MetaTrader.',
    },
    {
      n: '3',
      title: 'Attach the EA to a chart',
      body: 'Drag the TradeEdge EA onto any open chart. In the EA settings, paste your TradeEdge API key (found in Settings → API Keys). Enable "Allow WebRequests" in MT4/MT5 options for api.tradeedge.app.',
    },
    {
      n: '4',
      title: 'Verify the connection',
      body: 'The EA will automatically send your closed trades to TradeEdge after each fill. You should see a green "Connected" status in the EA\'s comment box and trades appearing in your journal within seconds.',
    },
  ];

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...styles.modal, maxWidth: '500px' }}>
        <div style={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ ...styles.platformIcon, background: 'rgba(78,154,241,0.12)', color: '#4E9AF1', fontSize: '20px' }}>⬢</div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--c-text)' }}>MT4 / MT5 Setup Guide</h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--c-text-2)' }}>Connect via Expert Advisor</p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <div style={styles.modalBody}>
          <p style={styles.hint}>
            MetaTrader doesn't offer a direct API for third-party apps, but you can connect TradeEdge
            using a lightweight Expert Advisor that runs inside MT4/MT5 and automatically pushes your trades.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
            {steps.map(s => (
              <div key={s.n} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(232,114,74,0.12)', color: '#E8724A',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: 700, marginTop: '1px',
                }}>
                  {s.n}
                </div>
                <div>
                  <p style={{ margin: '0 0 3px', fontSize: '13px', fontWeight: 600, color: 'var(--c-text)' }}>{s.title}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--c-text-2)', lineHeight: 1.6 }}>{s.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div style={{
            background: 'rgba(232,114,74,0.06)', border: '1px solid rgba(232,114,74,0.2)',
            borderRadius: '10px', padding: '12px 14px',
          }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#E8724A', fontWeight: 600 }}>
              Coming soon
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--c-text-2)' }}>
              The TradeEdge EA and API keys are in development. You'll be notified when they're ready.
              In the meantime, you can manually log trades using the Log Trade tab.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Connections View ─────────────────────────────────────────────────────

export default function Connections({ user, showToast }) {
  const { addTrade } = useApp();
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [activeModal, setActiveModal] = useState(null); // platform id or null

  // Load existing connected accounts from Supabase
  useEffect(() => {
    async function loadAccounts() {
      setLoadingAccounts(true);
      try {
        const { data, error } = await sb.from('connected_accounts').select('*');
        if (!error && data) setConnectedAccounts(data);
      } catch {}
      setLoadingAccounts(false);
    }
    loadAccounts();
  }, []);

  function getConnectedAccount(platformId) {
    return connectedAccounts.find(a => a.platform === platformId) || null;
  }

  function handleConnected(newAccount) {
    setConnectedAccounts(prev => {
      const idx = prev.findIndex(a => a.platform === newAccount.platform && a.account_id === newAccount.account_id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = newAccount;
        return next;
      }
      return [...prev, newAccount];
    });
    showToast?.('Account connected successfully!');
  }

  const totalConnected = connectedAccounts.length;
  const totalTrades = connectedAccounts.reduce((s, a) => s + (a.trade_count || 0), 0);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 2px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700, color: 'var(--c-text)' }}>
          Connected Accounts
        </h2>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--c-text-2)' }}>
          Link your prop firm and brokerage accounts. TradeEdge automatically syncs your trades so you never have to log them manually.
        </p>
      </div>

      {/* Summary bar */}
      {totalConnected > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px',
        }}>
          {[
            { label: 'Connected', value: totalConnected },
            { label: 'Trades synced', value: totalTrades.toLocaleString() },
            { label: 'Auto-sync', value: 'Active' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--c-surface)', border: '1px solid var(--c-border)',
              borderRadius: '14px', padding: '14px 16px',
            }}>
              <p style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 700, color: 'var(--c-text)' }}>{s.value}</p>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Platform grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: '14px',
      }}>
        {PLATFORMS.map(platform => {
          const connected = getConnectedAccount(platform.id);
          const isConnected = !!connected;

          return (
            <div
              key={platform.id}
              style={{
                background: 'var(--c-surface)',
                border: isConnected ? `1.5px solid ${platform.color}40` : '1px solid var(--c-border)',
                borderRadius: '16px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                position: 'relative',
                transition: 'border-color 0.2s',
              }}
            >
              {/* Platform header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                    background: `${platform.color}18`,
                    color: platform.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px',
                  }}>
                    {platform.logo}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: 'var(--c-text)' }}>{platform.name}</p>
                    <div style={{ display: 'flex', gap: '4px', marginTop: '3px', flexWrap: 'wrap' }}>
                      {platform.tags.map(t => (
                        <span key={t} style={{
                          fontSize: '10px', padding: '1px 7px', borderRadius: '100px',
                          background: 'var(--c-bg)', color: 'var(--c-text-2)',
                          border: '1px solid var(--c-border)',
                        }}>{t}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Status dot */}
                {isConnected && (
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: '#5DCAA5', flexShrink: 0, marginTop: '4px',
                  }} title="Connected" />
                )}
              </div>

              {/* Description */}
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--c-text-2)', lineHeight: 1.5 }}>
                {platform.description}
              </p>

              {/* Connected account info */}
              {isConnected && (
                <div style={{
                  background: 'var(--c-bg)', borderRadius: '8px', padding: '10px 12px',
                  border: '1px solid var(--c-border)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--c-text)', fontWeight: 500 }}>{connected.account_name}</span>
                    <span style={{ fontSize: '11px', color: '#5DCAA5' }}>{connected.is_demo ? 'Demo' : 'Live'}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--c-text-2)' }}>
                    {connected.trade_count || 0} trades synced
                    {connected.last_sync_at && (
                      <> · Last: {new Date(connected.last_sync_at).toLocaleDateString()}</>
                    )}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {platform.status === 'available' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 'auto' }}>
                  <button
                    onClick={() => setActiveModal(platform.id)}
                    style={{
                      ...styles.cardBtn,
                      background: isConnected ? 'transparent' : '#E8724A',
                      color: isConnected ? 'var(--c-text)' : '#fff',
                      border: isConnected ? '1px solid var(--c-border)' : 'none',
                    }}
                  >
                    {isConnected ? '⚙ Manage' : '+ Connect'}
                  </button>
                  {/* CSV import always available for Tradovate */}
                  {platform.id === 'tradovate' && (
                    <button
                      onClick={() => setActiveModal('tradovate_csv')}
                      style={{
                        ...styles.cardBtn,
                        background: 'transparent',
                        color: '#00C2E0',
                        border: '1px solid rgba(0,194,224,0.3)',
                        fontSize: '11px',
                      }}
                    >
                      ↑ Import CSV
                    </button>
                  )}
                </div>
              )}

              {platform.status === 'coming_soon' && (
                <div style={{
                  fontSize: '12px', color: 'var(--c-text-2)', textAlign: 'center',
                  padding: '8px', borderRadius: '8px',
                  border: '1px dashed var(--c-border)',
                  background: 'var(--c-bg)',
                }}>
                  Coming soon
                </div>
              )}

              {platform.status === 'guide' && (
                <button
                  onClick={() => setActiveModal(platform.id)}
                  style={{
                    ...styles.cardBtn,
                    background: 'transparent',
                    color: 'var(--c-text)',
                    border: '1px solid var(--c-border)',
                  }}
                >
                  View Setup Guide
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom note */}
      <div style={{
        marginTop: '24px', padding: '14px 18px',
        background: 'var(--c-surface)', border: '1px solid var(--c-border)',
        borderRadius: '14px', fontSize: '12px', color: 'var(--c-text-2)', lineHeight: 1.6,
      }}>
        <strong style={{ color: 'var(--c-text)' }}>How sync works:</strong> When you connect an account, TradeEdge pulls your closed trade history and maps each fill to your journal. New trades sync automatically each time you visit. Your broker credentials are encrypted and stored securely — TradeEdge has read-only access to your account data and cannot place or modify orders.
      </div>

      {/* Modals */}
      {activeModal === 'tradovate' && (
        <TradovateModal
          onClose={() => setActiveModal(null)}
          onConnected={handleConnected}
          existingAccount={getConnectedAccount('tradovate')}
        />
      )}
      {activeModal === 'tradovate_csv' && (
        <TradovateCSVModal
          onClose={() => setActiveModal(null)}
          onImported={count => showToast?.(`${count} trades imported from Tradovate CSV!`)}
        />
      )}
      {activeModal === 'mt4mt5' && (
        <MT5GuideModal onClose={() => setActiveModal(null)} />
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, padding: '16px',
  },
  modal: {
    background: 'var(--c-surface)', borderRadius: '20px',
    border: '1px solid var(--c-border)', width: '100%', maxWidth: '420px',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 20px', borderBottom: '1px solid var(--c-border)',
  },
  modalBody: {
    padding: '20px',
  },
  platformIcon: {
    width: '40px', height: '40px', borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--c-text-2)',
    cursor: 'pointer', fontSize: '16px', padding: '4px',
    lineHeight: 1,
  },
  hint: {
    fontSize: '12px', color: 'var(--c-text-2)', lineHeight: 1.6,
    marginTop: 0, marginBottom: '16px',
  },
  label: {
    display: 'block', fontSize: '12px', color: 'var(--c-text-2)',
    marginBottom: '6px', fontWeight: 500,
  },
  input: {
    width: '100%', background: 'var(--c-bg)', border: '1px solid var(--c-border)',
    borderRadius: '8px', padding: '9px 12px', color: 'var(--c-text)',
    fontSize: '13px', marginBottom: '12px', boxSizing: 'border-box',
    outline: 'none',
  },
  toggleRow: {
    display: 'flex', gap: '6px', marginBottom: '16px',
    background: 'var(--c-bg)', border: '1px solid var(--c-border)',
    borderRadius: '8px', padding: '3px',
  },
  envBtn: {
    flex: 1, padding: '6px', fontSize: '12px', fontWeight: 500,
    border: 'none', borderRadius: '6px', cursor: 'pointer',
    background: 'transparent', color: 'var(--c-text-2)',
  },
  envBtnActive: {
    background: 'var(--c-surface)', color: 'var(--c-text)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  },
  primaryBtn: {
    width: '100%', padding: '11px', background: '#E8724A',
    color: '#fff', border: 'none', borderRadius: '10px',
    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
  dangerBtn: {
    padding: '11px 16px', background: 'rgba(239,68,68,0.08)',
    color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '10px', fontSize: '13px', fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  error: {
    fontSize: '12px', color: '#EF4444', marginTop: 0, marginBottom: '12px',
    padding: '8px 12px', background: 'rgba(239,68,68,0.06)',
    border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px',
  },
  successBadge: {
    display: 'inline-block', padding: '5px 12px', borderRadius: '100px',
    background: 'rgba(93,202,165,0.12)', color: '#5DCAA5',
    fontSize: '12px', fontWeight: 600, marginBottom: '12px',
  },
  syncInfo: {
    background: 'var(--c-bg)', border: '1px solid var(--c-border)',
    borderRadius: '10px', padding: '12px 14px', marginBottom: '14px',
  },
  accountRow: {
    width: '100%', padding: '10px 12px', borderRadius: '8px',
    cursor: 'pointer', textAlign: 'left',
    transition: 'border-color 0.15s, background 0.15s',
  },
  cardBtn: {
    width: '100%', padding: '9px', borderRadius: '8px',
    fontSize: '12px', fontWeight: 600, cursor: 'pointer',
    marginTop: 'auto',
  },
};

import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { sb } from '../../lib/supabase';

const DRAFT_KEY = 'te_trade_draft';

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d.riskPer && !d.notes && !d.pnl) return null;
    return d;
  } catch(e) { return null; }
}

function today() { return new Date().toISOString().slice(0, 10); }

const SETUPS = ['', 'Breakout', 'Pullback', 'Reversal', 'Range', 'Trend continuation', 'News play', 'Gap fill', 'VWAP', 'Support/Resistance', 'Other'];

export default function TradeEntry({ showToast }) {
  const { userId, trades, addTrade } = useApp();

  const [form, setForm] = useState({
    date: today(), symbol: '', direction: 'long', accounts: 1,
    riskPer: '', rewardPer: '', outcome: 'win', pnl: '', setup: '', notes: '',
  });
  const [pendingImage, setPendingImage]       = useState(null);
  const [previewSrc,   setPreviewSrc]         = useState(null);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [saving, setSaving]                   = useState(false);
  const [saveMsg, setSaveMsg]                 = useState('');
  const [isDragOver, setIsDragOver]           = useState(false);
  const [showDailyLoss, setShowDailyLoss]     = useState(false);
  const [dailyLossMsg, setDailyLossMsg]       = useState('');
  const fileRef = useRef(null);

  // Restore draft on mount
  useEffect(() => {
    const d = loadDraft();
    if (d) { setForm(f => ({ ...f, ...d })); setShowDraftBanner(true); }
  }, []);

  // Auto-save draft
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  }, [form]);

  // Check daily loss
  useEffect(() => {
    const limit = parseFloat(localStorage.getItem('te_daily_loss_limit') || '0');
    if (!limit) { setShowDailyLoss(false); return; }
    const iso = today();
    const todayPnl = trades.filter(t => t.date === iso).reduce((s, t) => s + t.pnl, 0);
    if (todayPnl <= -limit) {
      setShowDailyLoss(true);
      setDailyLossMsg(`Daily loss limit of $${limit.toLocaleString(undefined,{minimumFractionDigits:2})} reached. Today's P/L: $${todayPnl.toLocaleString(undefined,{minimumFractionDigits:2})}`);
    } else {
      setShowDailyLoss(false);
    }
  }, [trades]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const preview = (() => {
    const risk = parseFloat(form.riskPer) || 0;
    const reward = parseFloat(form.rewardPer) || 0;
    const accounts = parseInt(form.accounts) || 1;
    if (!risk && !reward) return null;
    const totalRisk = risk * accounts;
    const totalReward = reward * accounts;
    const rr = risk > 0 ? (reward / risk).toFixed(2) : 'â';
    return { totalRisk, totalReward, rr, accounts };
  })();

  const handleFile = useCallback((file) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 1200;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale; canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        setPendingImage(dataUrl); setPreviewSrc(dataUrl);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }, []);

  const save = async () => {
    const { date, symbol, direction, accounts, riskPer, rewardPer, outcome, setup, notes } = form;
    let pnl = parseFloat(form.pnl);
    if (!date || !symbol || parseFloat(riskPer) <= 0 || parseInt(accounts) < 1) {
      setSaveMsg('Need date, symbol, accounts, and risk');
      setTimeout(() => setSaveMsg(''), 3000);
      return;
    }
    const accounts_ = parseInt(accounts) || 1;
    const riskPer_   = parseFloat(riskPer) || 0;
    const rewardPer_ = parseFloat(rewardPer) || 0;
    const totalRisk  = riskPer_ * accounts_;
    const totalReward = rewardPer_ * accounts_;
    const manualPnl = String(form.pnl).trim();
    if (manualPnl === '' || isNaN(pnl)) {
      if (outcome === 'win') pnl = totalReward;
      else if (outcome === 'loss') pnl = -totalRisk;
      else pnl = 0;
    }
    setSaving(true); setSaveMsg('Savingâ¦');

    // Upload screenshot
    let imagePath = null;
    let imageUrl  = null;
    const tradeId = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    if (pendingImage && userId) {
      try {
        const res = await fetch(pendingImage);
        const blob = await res.blob();
        const filePath = `${userId}/${tradeId}.jpg`;
        const { error: upErr } = await sb.storage.from('trade-screenshots').upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });
        if (!upErr) {
          imagePath = filePath;
          const { data: signed } = await sb.storage.from('trade-screenshots').createSignedUrl(filePath, 3600);
          if (signed) imageUrl = signed.signedUrl;
        }
      } catch(e) { console.warn('Screenshot upload error:', e); }
    }

    const trade = {
      id: tradeId, date, symbol: symbol.trim().toUpperCase(), direction, accounts: accounts_,
      riskPer: riskPer_, rewardPer: rewardPer_, risk: totalRisk, reward: totalReward,
      outcome, pnl, setup, notes: notes.trim(), image: imagePath, imageUrl,
      _pendingImage: pendingImage && !imagePath ? pendingImage : null,
    };

    const result = await addTrade(trade);
    setSaving(false);
    if (!result.ok) { setSaveMsg('Save failed: ' + result.error); return; }
    showToast(imagePath ? 'Trade saved with screenshot' : result.offline ? 'Saved offline â syncs when back online' : 'Trade saved', result.offline ? 'warn' : 'success', result.offline ? 4000 : 3000);
    setSaveMsg('');
    // Reset form
    setForm(f => ({ ...f, riskPer: '', rewardPer: '', pnl: '', notes: '', setup: '', outcome: 'win' }));
    setPendingImage(null); setPreviewSrc(null);
    localStorage.removeItem(DRAFT_KEY);
    setShowDraftBanner(false);
  };

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setForm({ date: today(), symbol: '', direction: 'long', accounts: 1, riskPer: '', rewardPer: '', outcome: 'win', pnl: '', setup: '', notes: '' });
    setShowDraftBanner(false);
    setPendingImage(null); setPreviewSrc(null);
  };

  return (
    <div className="jm-view">
      <div className="jm-greeting">
        <p className="jm-hello">Ready to trade?</p>
        <h1 className="jm-page-title">Log a <span>Trade</span></h1>
      </div>

      {showDailyLoss && (
        <div className="daily-loss-banner">
          <span>â ï¸</span>
          <p>{dailyLossMsg}</p>
        </div>
      )}

      {showDraftBanner && (
        <div className="draft-banner">
          <span>ð Draft restored</span>
          <button onClick={clearDraft}>Discard draft</button>
        </div>
      )}

      {preview && (
        <div className="jm-preview">
          Across <strong>{preview.accounts} account{preview.accounts === 1 ? '' : 's'}</strong>:
          total risk <strong>${preview.totalRisk.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong> Â·
          total target <strong>${preview.totalReward.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong> Â·
          planned R:R <strong>{preview.rr}</strong>
        </div>
      )}

      <div className="jm-card">
        <h2 className="jm-card-title">Trade details</h2>

        <div className="jm-g2">
          <div className="jm-field">
            <label>Date</label>
            <input type="date" className="jm-in" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
          <div className="jm-field">
            <label>Symbol</label>
            <input type="text" className="jm-in" placeholder="NQ, ES, AAPLâ¦" value={form.symbol} onChange={e => set('symbol', e.target.value)} />
          </div>
        </div>

        <div className="jm-g3">
          <div className="jm-field">
            <label>Direction</label>
            <select className="jm-in" value={form.direction} onChange={e => set('direction', e.target.value)}>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </div>
          <div className="jm-field">
            <label>Accounts</label>
            <input type="number" className="jm-in" min="1" max="20" value={form.accounts} onChange={e => set('accounts', e.target.value)} />
          </div>
          <div className="jm-field">
            <label>Outcome</label>
            <select className="jm-in" value={form.outcome} onChange={e => set('outcome', e.target.value)}>
              <option value="win">Win</option>
              <option value="loss">Loss</option>
              <option value="breakeven">Breakeven</option>
            </select>
          </div>
        </div>

        <div className="jm-g3">
          <div className="jm-field">
            <label>Risk / account ($)</label>
            <input type="number" className="jm-in" placeholder="50" step="0.01" value={form.riskPer} onChange={e => set('riskPer', e.target.value)} />
          </div>
          <div className="jm-field">
            <label>Reward / account ($)</label>
            <input type="number" className="jm-in" placeholder="100" step="0.01" value={form.rewardPer} onChange={e => set('rewardPer', e.target.value)} />
          </div>
          <div className="jm-field">
            <label>Actual P/L ($)</label>
            <input type="number" className="jm-in" placeholder="auto" step="0.01" value={form.pnl} onChange={e => set('pnl', e.target.value)} />
          </div>
        </div>

        <div className="jm-field" style={{ marginBottom:'16px' }}>
          <label>Setup tag</label>
          <select className="jm-in" value={form.setup} onChange={e => set('setup', e.target.value)}>
            {SETUPS.map(s => <option key={s} value={s}>{s || 'â None â'}</option>)}
          </select>
        </div>

        <div className="jm-field" style={{ marginBottom:'16px' }}>
          <label>Notes</label>
          <textarea className="jm-in" placeholder="What was your thesis? Any lessons?" rows={3}
            value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>

        <div className="jm-field" style={{ marginBottom:'20px' }}>
          <label>Screenshot (optional)</label>
          <div
            className="jm-drop"
            style={isDragOver ? { borderColor:'#E8724A', background:'rgba(232,114,74,0.05)' } : {}}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={e => { e.preventDefault(); setIsDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
          >
            {previewSrc
              ? <img src={previewSrc} alt="preview" className="jm-thumb" style={{ maxWidth:'100%' }} />
              : <span>ð· Drop chart screenshot here, or click to browse</span>
            }
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }}
            onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <button className="jm-btn" disabled={saving} onClick={save}>
            {saving ? 'Savingâ¦' : 'Save trade'}
          </button>
          {saveMsg && (
            <span className="jm-save-msg" style={{ color: saveMsg.startsWith('Need') || saveMsg.startsWith('Save') ? '#E24B4A' : '#8B8882' }}>
              {saveMsg}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

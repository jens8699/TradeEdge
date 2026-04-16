import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { sb } from '../../lib/supabase';

export default function Settings({ user, profile, showToast }) {
  const { exportData, importData, isOnline, syncPending, doSync, offlineQueueCount } = useApp();
  const [name,        setName]        = useState((profile?.name) || user?.user_metadata?.name || '');
  const [nameMsg,     setNameMsg]     = useState('');
  const [pass,        setPass]        = useState('');
  const [passConfirm, setPassConfirm] = useState('');
  const [passMsg,     setPassMsg]     = useState('');
  const [claudeKey,   setClaudeKey]   = useState(localStorage.getItem('jens_claude_key') || '');
  const [claudeMsg,   setClaudeMsg]   = useState('');
  const [elKey,       setElKey]       = useState(localStorage.getItem('jens_el_key') || '');
  const [elMsg,       setElMsg]       = useState('');
  const [dailyLimit,  setDailyLimit]  = useState(localStorage.getItem('te_daily_loss_limit') || '');
  const [limitMsg,    setLimitMsg]    = useState('');
  const fileRef = useRef(null);

  // Show saved status on load
  useEffect(() => {
    if (claudeKey) setClaudeMsg('✓ Key saved');
    if (elKey)     setElMsg('✓ Key saved');
  }, []);

  const saveName = async () => {
    if (!name.trim()) { setNameMsg('Name cannot be empty.'); return; }
    const { error } = await sb.from('profiles').update({ name: name.trim() }).eq('id', user.id);
    if (error) { setNameMsg(error.message); return; }
    setNameMsg('✓ Name updated');
    setTimeout(() => setNameMsg(''), 3000);
    showToast('Display name updated', 'success');
  };

  const savePass = async () => {
    setPassMsg('');
    if (pass.length < 6) { setPassMsg('Min. 6 characters.'); return; }
    if (pass !== passConfirm) { setPassMsg('Passwords do not match.'); return; }
    const { error } = await sb.auth.updateUser({ password: pass });
    if (error) { setPassMsg(error.message); return; }
    setPassMsg('✓ Password updated');
    setPass(''); setPassConfirm('');
    setTimeout(() => setPassMsg(''), 3000);
    showToast('Password updated', 'success');
  };

  const saveClaudeKey = () => {
    if (!claudeKey.startsWith('sk-ant-')) { setClaudeMsg('Key should start with sk-ant-'); return; }
    localStorage.setItem('jens_claude_key', claudeKey);
    setClaudeMsg('✓ Key saved');
    showToast('Claude key saved', 'success');
  };

  const saveElKey = () => {
    if (!elKey.trim()) { setElMsg('Please enter a key.'); return; }
    localStorage.setItem('jens_el_key', elKey);
    setElMsg('✓ Key saved');
    showToast('ElevenLabs key saved', 'success');
  };

  const saveDailyLimit = () => {
    const v = parseFloat(dailyLimit);
    if (dailyLimit && (isNaN(v) || v <= 0)) { setLimitMsg('Enter a valid positive number.'); return; }
    localStorage.setItem('te_daily_loss_limit', dailyLimit);
    setLimitMsg('✓ Saved');
    setTimeout(() => setLimitMsg(''), 2500);
    showToast('Daily loss limit saved', 'success');
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await importData(file);
      showToast('Data imported', 'success');
    } catch(err) {
      showToast('Import failed: ' + err.message, 'error');
    }
    e.target.value = '';
  };

  return (
    <div className="jm-view">
      <div className="jm-greeting">
        <p className="jm-hello">Manage your account</p>
        <h1 className="jm-page-title">⚙ <span>Settings</span></h1>
      </div>

      {/* Profile */}
      <div className="set-section">
        <p className="set-section-title">Profile</p>
        <div className="set-row">
          <label>Display name</label>
          <input type="text" className="jm-in" value={name} onChange={e => setName(e.target.value)} />
          <p className="set-msg" style={{ color: nameMsg.startsWith('✓') ? '#5DCAA5' : '#F09595' }}>{nameMsg}</p>
        </div>
        <div className="set-row" style={{ marginBottom:0 }}>
          <label>Email</label>
          <input type="email" className="jm-in" value={user?.email || ''} disabled style={{ opacity:0.5 }} />
        </div>
        <button className="jm-btn" style={{ marginTop:'14px' }} onClick={saveName}>Save name</button>
      </div>

      {/* Password */}
      <div className="set-section">
        <p className="set-section-title">Change password</p>
        <div className="set-row">
          <label>New password</label>
          <input type="password" className="jm-in" placeholder="Min. 6 characters" value={pass} onChange={e => setPass(e.target.value)} />
        </div>
        <div className="set-row" style={{ marginBottom:0 }}>
          <label>Confirm password</label>
          <input type="password" className="jm-in" placeholder="Repeat password" value={passConfirm} onChange={e => setPassConfirm(e.target.value)} />
          <p className="set-msg" style={{ color: passMsg.startsWith('✓') ? '#5DCAA5' : '#F09595' }}>{passMsg}</p>
        </div>
        <button className="jm-btn" style={{ marginTop:'14px' }} onClick={savePass}>Update password</button>
      </div>

      {/* Claude API key */}
      <div className="set-section">
        <p className="set-section-title">Claude API Key</p>
        <p style={{ fontSize:'12px', color:'#6B6862', margin:'0 0 12px', lineHeight:1.6 }}>
          Required for Market Brief and AI Insights. Get your key at{' '}
          <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{ color:'#8B8882' }}>console.anthropic.com</a>.
        </p>
        <div className="set-row" style={{ marginBottom:0 }}>
          <label>API key (sk-ant-…)</label>
          <input type="password" className="jm-in" placeholder="sk-ant-api03-…" value={claudeKey} onChange={e => setClaudeKey(e.target.value)} />
          <p className="set-msg" style={{ color: claudeMsg.startsWith('✓') ? '#5DCAA5' : '#F09595' }}>{claudeMsg}</p>
        </div>
        <button className="jm-btn" style={{ marginTop:'14px' }} onClick={saveClaudeKey}>Save Claude key</button>
      </div>

      {/* ElevenLabs key */}
      <div className="set-section">
        <p className="set-section-title">ElevenLabs API Key</p>
        <p style={{ fontSize:'12px', color:'#6B6862', margin:'0 0 12px', lineHeight:1.6 }}>
          Optional — enables voice narration for Market Brief. Get your key at{' '}
          <a href="https://elevenlabs.io" target="_blank" rel="noreferrer" style={{ color:'#8B8882' }}>elevenlabs.io</a>.
        </p>
        <div className="set-row" style={{ marginBottom:0 }}>
          <label>API key</label>
          <input type="password" className="jm-in" placeholder="Paste your ElevenLabs key…" value={elKey} onChange={e => setElKey(e.target.value)} />
          <p className="set-msg" style={{ color: elMsg.startsWith('✓') ? '#5DCAA5' : '#F09595' }}>{elMsg}</p>
        </div>
        <button className="jm-btn" style={{ marginTop:'14px' }} onClick={saveElKey}>Save ElevenLabs key</button>
      </div>

      {/* Risk management */}
      <div className="set-section">
        <p className="set-section-title">Risk Management</p>
        <div className="set-row" style={{ marginBottom:0 }}>
          <label>Daily loss limit ($) — triggers a warning banner when reached</label>
          <input type="number" className="jm-in" placeholder="e.g. 200 (leave blank to disable)" step="0.01" value={dailyLimit} onChange={e => setDailyLimit(e.target.value)} />
          <p className="set-msg" style={{ color: limitMsg.startsWith('✓') ? '#5DCAA5' : '#F09595' }}>{limitMsg}</p>
        </div>
        <button className="jm-btn" style={{ marginTop:'14px' }} onClick={saveDailyLimit}>Save limit</button>
      </div>

      {/* Data */}
      <div className="set-section">
        <p className="set-section-title">Data</p>

        <div className="set-sync-row">
          <div className={`set-sync-indicator ${isOnline ? (syncPending ? 'pending' : 'online') : ''}`} />
          <span className="set-sync-text">
            {isOnline
              ? syncPending
                ? `Syncing ${offlineQueueCount} item${offlineQueueCount !== 1 ? 's' : ''}…`
                : 'All synced'
              : `Offline — ${offlineQueueCount || 0} item${offlineQueueCount !== 1 ? 's' : ''} queued`
            }
          </span>
          {isOnline && syncPending && (
            <button onClick={doSync} style={{ background:'transparent', border:'0.5px solid #2A2720', color:'#8B8882', padding:'4px 12px', borderRadius:'8px', fontSize:'11px', cursor:'pointer', fontFamily:'inherit' }}>
              Sync now
            </button>
          )}
        </div>

        <p style={{ fontSize:'12px', color:'#6B6862', margin:'0 0 14px', lineHeight:1.6 }}>
          Export a backup of all your trades and payouts as a JSON file. Import from a previous backup to restore data.
        </p>
        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
          <button className="jm-btn" onClick={exportData}>Export backup</button>
          <button className="btn-ghost" onClick={() => fileRef.current?.click()}>Import backup</button>
          <input ref={fileRef} type="file" accept=".json" style={{ display:'none' }} onChange={handleImport} />
        </div>
      </div>

      {/* Danger zone */}
      <div className="set-danger-zone">
        <p className="set-danger-title">Danger zone</p>
        <p className="set-danger-desc">Sign out of your account on this device.</p>
        <button style={{ background:'transparent', border:'0.5px solid rgba(226,75,74,0.4)', color:'#F09595', padding:'9px 20px', borderRadius:'12px', fontSize:'13px', fontWeight:500, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}
          onClick={() => sb.auth.signOut()}>
          Sign out
        </button>
      </div>
    </div>
  );
}

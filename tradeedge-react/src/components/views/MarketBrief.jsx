import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { computeStats } from '../../lib/utils';

const SESSIONS = [
  { id: 'sydney',   label: 'Sydney',   open: 21, close: 6  },
  { id: 'tokyo',    label: 'Tokyo',    open: 0,  close: 9  },
  { id: 'london',   label: 'London',   open: 7,  close: 16 },
  { id: 'newyork',  label: 'New York', open: 13, close: 21 },
];

function isActive(s) {
  const h = new Date().getUTCHours();
  return s.open < s.close ? (h >= s.open && h < s.close) : (h >= s.open || h < s.close);
}

function getClaudeKey() { return localStorage.getItem('jens_claude_key') || ''; }
function getElKey()     { return localStorage.getItem('jens_el_key') || ''; }

export default function MarketBrief({ showToast }) {
  const { trades } = useApp();
  const [clock, setClock] = useState('');
  const [sessions, setSessions] = useState(SESSIONS.map(s => ({ ...s, active: isActive(s) })));
  const [pasted, setPasted] = useState('');
  const [briefHtml, setBriefHtml] = useState('');
  const [generating, setGenerating] = useState(false);
  const [topics, setTopics] = useState([]);
  const [topicLoading, setTopicLoading] = useState(false);
  const [customQuestion, setCustomQuestion] = useState('');
  const [ttsMode, setTtsMode] = useState('el');
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [elVoices, setElVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(localStorage.getItem('jens_el_voice') || '');
  const [elKeyStatus, setElKeyStatus] = useState('');
  const rawBriefText = useRef('');
  const audioObj = useRef(null);

  // Clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const pad = n => String(n).padStart(2,'0');
      setClock(pad(now.getUTCHours()) + ':' + pad(now.getUTCMinutes()) + ':' + pad(now.getUTCSeconds()));
      setSessions(SESSIONS.map(s => ({ ...s, active: isActive(s) })));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ElevenLabs voices
  const loadElVoices = useCallback(async () => {
    const key = getElKey();
    if (!key) { setElKeyStatus(''); return; }
    setElKeyStatus('Loading…');
    try {
      const resp = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } });
      if (!resp.ok) throw new Error('API ' + resp.status);
      const data = await resp.json();
      const voices = (data.voices || []).map(v => ({ id: v.voice_id, name: v.name })).sort((a,b) => a.name.localeCompare(b.name));
      setElVoices(voices);
      setElKeyStatus('✓ ' + voices.length + ' voices');
      if (!selectedVoice && voices.length) setSelectedVoice(voices[0].id);
    } catch(e) {
      setElKeyStatus('✗ ' + e.message);
    }
  }, []);

  useEffect(() => { loadElVoices(); }, []);

  // Load topics
  const loadTopics = useCallback(async () => {
    const key = getClaudeKey();
    if (!key) return;
    setTopicLoading(true);
    const today = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
    const prompt = `Today is ${today}. You are a financial markets assistant for a day trader. Generate 4 brief, current market topics that a day trader might want to know about today. Cover: macro/Fed, one equity sector, one technical pattern or market structure observation, and one volatility/risk factor. For each topic return JSON with: "category" (10 chars max), "title" (6-10 words), "teaser" (20-30 words), "color" (one of: #E8724A, #5DCAA5, #85B7EB, #EFC97A). Return only a JSON array, no markdown.`;
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 800, messages: [{ role: 'user', content: prompt }] })
      });
      if (!resp.ok) throw new Error(resp.status);
      const data = await resp.json();
      const text = data.content?.[0]?.text || '';
      const match = text.match(/\[[\s\S]*\]/);
      if (match) setTopics(JSON.parse(match[0]));
    } catch(e) { console.warn('Topic load error:', e); }
    setTopicLoading(false);
  }, []);

  useEffect(() => { loadTopics(); }, []);

  const generateBrief = async (contextText) => {
    const key = getClaudeKey();
    if (!key) {
      setBriefHtml('<p style="color:#8B8882;font-size:13px;">Go to <strong>Settings</strong> to add your Claude API key.</p>');
      return;
    }
    setGenerating(true);
    const recentTrades = trades.slice(0, 10);
    const stats = computeStats(recentTrades);
    const tradeSummary = recentTrades.length ? `Recent trades: ${recentTrades.map(t => `${t.symbol} ${t.direction} (${t.outcome}, ${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)})`).join(', ')}. Win rate: ${stats.winRate.toFixed(0)}%, R:R: ${stats.rr.toFixed(2)}.` : 'No recent trades.';
    const today = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
    const prompt = `You are an expert trading coach and market analyst. Today is ${today}.

Market context provided by trader:
${contextText || '(No market data provided — give general pre-market guidance)'}

Trader's recent performance:
${tradeSummary}

Create a comprehensive pre-market brief with these sections:
1. **Market Sentiment** (3-4 sentences on overall market mood and key overnight developments)
2. **Key Levels to Watch** (specific price levels, support/resistance for major indices like SPY, QQQ, NQ, ES)
3. **Today's Catalysts** (economic data, earnings, events that could move markets)
4. **Suggested Playbook** (2-3 specific trade setups or strategies for today based on context)
5. **Risk Rating**: low/medium/high and one sentence why
6. **Focus Tip** (one personalized tip based on the trader's recent performance)

Be specific, concise, and actionable. Format with HTML — use <h3> for section titles, <p> for paragraphs, <ul><li> for lists, <strong> for key numbers/levels. Keep each section under 4 sentences.`;

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] })
      });
      if (!resp.ok) { const err = await resp.json(); throw new Error(err.error?.message || resp.status); }
      const data = await resp.json();
      const text = data.content?.[0]?.text || '';
      rawBriefText.current = text.replace(/<[^>]+>/g, '');
      // Parse risk rating
      const riskMatch = text.match(/risk\s*rating[:\s]*(low|medium|high)/i);
      const riskLevel = riskMatch ? riskMatch[1].toLowerCase() : null;
      let html = text;
      if (riskLevel) {
        const badge = `<div class="jm-risk-badge jm-risk-${riskLevel}"><span>${riskLevel === 'low' ? '🟢' : riskLevel === 'medium' ? '🟡' : '🔴'}</span> Risk: ${riskLevel.charAt(0).toUpperCase()+riskLevel.slice(1)}</div>`;
        html = badge + html;
      }
      setBriefHtml(html);
    } catch(e) {
      setBriefHtml(`<p style="color:#F09595;">Error: ${e.message}</p>`);
    }
    setGenerating(false);
  };

  const askQuestion = async () => {
    if (!customQuestion.trim()) return;
    const key = getClaudeKey();
    if (!key) { showToast('Add Claude API key in Settings', 'warn'); return; }
    setGenerating(true);
    const prompt = `You are a concise trading assistant. Answer this trader's question in 2-4 sentences: "${customQuestion}" Provide a clear, actionable answer formatted with HTML (<p>, <strong>, <ul><li>).`;
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 600, messages: [{ role: 'user', content: prompt }] })
      });
      const data = await resp.json();
      const text = data.content?.[0]?.text || '';
      rawBriefText.current = text.replace(/<[^>]+>/g,'');
      setBriefHtml(prev => prev + `<div class="jm-brief-section" style="margin-top:10px;"><h3 style="color:#85B7EB;">❓ ${customQuestion}</h3>${text}</div>`);
      setCustomQuestion('');
    } catch(e) { showToast('Error: ' + e.message, 'error'); }
    setGenerating(false);
  };

  const speakBrief = async () => {
    const text = rawBriefText.current;
    if (!text) return;
    if (ttsPlaying) {
      if (audioObj.current) { audioObj.current.pause(); audioObj.current = null; }
      window.speechSynthesis?.cancel();
      setTtsPlaying(false); return;
    }
    if (ttsMode === 'browser') {
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 0.95; utt.pitch = 1;
      utt.onend = () => setTtsPlaying(false);
      window.speechSynthesis.speak(utt);
      setTtsPlaying(true); return;
    }
    // ElevenLabs
    const key = getElKey();
    if (!key) { showToast('Add ElevenLabs key in Settings', 'warn'); return; }
    const voiceId = selectedVoice || (elVoices[0]?.id);
    if (!voiceId) { showToast('No voice selected', 'warn'); return; }
    setTtsPlaying(true);
    try {
      const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: { 'xi-api-key': key, 'content-type': 'application/json', 'accept': 'audio/mpeg' },
        body: JSON.stringify({ text: text.slice(0, 2500), model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } })
      });
      if (!resp.ok) throw new Error('ElevenLabs ' + resp.status);
      const blob = await resp.blob();
      const url  = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioObj.current = audio;
      audio.onended = () => { setTtsPlaying(false); URL.revokeObjectURL(url); };
      audio.play();
    } catch(e) { showToast('TTS error: ' + e.message, 'error'); setTtsPlaying(false); }
  };

  const hasKey = !!getClaudeKey();

  // Today's quick stats
  const todayTrades = trades.filter(t => t.date === new Date().toISOString().slice(0,10));
  const todayStats = computeStats(todayTrades);
  const localTime = new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });

  return (
    <div className="jm-view">
      <div className="jm-greeting">
        <p className="jm-hello">Before you trade</p>
        <h1 className="jm-page-title">Market <span>Brief</span></h1>
      </div>

      {/* Clock + sessions */}
      <div className="jm-clock-row">
        <span className="jm-clock">{clock}</span>
        <span className="jm-clock-tz">UTC</span>
        <span style={{ fontSize:'12px', color:'#6B6862', marginLeft:'8px' }}>({localTime} local)</span>
      </div>
      <div className="jm-session-bar">
        {sessions.map(s => (
          <div key={s.id} className={`jm-session-pill ${s.active ? 'active' : 'inactive'}`}>
            <div className="jm-session-dot" />
            {s.label}
          </div>
        ))}
      </div>

      {/* Today's trading snapshot */}
      {todayTrades.length > 0 && (
        <div style={{
          display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px', marginBottom:'16px',
        }}>
          {[
            { label: 'Trades', val: todayStats.count, color:'var(--c-text)' },
            { label: 'P&L', val: `${todayStats.totalPnl >= 0 ? '+' : ''}$${todayStats.totalPnl.toFixed(0)}`, color: todayStats.totalPnl >= 0 ? '#5DCAA5' : '#F09595' },
            { label: 'Win Rate', val: `${todayStats.winRate.toFixed(0)}%`, color:'var(--c-text)' },
            { label: 'W/L', val: `${todayStats.wins}/${todayStats.losses}`, color:'var(--c-text)' },
          ].map(s => (
            <div key={s.label} style={{ background:'var(--c-surface)', border:'1px solid var(--c-border)', borderRadius:'10px', padding:'8px 10px', textAlign:'center' }}>
              <p style={{ fontSize:'9px', color:'#6B6862', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 3px', fontWeight:600 }}>{s.label}</p>
              <p style={{ fontSize:'14px', fontWeight:800, color:s.color, margin:0, fontVariantNumeric:'tabular-nums' }}>{s.val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Today's topics */}
      <div style={{ marginBottom:'20px' }}>
        <div className="jm-brief-block-header">
          <span>Today's topics</span>
          <button className="jm-brief-refresh-btn" onClick={loadTopics}>↻ Refresh</button>
        </div>
        <div className="jm-topic-grid">
          {topicLoading && <p style={{ color:'#5F5C56', fontSize:'13px', gridColumn:'1/-1', display:'flex', alignItems:'center', gap:'10px' }}><span className="jm-spinner" />Loading topics…</p>}
          {!topicLoading && !hasKey && <p style={{ color:'#5F5C56', fontSize:'13px', gridColumn:'1/-1' }}>Go to Settings to add your Claude API key.</p>}
          {!topicLoading && hasKey && topics.length === 0 && <p style={{ color:'#5F5C56', fontSize:'13px', gridColumn:'1/-1' }}>No topics loaded yet. Click Refresh.</p>}
          {topics.map((t, i) => (
            <div key={i} className="jm-topic-card" onClick={() => generateBrief(t.title + ': ' + t.teaser)}>
              <div className="jm-topic-cat" style={{ color: t.color }}>{t.category}</div>
              <div className="jm-topic-title">{t.title}</div>
              <div className="jm-topic-teaser">{t.teaser}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Paste context */}
      <div className="jm-brief-paste">
        <span className="jm-brief-paste-label">Paste market context (optional)</span>
        <textarea className="jm-in" rows={4} placeholder="Paste in a headline, economic calendar, or market notes…" value={pasted} onChange={e => setPasted(e.target.value)} />
        <p className="jm-brief-paste-hint">Paste anything: pre-market movers, economic data, news headlines, price levels…</p>
      </div>

      {/* Generate button */}
      <div style={{ display:'flex', gap:'10px', marginBottom:'14px', flexWrap:'wrap' }}>
        <button className="jm-btn" disabled={generating} onClick={() => generateBrief(pasted)}>
          {generating ? <><span className="jm-spinner" style={{ marginRight:'6px' }} />Generating…</> : '✦ Generate Brief'}
        </button>
        {briefHtml && (
          <button onClick={speakBrief}
            style={{ background:'transparent', border:'0.5px solid #2A2720', color: ttsPlaying ? '#E8724A' : '#8B8882', padding:'11px 18px', borderRadius:'16px', fontSize:'13px', fontWeight:500, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}>
            {ttsPlaying ? '⏸ Stop' : '▶ Listen'}
          </button>
        )}
      </div>

      {/* TTS settings */}
      <div className="jm-tts-panel">
        <div className="jm-tts-modes">
          <button className={`jm-tts-mode-btn${ttsMode === 'el' ? ' on' : ''}`} onClick={() => setTtsMode('el')}>🎙 ElevenLabs</button>
          <button className={`jm-tts-mode-btn${ttsMode === 'browser' ? ' on' : ''}`} onClick={() => setTtsMode('browser')}>🔊 Browser</button>
        </div>
        {ttsMode === 'el' && (
          <div style={{ display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
            <select className="jm-in" style={{ flex:1, minWidth:'160px' }}
              value={selectedVoice}
              onChange={e => { setSelectedVoice(e.target.value); localStorage.setItem('jens_el_voice', e.target.value); }}>
              {elVoices.length === 0 && <option>— Add key in Settings first —</option>}
              {elVoices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            {elKeyStatus && <span style={{ fontSize:'11px', color:'#6B6862' }}>{elKeyStatus}</span>}
          </div>
        )}
        <p className="jm-tts-note">
          {ttsMode === 'el' ? 'Uses your ElevenLabs API key from Settings.' : 'Uses your browser\'s built-in text-to-speech engine (free, no key needed).'}
        </p>
      </div>

      {/* Custom question */}
      <div className="jm-brief-ask-row">
        <input type="text" className="jm-in" placeholder="Ask anything: 'What's the ATR on NQ today?'…"
          value={customQuestion} onChange={e => setCustomQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && askQuestion()} />
        <button className="jm-btn" disabled={generating || !customQuestion.trim()} onClick={askQuestion}>Ask</button>
      </div>

      {/* Brief result */}
      {briefHtml && (
        <div className="jm-brief-result" dangerouslySetInnerHTML={{ __html: briefHtml }} />
      )}

      {briefHtml && (
        <p className="jm-brief-disclaimer">
          AI-generated for informational purposes only. Not financial advice. Always do your own analysis before trading.
        </p>
      )}

      {/* News sources */}
      <div style={{ marginTop:'20px' }}>
        <div className="jm-brief-block-header">
          <span>News sources</span>
        </div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          {[['Reuters', 'https://reuters.com/finance'], ['Bloomberg', 'https://bloomberg.com/markets'], ['CNBC', 'https://cnbc.com/markets'], ['MarketWatch', 'https://marketwatch.com'], ['Benzinga', 'https://benzinga.com'], ['Investing.com', 'https://investing.com']].map(([label, url]) => (
            <a key={label} href={url} target="_blank" rel="noreferrer" className="jm-news-src-btn">{label}</a>
          ))}
        </div>
      </div>
    </div>
  );
}

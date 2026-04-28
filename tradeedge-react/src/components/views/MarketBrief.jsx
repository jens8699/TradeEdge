import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { computeStats } from '../../lib/utils';

const SESSIONS = [
  { id: 'sydney',  label: 'Sydney',   open: 21, close: 6  },
  { id: 'tokyo',   label: 'Tokyo',    open: 0,  close: 9  },
  { id: 'london',  label: 'London',   open: 7,  close: 16 },
  { id: 'newyork', label: 'New York', open: 13, close: 21 },
];

function isActive(s) {
  const h = new Date().getUTCHours();
  return s.open < s.close ? (h >= s.open && h < s.close) : (h >= s.open || h < s.close);
}

function getClaudeKey() { return localStorage.getItem('jens_claude_key') || ''; }
function getElKey()     { return localStorage.getItem('jens_el_key')     || ''; }

// ── Layout helpers ────────────────────────────────────────────────────────────

function HR() {
  return <div style={{ height: 1, background: 'var(--c-border)', margin: '24px 0' }} />;
}

function SectionLabel({ children, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
        {children}
      </div>
      {action}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MarketBrief({ showToast }) {
  const { trades } = useApp();
  const [clock, setClock]           = useState('');
  const [sessions, setSessions]     = useState(SESSIONS.map(s => ({ ...s, active: isActive(s) })));
  const [pasted, setPasted]         = useState('');
  const [briefHtml, setBriefHtml]   = useState('');
  const [generating, setGenerating] = useState(false);
  const [topics, setTopics]         = useState([]);
  const [topicLoading, setTopicLoading] = useState(false);
  const [customQuestion, setCustomQuestion] = useState('');
  const [ttsMode, setTtsMode]       = useState('el');
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [elVoices, setElVoices]     = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(localStorage.getItem('jens_el_voice') || '');
  const [elKeyStatus, setElKeyStatus] = useState('');
  const rawBriefText = useRef('');
  const audioObj     = useRef(null);

  // Clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
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
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const prompt = `Today is ${today}. You are a financial markets assistant for a day trader. Generate 4 brief, current market topics that a day trader might want to know about today. Cover: macro/Fed, one equity sector, one technical pattern or market structure observation, and one volatility/risk factor. For each topic return JSON with: "category" (10 chars max), "title" (6-10 words), "teaser" (20-30 words), "color" (one of: #E07A3B, #A89687, #EFC97A). Return only a JSON array, no markdown.`;
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
      setBriefHtml('<p style="color:var(--c-text-2);font-size:13px;">Go to <strong>Settings</strong> to add your Claude API key.</p>');
      return;
    }
    setGenerating(true);
    const recentTrades = trades.slice(0, 10);
    const stats = computeStats(recentTrades);
    const tradeSummary = recentTrades.length
      ? `Recent trades: ${recentTrades.map(t => `${t.symbol} ${t.direction} (${t.outcome}, ${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)})`).join(', ')}. Win rate: ${stats.winRate.toFixed(0)}%, R:R: ${stats.rr.toFixed(2)}.`
      : 'No recent trades.';
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
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
        const riskColor = riskLevel === 'low' ? '#4ade80' : riskLevel === 'medium' ? '#EFC97A' : '#C65A45';
        const badge = `<div style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;border:1px solid ${riskColor}44;background:${riskColor}12;margin-bottom:14px;">
          <span>${riskLevel === 'low' ? '🟢' : riskLevel === 'medium' ? '🟡' : '🔴'}</span>
          <span style="font-size:11px;font-weight:700;color:${riskColor};letter-spacing:0.08em;text-transform:uppercase;">Risk: ${riskLevel}</span>
        </div>`;
        html = badge + html;
      }
      setBriefHtml(html);
    } catch(e) {
      setBriefHtml(`<p style="color:#C65A45;">Error: ${e.message}</p>`);
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
      rawBriefText.current = text.replace(/<[^>]+>/g, '');
      setBriefHtml(prev => prev + `<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--c-border)"><h3 style="font-size:13px;color:var(--c-text-2);margin:0 0 8px;">❓ ${customQuestion}</h3>${text}</div>`);
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
      const blob  = await resp.blob();
      const url   = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioObj.current = audio;
      audio.onended = () => { setTtsPlaying(false); URL.revokeObjectURL(url); };
      audio.play();
    } catch(e) { showToast('TTS error: ' + e.message, 'error'); setTtsPlaying(false); }
  };

  const hasKey = !!getClaudeKey();
  const todayTrades = trades.filter(t => t.date === new Date().toISOString().slice(0, 10));
  const todayStats  = computeStats(todayTrades);
  const localTime   = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    background: 'transparent', border: '1px solid var(--c-border)', borderRadius: 8,
    padding: '9px 12px', fontSize: 13, color: 'var(--c-text)',
    fontFamily: "'Inter', sans-serif", outline: 'none',
  };

  return (
    <div style={{ padding: '36px 44px', maxWidth: 760, paddingBottom: 64 }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>
          Before you trade
        </div>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 34, letterSpacing: '-0.03em', color: 'var(--c-text)', lineHeight: 1.1 }}>
          Market <em style={{ color: 'var(--c-accent)', fontStyle: 'italic' }}>Brief</em>
        </div>
      </div>

      {/* Clock + sessions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 700, color: 'var(--c-text)', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {clock}
        </div>
        <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.1em', fontFamily: "'JetBrains Mono', monospace" }}>UTC</div>
        <div style={{ fontSize: 11, color: 'var(--c-text-2)', opacity: 0.6 }}>({localTime} local)</div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {sessions.map(s => (
          <div
            key={s.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 20,
              border: `1px solid ${s.active ? 'rgba(224,122,59,0.4)' : 'var(--c-border)'}`,
              background: s.active ? 'rgba(224,122,59,0.08)' : 'transparent',
            }}
          >
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              background: s.active ? 'var(--c-accent)' : 'var(--c-text-2)',
              boxShadow: s.active ? '0 0 5px var(--c-accent)' : 'none',
            }} />
            <span style={{ fontSize: 12, fontWeight: s.active ? 600 : 400, color: s.active ? 'var(--c-accent)' : 'var(--c-text-2)' }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Today's snapshot */}
      {todayTrades.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Trades',   val: todayStats.count,                                                                                  color: 'var(--c-text)' },
            { label: 'P&L',      val: `${todayStats.totalPnl >= 0 ? '+' : ''}$${todayStats.totalPnl.toFixed(0)}`,                       color: todayStats.totalPnl >= 0 ? 'var(--c-accent)' : '#C65A45' },
            { label: 'Win Rate', val: `${todayStats.winRate.toFixed(0)}%`,                                                              color: 'var(--c-text)' },
            { label: 'W / L',    val: `${todayStats.wins} / ${todayStats.losses}`,                                                      color: 'var(--c-text)' },
          ].map(s => (
            <div key={s.label} style={{ border: '1px solid var(--c-border)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: s.color, fontFamily: "'Inter', sans-serif" }}>{s.val}</div>
            </div>
          ))}
        </div>
      )}

      <HR />

      {/* Today's topics */}
      <SectionLabel
        action={
          <button
            onClick={loadTopics}
            style={{ fontSize: 11, color: 'var(--c-text-2)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: "'Inter', sans-serif", letterSpacing: '0.04em' }}
          >
            ↻ Refresh
          </button>
        }
      >
        Today's topics
      </SectionLabel>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 24 }}>
        {topicLoading && (
          <div style={{ gridColumn: '1/-1', fontSize: 13, color: 'var(--c-text-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid var(--c-accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            Loading topics…
          </div>
        )}
        {!topicLoading && !hasKey && (
          <div style={{ gridColumn: '1/-1', fontSize: 13, color: 'var(--c-text-2)' }}>Go to Settings to add your Claude API key.</div>
        )}
        {!topicLoading && hasKey && topics.length === 0 && (
          <div style={{ gridColumn: '1/-1', fontSize: 13, color: 'var(--c-text-2)' }}>No topics loaded. Click Refresh.</div>
        )}
        {topics.map((t, i) => (
          <button
            key={i}
            onClick={() => generateBrief(t.title + ': ' + t.teaser)}
            style={{
              textAlign: 'left', padding: '14px 16px', borderRadius: 12,
              border: '1px solid var(--c-border)', background: 'transparent',
              cursor: 'pointer', transition: 'border-color 0.15s', fontFamily: "'Inter', sans-serif",
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(224,122,59,0.4)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--c-border)'}
          >
            <div style={{ fontSize: 10, color: t.color || 'var(--c-accent)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 5 }}>{t.category}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)', marginBottom: 5, lineHeight: 1.3 }}>{t.title}</div>
            <div style={{ fontSize: 12, color: 'var(--c-text-2)', lineHeight: 1.5 }}>{t.teaser}</div>
          </button>
        ))}
      </div>

      <HR />

      {/* Paste context */}
      <SectionLabel>Paste market context</SectionLabel>
      <textarea
        style={{ ...inputStyle, resize: 'vertical', minHeight: 90, marginBottom: 6, lineHeight: 1.6 }}
        rows={4}
        placeholder="Paste in a headline, economic calendar, or market notes…"
        value={pasted}
        onChange={e => setPasted(e.target.value)}
      />
      <div style={{ fontSize: 12, color: 'var(--c-text-2)', marginBottom: 16, opacity: 0.7 }}>
        Paste anything: pre-market movers, economic data, news headlines, price levels…
      </div>

      {/* Generate + Listen */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          disabled={generating}
          onClick={() => generateBrief(pasted)}
          style={{
            padding: '10px 22px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'rgba(224,122,59,0.1)', border: '1px solid rgba(224,122,59,0.35)',
            color: 'var(--c-accent)', cursor: generating ? 'default' : 'pointer',
            opacity: generating ? 0.6 : 1, fontFamily: "'Inter', sans-serif",
            display: 'flex', alignItems: 'center', gap: 7,
          }}
        >
          {generating
            ? <><span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid var(--c-accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Generating…</>
            : '✦ Generate Brief'
          }
        </button>
        {briefHtml && (
          <button
            onClick={speakBrief}
            style={{
              padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: 'transparent', border: '1px solid var(--c-border)',
              color: ttsPlaying ? 'var(--c-accent)' : 'var(--c-text-2)',
              cursor: 'pointer', fontFamily: "'Inter', sans-serif", transition: 'all 0.15s',
            }}
          >
            {ttsPlaying ? '⏸ Stop' : '▶ Listen'}
          </button>
        )}
      </div>

      {/* TTS settings */}
      <div style={{ marginBottom: 20, padding: '14px 16px', border: '1px solid var(--c-border)', borderRadius: 12 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {[['el', '🎙 ElevenLabs'], ['browser', '🔊 Browser']].map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setTtsMode(mode)}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                background: ttsMode === mode ? 'var(--c-accent)' : 'transparent',
                border: ttsMode === mode ? '1px solid var(--c-accent)' : '1px solid var(--c-border)',
                color: ttsMode === mode ? '#17150F' : 'var(--c-text-2)',
                cursor: 'pointer', fontFamily: "'Inter', sans-serif", transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {ttsMode === 'el' && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
            <select
              value={selectedVoice}
              onChange={e => { setSelectedVoice(e.target.value); localStorage.setItem('jens_el_voice', e.target.value); }}
              style={{
                flex: 1, minWidth: 160, background: 'transparent', border: '1px solid var(--c-border)',
                borderRadius: 8, padding: '7px 10px', fontSize: 12, color: 'var(--c-text)',
                fontFamily: "'Inter', sans-serif", outline: 'none',
              }}
            >
              {elVoices.length === 0 && <option>— Add key in Settings first —</option>}
              {elVoices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            {elKeyStatus && <span style={{ fontSize: 11, color: 'var(--c-text-2)' }}>{elKeyStatus}</span>}
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--c-text-2)', opacity: 0.7 }}>
          {ttsMode === 'el' ? 'Uses your ElevenLabs API key from Settings.' : 'Uses your browser\'s built-in text-to-speech engine (free, no key needed).'}
        </div>
      </div>

      {/* Custom question */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          type="text"
          style={{ ...inputStyle, flex: 1 }}
          placeholder="Ask anything: 'What's the ATR on NQ today?'…"
          value={customQuestion}
          onChange={e => setCustomQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && askQuestion()}
        />
        <button
          disabled={generating || !customQuestion.trim()}
          onClick={askQuestion}
          style={{
            padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'rgba(224,122,59,0.1)', border: '1px solid rgba(224,122,59,0.35)',
            color: 'var(--c-accent)', cursor: (generating || !customQuestion.trim()) ? 'default' : 'pointer',
            opacity: (generating || !customQuestion.trim()) ? 0.5 : 1,
            fontFamily: "'Inter', sans-serif", flexShrink: 0, transition: 'opacity 0.15s',
          }}
        >
          Ask
        </button>
      </div>

      {/* Brief result */}
      {briefHtml && (
        <>
          <div
            style={{
              fontSize: 13, color: 'var(--c-text)', lineHeight: 1.7,
              border: '1px solid var(--c-border)', borderRadius: 14, padding: '20px 22px',
              marginBottom: 12,
            }}
            dangerouslySetInnerHTML={{ __html: briefHtml }}
          />
          <div style={{ fontSize: 11, color: 'var(--c-text-2)', opacity: 0.6, marginBottom: 28, lineHeight: 1.5 }}>
            AI-generated for informational purposes only. Not financial advice. Always do your own analysis before trading.
          </div>
        </>
      )}

      <HR />

      {/* News sources */}
      <SectionLabel>News sources</SectionLabel>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          ['Reuters',      'https://reuters.com/finance'],
          ['Bloomberg',    'https://bloomberg.com/markets'],
          ['CNBC',         'https://cnbc.com/markets'],
          ['MarketWatch',  'https://marketwatch.com'],
          ['Benzinga',     'https://benzinga.com'],
          ['Investing.com','https://investing.com'],
        ].map(([label, url]) => (
          <a
            key={label}
            href={url}
            target="_blank"
            rel="noreferrer"
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              border: '1px solid var(--c-border)', color: 'var(--c-text-2)',
              textDecoration: 'none', transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(224,122,59,0.4)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--c-border)'}
          >
            {label}
          </a>
        ))}
      </div>
    </div>
  );
}

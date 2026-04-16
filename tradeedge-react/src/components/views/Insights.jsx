import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { computeStats, filterPeriod, fmt } from '../../lib/utils';

function getClaudeKey() { return localStorage.getItem('jens_claude_key') || ''; }

export default function Insights({ showToast }) {
  const { trades } = useApp();
  const [period, setPeriod]     = useState('all');
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState('');
  const [openIdx, setOpenIdx]   = useState(null);

  const list = filterPeriod(trades, period);
  const s    = computeStats(list);
  const hasKey = !!getClaudeKey();

  const analyze = async () => {
    const key = getClaudeKey();
    if (!key) { showToast('Add Claude API key in Settings first', 'warn'); return; }
    setLoading(true); setResult('');
    const wins   = list.filter(t => t.pnl > 0);
    const losses = list.filter(t => t.pnl < 0);
    const bySetup = {};
    list.filter(t => t.setup).forEach(t => {
      if (!bySetup[t.setup]) bySetup[t.setup] = { pnl: 0, count: 0, wins: 0 };
      bySetup[t.setup].pnl   += t.pnl;
      bySetup[t.setup].count += 1;
      bySetup[t.setup].wins  += t.pnl > 0 ? 1 : 0;
    });
    const setupBreakdown = Object.entries(bySetup).map(([k,v]) => `${k}: ${v.count} trades, ${(v.wins/v.count*100).toFixed(0)}% WR, ${fmt(v.pnl)}`).join('; ');
    const recentNotes = list.slice(0, 20).filter(t => t.notes).map(t => t.notes).join('\n');

    const prompt = `You are an expert trading coach analyzing the performance of a day trader. Here's their data:

Period: ${period === 'all' ? 'All time' : period === 'day' ? 'Today' : period === 'week' ? 'This week' : 'This month'}
Total trades: ${s.count}
Win rate: ${s.winRate.toFixed(1)}%
Avg win: ${fmt(s.avgWin)} | Avg loss: ${fmt(-s.avgLoss)}
Realized R:R: ${s.rr.toFixed(2)}
Profit factor: ${isFinite(s.pf) ? s.pf.toFixed(2) : '∞'}
Best trade: ${fmt(s.best)} | Worst trade: ${fmt(s.worst)}
Net P/L: ${fmt(s.totalPnl)}
${setupBreakdown ? 'By setup: ' + setupBreakdown : ''}
${recentNotes ? 'Recent trade notes:\n' + recentNotes : ''}

Provide a detailed analysis with these sections:
1. **Performance Summary** — what the numbers actually tell us
2. **Strengths** — what this trader is doing well, cite specific numbers
3. **Improvement Areas** — top 2-3 specific things to fix, with actionable advice
4. **Setup Analysis** — which setups are working vs not (if data available)
5. **Psychological Patterns** — any behavioral patterns you notice from the notes
6. **Action Plan** — 3 specific, concrete steps for the next trading week

Format with HTML: <h3> for section titles, <p> for text, <ul><li> for lists, <strong> for key metrics. Be direct, honest, and specific.`;

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2500, messages: [{ role: 'user', content: prompt }] })
      });
      if (!resp.ok) { const err = await resp.json(); throw new Error(err.error?.message || resp.status); }
      const data = await resp.json();
      setResult(data.content?.[0]?.text || '');
    } catch(e) {
      showToast('Analysis error: ' + e.message, 'error');
    }
    setLoading(false);
  };

  const FAQ = [
    { icon: '📊', title: 'What is a good win rate?',   badge: 'Stats', badgeColor: 'rgba(133,183,235,0.15)', badgeText: '#85B7EB',
      body: '<p>Most professional traders operate with a <strong>40-60% win rate</strong>. What matters more is your <strong>Profit Factor</strong> (target >1.5) and <strong>R:R ratio</strong> (target >1.5:1). A 40% win rate with 2:1 R:R is more profitable than a 70% win rate with 0.5:1 R:R.</p>' },
    { icon: '📉', title: 'How to handle losing streaks?', badge: 'Psychology', badgeColor: 'rgba(232,114,74,0.15)', badgeText: '#E8724A',
      body: '<p>During a losing streak: <ul><li>Reduce position size by 50%</li><li>Step back and review your last 10 trades</li><li>Check if you\'re deviating from your rules</li><li>Take a 1-day break if you have 3+ consecutive losses</li><li>Never revenge trade — it compounds losses</li></ul></p>' },
    { icon: '💰', title: 'What is Risk-to-Reward ratio?', badge: 'Basics', badgeColor: 'rgba(93,202,165,0.15)', badgeText: '#5DCAA5',
      body: '<p>R:R compares your potential profit vs. potential loss. A <strong>2:1 R:R</strong> means you risk $100 to make $200. Higher R:R means you need a lower win rate to be profitable. Formula: <strong>Reward ÷ Risk</strong>. Aim for at least 1.5:1.</p>' },
    { icon: '⚡', title: 'How to build consistency?',    badge: 'Mindset', badgeColor: 'rgba(239,201,122,0.15)', badgeText: '#EFC97A',
      body: '<p>Consistency comes from: <ul><li>Trading the <strong>same 1-3 setups</strong> until mastered</li><li>Always using a <strong>stop loss</strong></li><li>Journaling every trade with a reason</li><li>Reviewing weekly — what worked, what didn\'t</li><li>Never risking more than <strong>1-2% per trade</strong></li></ul></p>' },
  ];

  return (
    <div className="jm-view">
      <div className="jm-greeting">
        <p className="jm-hello">Understand your edge</p>
        <h1 className="jm-page-title">AI <span>Insights</span></h1>
      </div>

      {/* Key status */}
      {!hasKey ? (
        <div style={{ background:'rgba(232,114,74,0.08)', border:'0.5px solid rgba(232,114,74,0.25)', borderRadius:'14px', padding:'14px 18px', marginBottom:'14px', fontSize:'13px', color:'#F5C4B3' }}>
          Go to <strong>Settings</strong> to add your Claude API key to use AI Insights.
        </div>
      ) : (
        <div style={{ background:'rgba(93,202,165,0.07)', border:'0.5px solid rgba(93,202,165,0.25)', borderRadius:'14px', padding:'10px 16px', marginBottom:'14px', fontSize:'12px', color:'#5DCAA5' }}>
          ✓ Claude key is saved
        </div>
      )}

      {/* Stats summary chips */}
      {list.length > 0 && (
        <div className="jm-insight-meta">
          <div className="jm-insight-chip"><strong>{s.count}</strong> trades</div>
          <div className="jm-insight-chip"><strong>{s.winRate.toFixed(0)}%</strong> win rate</div>
          <div className="jm-insight-chip"><strong>{fmt(s.totalPnl)}</strong> net P/L</div>
          <div className="jm-insight-chip"><strong>{s.rr.toFixed(2)}</strong> R:R</div>
        </div>
      )}

      {/* Analyze bar */}
      <div className="jm-analyze-bar">
        <div className="jm-seg" style={{ marginBottom:0 }}>
          {['day','week','month','all'].map(p => (
            <button key={p} className={period === p ? 'on' : ''} onClick={() => setPeriod(p)}>
              {p === 'day' ? 'Today' : p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'All'}
            </button>
          ))}
        </div>
        <button className="jm-btn" disabled={loading || !hasKey || list.length === 0} onClick={analyze}>
          {loading ? <><span className="jm-spinner" style={{ marginRight:'6px' }} />Analyzing…</> : '◇ Analyze'}
        </button>
      </div>

      {list.length === 0 && (
        <div className="jm-insight-empty">
          <div className="jm-insight-empty-icon">◇</div>
          No trades in this period to analyze.
        </div>
      )}

      {result && (
        <div className="jm-insight-result" dangerouslySetInnerHTML={{ __html: result }} />
      )}

      {/* FAQ accordion */}
      <h2 className="jm-card-title" style={{ marginTop:'24px', marginBottom:'12px' }}>Trading Knowledge Base</h2>
      <div>
        {FAQ.map((item, i) => (
          <div key={i} className={`jm-acc-item${openIdx === i ? ' open' : ''}`}>
            <div className="jm-acc-header" onClick={() => setOpenIdx(openIdx === i ? null : i)}>
              <div className="jm-acc-left">
                <span className="jm-acc-icon">{item.icon}</span>
                <span className="jm-acc-title">{item.title}</span>
              </div>
              <div className="jm-acc-right">
                <span className="jm-acc-badge" style={{ background: item.badgeColor, color: item.badgeText }}>{item.badge}</span>
                <span className="jm-acc-chevron">▼</span>
              </div>
            </div>
            {openIdx === i && (
              <div className="jm-acc-body" dangerouslySetInnerHTML={{ __html: item.body }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

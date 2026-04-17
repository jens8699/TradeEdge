import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { computeStats, filterPeriod, fmt } from '../../lib/utils';

// ── Pattern Engine ────────────────────────────────────────────────────────────

function computePatterns(trades) {
  if (!trades.length) return [];
  const patterns = [];

  // ── Day of week ──
  const byDay = {};
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  trades.forEach(t => {
    if (!t.date) return;
    const d = new Date(t.date + 'T12:00:00').getDay();
    if (!byDay[d]) byDay[d] = { pnl: 0, count: 0, wins: 0 };
    byDay[d].pnl += t.pnl;
    byDay[d].count++;
    if (t.pnl > 0) byDay[d].wins++;
  });
  const dayEntries = Object.entries(byDay).filter(([,v]) => v.count >= 3);
  if (dayEntries.length > 0) {
    const best  = dayEntries.reduce((a,b) => a[1].pnl > b[1].pnl ? a : b);
    const worst = dayEntries.reduce((a,b) => a[1].pnl < b[1].pnl ? a : b);
    if (best[1].pnl > 0) patterns.push({
      type: 'strength', icon: '📅',
      title: `${dayNames[best[0]]} is your best day`,
      body: `You average ${fmt(best[1].pnl / best[1].count)} per trade on ${dayNames[best[0]]}s with a ${(best[1].wins/best[1].count*100).toFixed(0)}% win rate across ${best[1].count} trades.`,
      value: fmt(best[1].pnl / best[1].count), label: 'avg/trade',
    });
    if (worst[1].pnl < 0 && parseInt(worst[0]) !== parseInt(best[0])) patterns.push({
      type: 'warning', icon: '⚠️',
      title: `${dayNames[worst[0]]}s are hurting you`,
      body: `You lose an average of ${fmt(Math.abs(worst[1].pnl / worst[1].count))} per trade on ${dayNames[worst[0]]}s. Consider reducing size or skipping ${dayNames[worst[0]]}s entirely.`,
      value: fmt(worst[1].pnl / worst[1].count), label: 'avg/trade',
    });
  }

  // ── Symbol breakdown ──
  const bySym = {};
  trades.forEach(t => {
    if (!t.symbol) return;
    if (!bySym[t.symbol]) bySym[t.symbol] = { pnl: 0, count: 0, wins: 0 };
    bySym[t.symbol].pnl += t.pnl;
    bySym[t.symbol].count++;
    if (t.pnl > 0) bySym[t.symbol].wins++;
  });
  const symEntries = Object.entries(bySym).filter(([,v]) => v.count >= 3);
  if (symEntries.length >= 2) {
    const best  = symEntries.reduce((a,b) => (a[1].wins/a[1].count) > (b[1].wins/b[1].count) ? a : b);
    const worst = symEntries.reduce((a,b) => (a[1].wins/a[1].count) < (b[1].wins/b[1].count) ? a : b);
    patterns.push({
      type: 'strength', icon: '🎯',
      title: `${best[0]} is your best instrument`,
      body: `${best[0]} gives you a ${(best[1].wins/best[1].count*100).toFixed(0)}% win rate with ${fmt(best[1].pnl)} total P&L across ${best[1].count} trades.`,
      value: `${(best[1].wins/best[1].count*100).toFixed(0)}%`, label: 'win rate',
    });
    if (worst[0] !== best[0] && worst[1].pnl < 0) patterns.push({
      type: 'warning', icon: '📉',
      title: `${worst[0]} is dragging your P&L`,
      body: `Your ${worst[0]} trades have a ${(worst[1].wins/worst[1].count*100).toFixed(0)}% win rate and ${fmt(worst[1].pnl)} total. Consider if this setup is worth keeping.`,
      value: `${(worst[1].wins/worst[1].count*100).toFixed(0)}%`, label: 'win rate',
    });
  }

  // ── Win/loss size comparison ──
  const wins   = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl < 0);
  if (wins.length >= 3 && losses.length >= 3) {
    const avgWin  = wins.reduce((s,t) => s + t.pnl, 0) / wins.length;
    const avgLoss = Math.abs(losses.reduce((s,t) => s + t.pnl, 0) / losses.length);
    const rr = avgWin / avgLoss;
    if (rr >= 1.5) patterns.push({
      type: 'strength', icon: '💰',
      title: 'Strong reward-to-risk ratio',
      body: `Your average win (${fmt(avgWin)}) is ${rr.toFixed(1)}x your average loss (${fmt(avgLoss)}). This means you stay profitable even if your win rate dips.`,
      value: `${rr.toFixed(1)}:1`, label: 'R:R',
    });
    if (rr < 1) patterns.push({
      type: 'warning', icon: '⚖️',
      title: 'Losses are bigger than wins',
      body: `Your average loss (${fmt(avgLoss)}) is larger than your average win (${fmt(avgWin)}). You need a win rate above ${(avgLoss/(avgWin+avgLoss)*100).toFixed(0)}% just to break even. Cut losses sooner.`,
      value: `${rr.toFixed(2)}:1`, label: 'R:R',
    });
  }

  // ── Streak analysis ──
  if (trades.length >= 5) {
    const sorted = [...trades].sort((a,b) => new Date(a.date) - new Date(b.date));
    let maxWin = 0, maxLoss = 0, curWin = 0, curLoss = 0;
    sorted.forEach(t => {
      if (t.pnl > 0) { curWin++; curLoss = 0; maxWin = Math.max(maxWin, curWin); }
      else if (t.pnl < 0) { curLoss++; curWin = 0; maxLoss = Math.max(maxLoss, curLoss); }
      else { curWin = 0; curLoss = 0; }
    });
    if (maxLoss >= 4) patterns.push({
      type: 'warning', icon: '🔴',
      title: `Max losing streak: ${maxLoss} in a row`,
      body: `Your longest losing streak was ${maxLoss} consecutive losses. Consider a rule to stop trading or halve your size after 3 consecutive losses.`,
      value: maxLoss, label: 'max losses',
    });
    if (maxWin >= 4) patterns.push({
      type: 'info', icon: '🔥',
      title: `Best winning streak: ${maxWin} in a row`,
      body: `You hit ${maxWin} consecutive wins at your peak. Track what you were doing differently during hot streaks and replicate those conditions.`,
      value: maxWin, label: 'max wins',
    });
  }

  // ── Overtrading detector ──
  const byDate = {};
  trades.forEach(t => {
    if (!t.date) return;
    if (!byDate[t.date]) byDate[t.date] = { count: 0, pnl: 0 };
    byDate[t.date].count++;
    byDate[t.date].pnl += t.pnl;
  });
  const heavyDays = Object.entries(byDate).filter(([,v]) => v.count >= 8 && v.pnl < 0);
  if (heavyDays.length >= 2) patterns.push({
    type: 'warning', icon: '🚨',
    title: 'Overtrading detected',
    body: `You've had ${heavyDays.length} days with 8+ trades that ended negative. Heavy trading days correlate with losses. Try capping yourself at 5 trades per day.`,
    value: heavyDays.length, label: 'heavy loss days',
  });

  // ── Consistency score ──
  const profDays = Object.values(byDate).filter(d => d.pnl > 0).length;
  const totalDays = Object.values(byDate).length;
  if (totalDays >= 5) {
    const consistency = profDays / totalDays;
    if (consistency >= 0.65) patterns.push({
      type: 'strength', icon: '📊',
      title: `${(consistency*100).toFixed(0)}% of your trading days are profitable`,
      body: `You're profitable ${profDays} out of ${totalDays} trading days. This is above average consistency — most traders are profitable less than 60% of days.`,
      value: `${(consistency*100).toFixed(0)}%`, label: 'profitable days',
    });
  }

  // ── Direction bias ──
  const longs  = trades.filter(t => t.direction === 'Long' || t.direction === 'long');
  const shorts = trades.filter(t => t.direction === 'Short' || t.direction === 'short');
  if (longs.length >= 5 && shorts.length >= 5) {
    const longWR  = longs.filter(t => t.pnl > 0).length / longs.length;
    const shortWR = shorts.filter(t => t.pnl > 0).length / shorts.length;
    const diff = Math.abs(longWR - shortWR);
    if (diff > 0.2) {
      const better = longWR > shortWR ? 'Long' : 'Short';
      const betterWR = Math.max(longWR, shortWR);
      patterns.push({
        type: 'info', icon: '↕️',
        title: `You trade ${better}s significantly better`,
        body: `Your ${better} trades have a ${(betterWR*100).toFixed(0)}% win rate vs ${((Math.min(longWR,shortWR))*100).toFixed(0)}% for ${better === 'Long' ? 'Short' : 'Long'}s. Consider focusing on your stronger direction.`,
        value: `${(betterWR*100).toFixed(0)}%`, label: `${better} WR`,
      });
    }
  }

  // ── Session analysis ──
  const bySess = {};
  trades.forEach(t => {
    if (!t.session) return;
    if (!bySess[t.session]) bySess[t.session] = { pnl: 0, count: 0, wins: 0 };
    bySess[t.session].pnl += t.pnl;
    bySess[t.session].count++;
    if (t.pnl > 0) bySess[t.session].wins++;
  });
  const sessEntries = Object.entries(bySess).filter(([,v]) => v.count >= 3);
  if (sessEntries.length >= 2) {
    const best  = sessEntries.reduce((a,b) => a[1].pnl > b[1].pnl ? a : b);
    const worst = sessEntries.reduce((a,b) => a[1].pnl < b[1].pnl ? a : b);
    if (best[1].pnl > 0) patterns.push({
      type: 'strength', icon: '🌍',
      title: `${best[0]} session is your strongest`,
      body: `You average ${fmt(best[1].pnl / best[1].count)} per trade in the ${best[0]} session with a ${(best[1].wins/best[1].count*100).toFixed(0)}% win rate across ${best[1].count} trades.`,
      value: fmt(best[1].pnl / best[1].count), label: 'avg/trade',
    });
    if (worst[1].pnl < 0 && worst[0] !== best[0]) patterns.push({
      type: 'warning', icon: '⏰',
      title: `${worst[0]} session is costing you`,
      body: `Your ${worst[0]} trades average ${fmt(worst[1].pnl / worst[1].count)} per trade. Consider sitting out this session or trading smaller size.`,
      value: fmt(worst[1].pnl / worst[1].count), label: 'avg/trade',
    });
  }

  // ── Rating analysis ──
  const byRating = {};
  trades.forEach(t => {
    if (!t.rating) return;
    if (!byRating[t.rating]) byRating[t.rating] = { pnl: 0, count: 0, wins: 0 };
    byRating[t.rating].pnl += t.pnl;
    byRating[t.rating].count++;
    if (t.pnl > 0) byRating[t.rating].wins++;
  });
  const ratingEntries = Object.entries(byRating).filter(([,v]) => v.count >= 2);
  if (ratingEntries.length >= 2) {
    const aR = byRating['A'], dR = byRating['D'];
    if (aR && dR && aR.count >= 2 && dR.count >= 2) {
      const aWR = (aR.wins / aR.count * 100).toFixed(0);
      const dWR = (dR.wins / dR.count * 100).toFixed(0);
      patterns.push({
        type: 'info', icon: '⭐',
        title: `A-trades: ${aWR}% WR vs D-trades: ${dWR}% WR`,
        body: `Your best-execution (A) trades win ${aWR}% of the time averaging ${fmt(aR.pnl / aR.count)}. Poor execution (D) trades win only ${dWR}% averaging ${fmt(dR.pnl / dR.count)}. Discipline directly impacts results.`,
        value: aWR + '%', label: 'A-trade WR',
      });
    }
    const cdPnl   = (byRating['C']?.pnl || 0) + (byRating['D']?.pnl || 0);
    const cdCount = (byRating['C']?.count || 0) + (byRating['D']?.count || 0);
    if (cdPnl < 0 && cdCount >= 3) patterns.push({
      type: 'warning', icon: '📋',
      title: 'C/D rated trades are dragging your P&L',
      body: `Your ${cdCount} C and D rated trades have lost ${fmt(Math.abs(cdPnl))} combined. Focus on only taking setups you'd rate A or B before entering — your execution quality matters.`,
      value: fmt(cdPnl), label: 'C/D total P&L',
    });
  }

  return patterns;
}

function computeScore(stats, trades) {
  if (!trades.length) return 0;
  let score = 50;
  // Win rate (max ±15)
  if (stats.winRate >= 60) score += 15;
  else if (stats.winRate >= 50) score += 8;
  else if (stats.winRate < 35) score -= 15;
  else if (stats.winRate < 45) score -= 8;
  // R:R (max ±15)
  if (stats.rr >= 2) score += 15;
  else if (stats.rr >= 1.5) score += 8;
  else if (stats.rr < 0.8) score -= 15;
  else if (stats.rr < 1) score -= 8;
  // Profit factor (max ±10)
  if (stats.pf >= 2) score += 10;
  else if (stats.pf >= 1.5) score += 5;
  else if (stats.pf < 1) score -= 10;
  // Consistency (max ±10)
  const byDate = {};
  trades.forEach(t => { if (t.date) { byDate[t.date] = (byDate[t.date] || 0) + t.pnl; } });
  const days = Object.values(byDate);
  const profDaysPct = days.length ? days.filter(p => p > 0).length / days.length : 0;
  if (profDaysPct >= 0.65) score += 10;
  else if (profDaysPct < 0.4) score -= 10;

  return Math.min(100, Math.max(0, Math.round(score)));
}

function scoreLabel(score) {
  if (score >= 80) return { label: 'Elite', color: '#F4A460' };
  if (score >= 65) return { label: 'Strong', color: '#5DCAA5' };
  if (score >= 50) return { label: 'Developing', color: '#EFC97A' };
  if (score >= 35) return { label: 'Struggling', color: '#E8724A' };
  return { label: 'Critical', color: '#EF4444' };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreRing({ score }) {
  const { label, color } = scoreLabel(score);
  const r = 42, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <svg width="110" height="110" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="55" cy="55" r={r} fill="none" stroke="var(--c-border)" strokeWidth="8" />
        <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div style={{ textAlign: 'center', marginTop: '-80px', marginBottom: '34px' }}>
        <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--c-text)', lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: '11px', color, fontWeight: 600, marginTop: '2px' }}>{label}</div>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Trading Score</div>
    </div>
  );
}

function PatternCard({ pattern }) {
  const colors = {
    strength: { bg: 'rgba(93,202,165,0.06)', border: 'rgba(93,202,165,0.2)', badge: '#5DCAA5', badgeBg: 'rgba(93,202,165,0.1)' },
    warning:  { bg: 'rgba(232,114,74,0.06)', border: 'rgba(232,114,74,0.2)',  badge: '#E8724A', badgeBg: 'rgba(232,114,74,0.1)'  },
    info:     { bg: 'rgba(78,154,241,0.06)',  border: 'rgba(78,154,241,0.2)',  badge: '#4E9AF1', badgeBg: 'rgba(78,154,241,0.1)'  },
  };
  const c = colors[pattern.type] || colors.info;
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: '14px', padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>{pattern.icon}</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--c-text)' }}>{pattern.title}</span>
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: c.badge }}>{pattern.value}</div>
          <div style={{ fontSize: '10px', color: 'var(--c-text-2)', textTransform: 'uppercase' }}>{pattern.label}</div>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: '12px', color: 'var(--c-text-2)', lineHeight: 1.6 }}>{pattern.body}</p>
    </div>
  );
}

function StatBar({ label, value, max, color, fmt: fmtFn }) {
  const pct = max > 0 ? Math.min(1, Math.abs(value) / max) * 100 : 0;
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '12px', color: 'var(--c-text-2)' }}>{label}</span>
        <span style={{ fontSize: '12px', fontWeight: 600, color }}>{fmtFn ? fmtFn(value) : value}</span>
      </div>
      <div style={{ height: '4px', background: 'var(--c-border)', borderRadius: '2px' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px', transition: 'width 0.8s ease' }} />
      </div>
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

function getClaudeKey() { return localStorage.getItem('jens_claude_key') || ''; }

export default function Insights({ showToast }) {
  const { trades } = useApp();
  const [period, setPeriod]   = useState('all');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult]   = useState('');
  const [openFaq, setOpenFaq]   = useState(null);

  const list    = filterPeriod(trades, period);
  const s       = computeStats(list);
  const score   = useMemo(() => computeScore(s, list), [list]);
  const patterns = useMemo(() => computePatterns(list), [list]);
  const hasKey   = !!getClaudeKey();

  // ── Symbol breakdown for bars ──
  const bySym = useMemo(() => {
    const m = {};
    list.forEach(t => {
      if (!t.symbol) return;
      if (!m[t.symbol]) m[t.symbol] = { pnl: 0, count: 0, wins: 0 };
      m[t.symbol].pnl += t.pnl;
      m[t.symbol].count++;
      if (t.pnl > 0) m[t.symbol].wins++;
    });
    return Object.entries(m).sort((a,b) => b[1].pnl - a[1].pnl).slice(0, 5);
  }, [list]);

  const maxSymPnl = bySym.length ? Math.max(...bySym.map(([,v]) => Math.abs(v.pnl))) : 1;

  // ── Session bars ──
  const SESSION_COLORS_I = { Sydney: '#85B7EB', Tokyo: '#A78BFA', London: '#5DCAA5', 'New York': '#E8724A', Premarket: '#EFC97A', 'After Hours': '#8B8882' };
  const RATING_COLORS_I  = { A: '#5DCAA5', B: '#85B7EB', C: '#EFC97A', D: '#F09595' };
  const bySessArr = useMemo(() => {
    const m = {};
    list.forEach(t => {
      if (!t.session) return;
      if (!m[t.session]) m[t.session] = { pnl: 0, count: 0 };
      m[t.session].pnl += t.pnl; m[t.session].count++;
    });
    return Object.entries(m).sort((a,b) => b[1].pnl - a[1].pnl);
  }, [list]);
  const maxSessPnl = bySessArr.length ? Math.max(...bySessArr.map(([,v]) => Math.abs(v.pnl)), 1) : 1;

  // ── Rating bars ──
  const byRatingArr = useMemo(() => {
    const m = {};
    list.forEach(t => {
      if (!t.rating) return;
      if (!m[t.rating]) m[t.rating] = { pnl: 0, count: 0, wins: 0 };
      m[t.rating].pnl += t.pnl; m[t.rating].count++; if (t.pnl > 0) m[t.rating].wins++;
    });
    return ['A','B','C','D'].filter(r => m[r]).map(r => [r, m[r]]);
  }, [list]);
  const maxRatingPnl = byRatingArr.length ? Math.max(...byRatingArr.map(([,v]) => Math.abs(v.pnl)), 1) : 1;

  // ── Day of week bars ──
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const byDayArr = useMemo(() => {
    const m = {};
    list.forEach(t => {
      if (!t.date) return;
      const d = new Date(t.date + 'T12:00:00').getDay();
      if (!m[d]) m[d] = { pnl: 0, count: 0 };
      m[d].pnl += t.pnl;
      m[d].count++;
    });
    return [1,2,3,4,5].map(d => ({ day: dayNames[d], pnl: m[d]?.pnl || 0, count: m[d]?.count || 0 }));
  }, [list]);
  const maxDayPnl = byDayArr.length ? Math.max(...byDayArr.map(d => Math.abs(d.pnl)), 1) : 1;

  const analyze = async () => {
    const key = getClaudeKey();
    if (!key) { showToast('Add Claude API key in Settings first', 'warn'); return; }
    setAiLoading(true); setAiResult('');
    const wins = list.filter(t => t.pnl > 0);
    const losses = list.filter(t => t.pnl < 0);
    const recentNotes = list.slice(0, 20).filter(t => t.notes).map(t => t.notes).join('\n');
    const patternSummary = patterns.map(p => `${p.title}: ${p.body}`).join('\n');

    const sessionSummary = bySessArr.map(([s, v]) => `${s}: ${fmt(v.pnl)} (${v.count} trades)`).join(', ');
    const ratingSummary  = byRatingArr.map(([r, v]) => `${r}: ${fmt(v.pnl)}, ${v.count} trades, ${(v.wins/v.count*100).toFixed(0)}% WR`).join(' | ');
    const prompt = `You are an expert trading coach analyzing a day trader's performance data. Here's their complete data:

Period: ${period === 'all' ? 'All time' : period === 'day' ? 'Today' : period === 'week' ? 'This week' : 'This month'}
Total trades: ${s.count} | Win rate: ${s.winRate.toFixed(1)}%
Avg win: ${fmt(s.avgWin)} | Avg loss: ${fmt(Math.abs(s.avgLoss))} | R:R: ${s.rr.toFixed(2)}
Profit factor: ${isFinite(s.pf) ? s.pf.toFixed(2) : '∞'} | Net P/L: ${fmt(s.totalPnl)}
Trading score: ${score}/100
${sessionSummary ? 'Session performance: ' + sessionSummary : ''}
${ratingSummary  ? 'Trade rating breakdown: ' + ratingSummary : ''}
${patternSummary ? 'Detected patterns:\n' + patternSummary : ''}
${recentNotes ? 'Recent trade notes:\n' + recentNotes : ''}

Provide a deep coaching analysis:
1. <h3>Performance Summary</h3> — interpret the key metrics honestly
2. <h3>Top 3 Strengths</h3> — specific things to keep doing
3. <h3>Top 3 Improvement Areas</h3> — actionable fixes with specific advice
4. <h3>Psychological Insights</h3> — behavioral patterns from notes and data
5. <h3>This Week's Action Plan</h3> — 3 concrete, specific tasks

Format with HTML tags. Be direct, honest, specific. No generic advice.`;

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] })
      });
      if (!resp.ok) { const err = await resp.json(); throw new Error(err.error?.message || resp.status); }
      const data = await resp.json();
      setAiResult(data.content?.[0]?.text || '');
    } catch(e) {
      showToast('Analysis error: ' + e.message, 'error');
    }
    setAiLoading(false);
  };

  const FAQ = [
    { icon: '📊', title: 'What is a good win rate?', badge: 'Stats', badgeColor: 'rgba(133,183,235,0.15)', badgeText: '#85B7EB',
      body: '<p>Most professional traders operate with a <strong>40–60% win rate</strong>. What matters more is your <strong>Profit Factor</strong> (target >1.5) and <strong>R:R ratio</strong> (target >1.5:1). A 40% win rate with 2:1 R:R is more profitable than a 70% win rate with 0.5:1 R:R.</p>' },
    { icon: '📉', title: 'How to handle losing streaks?', badge: 'Psychology', badgeColor: 'rgba(232,114,74,0.15)', badgeText: '#E8724A',
      body: '<p>During a losing streak: <ul><li>Reduce position size by 50%</li><li>Step back and review your last 10 trades</li><li>Check if you\'re deviating from your rules</li><li>Take a 1-day break if you have 3+ consecutive losses</li><li>Never revenge trade — it compounds losses</li></ul></p>' },
    { icon: '💰', title: 'What is Risk-to-Reward ratio?', badge: 'Basics', badgeColor: 'rgba(93,202,165,0.15)', badgeText: '#5DCAA5',
      body: '<p>R:R compares your potential profit vs. potential loss. A <strong>2:1 R:R</strong> means you risk $100 to make $200. Higher R:R means you need a lower win rate to be profitable. Formula: <strong>Reward ÷ Risk</strong>. Aim for at least 1.5:1.</p>' },
    { icon: '⚡', title: 'How to build consistency?', badge: 'Mindset', badgeColor: 'rgba(239,201,122,0.15)', badgeText: '#EFC97A',
      body: '<p>Consistency comes from: <ul><li>Trading the <strong>same 1–3 setups</strong> until mastered</li><li>Always using a <strong>stop loss</strong></li><li>Journaling every trade with a reason</li><li>Reviewing weekly — what worked, what didn\'t</li><li>Never risking more than <strong>1–2% per trade</strong></li></ul></p>' },
  ];

  return (
    <div className="jm-view">
      <div className="jm-greeting">
        <p className="jm-hello">Understand your edge</p>
        <h1 className="jm-page-title">AI <span>Insights</span></h1>
      </div>

      {/* Period selector */}
      <div className="jm-seg" style={{ marginBottom: '20px' }}>
        {['day','week','month','all'].map(p => (
          <button key={p} className={period === p ? 'on' : ''} onClick={() => { setPeriod(p); setAiResult(''); }}>
            {p === 'day' ? 'Today' : p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'All time'}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="jm-insight-empty">
          <div className="jm-insight-empty-icon">◇</div>
          <p style={{ color: 'var(--c-text-2)', fontSize: '13px' }}>
            No trades in this period. Log trades or import from Connections to see insights.
          </p>
        </div>
      ) : (
        <>
          {/* ── Score + Key Stats ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '20px', marginBottom: '20px',
            background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '18px', padding: '20px' }}>
            <ScoreRing score={score} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', alignContent: 'center' }}>
              {[
                { label: 'Net P&L',        value: fmt(s.totalPnl),            color: s.totalPnl >= 0 ? '#5DCAA5' : '#E8724A' },
                { label: 'Win Rate',       value: `${s.winRate.toFixed(1)}%`, color: s.winRate >= 50 ? '#5DCAA5' : '#E8724A' },
                { label: 'Profit Factor',  value: isFinite(s.pf) ? s.pf.toFixed(2) : '∞, color: s.pf >= 1.5 ? '#5DCAA5' : s.pf >= 1 ? '#EFC97A' : '#E8724A' },
                { label: 'Avg Win',        value: fmt(s.avgWin),             color: '#5DCAA5' },
                { label: 'Avg Loss',       value: fmt(Math.abs(s.avgLoss)),  color: '#E8724A' },
                { label: 'R:R',            value: `${s.rr.toFixed(2)}:1`,    color: s.rr >= 1.5 ? '#5DCAA5' : s.rr >= 1 ? '#EFC97A' : '#E8724A' },
              ].map(stat => (
                <div key={stat.label} style={{ background: 'var(--c-bg)', borderRadius: '10px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: stat.color, marginBottom: '2px' }}>{stat.value}</div>
                  <div style={{ fontSize: '10px', color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Pattern Insights ── */}
          {patterns.length > 0 && (
            <>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Detected Patterns
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                {patterns.map((p, i) => <PatternCard key={i} pattern={p} />)}
              </div>
            </>
          )}

          {/* ── Breakdowns ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>

            {/* Symbol P&L */}
            {bySym.length > 0 && (
              <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '14px', padding: '16px' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '12px', fontWeight: 700, color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>P&amp;L by Instrument</h3>
                {bySym.map(([sym, v]) => (
                  <StatBar key={sym} label={sym} value={v.pnl} max={maxSymPnl}
                    color={v.pnl >= 0 ? '#5DCAA5' : '#E8724A'} fmt={fmt} />
                ))}
              </div>
            )}

            {/* Day of week */}
            <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '14px', padding: '16px' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: '12px', fontWeight: 700, color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>P&amp;L by Day</h3>
              {byDayArr.map(d => (
                <StatBar key={d.day} label={`${d.day}${d.count ? ` (${d.count})` : ''}`}
                  value={d.pnl} max={maxDayPnl}
                  color={d.pnl >= 0 ? '#5DCAA5' : '#E8724A'} fmt={fmt} />
              ))}
            </div>

            {/* Session P&L */}
            {bySessArr.length > 0 && (
              <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '14px', padding: '16px' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '12px', fontWeight: 700, color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>P&amp;L by Session</h3>
                {bySessArr.map(([sess, v]) => (
                  <StatBar key={sess} label={`${sess} (${v.count})`} value={v.pnl} max={maxSessPnl}
                    color={SESSION_COLORS_I[sess] || (v.pnl >= 0 ? '#5DCAA5' : '#E8724A')} fmt={fmt} />
                ))}
              </div>
            )}

            {/* Rating P&L */}
            {byRatingArr.length > 0 && (
              <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '14px', padding: '16px' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '12px', fontWeight: 700, color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>P&amp;L by Rating</h3>
                {byRatingArr.map(([r, v]) => (
                  <StatBar key={r} label={`${r}-rated (${v.count}t · ${v.count ? (v.wins/v.count*100).toFixed(0) : 0}% WR)`}
                    value={v.pnl} max={maxRatingPnl}
                    color={RATING_COLORS_I[r]} fmt={fmt} />
                ))}
              </div>
            )}
          </div>

          {/* ── AI Analysis ── */}
          <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '18px', padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--c-text)' }}>Deep AI Coaching</h3>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--c-text-2)' }}>
                  {hasKey ? 'Claude analyses your data and gives personalised coaching advice.' : 'Add a Claude API key in Settings to unlock deep analysis.'}
                </p>
              </div>
              <button className="jm-btn" disabled={aiLoading || !hasKey} onClick={analyze} style={{ flexShrink: 0 }}>
                {aiLoading ? '◌ Analysing…' : '◇ Analyse Now'}
              </button>
            </div>
            {!hasKey && (
              <div style={{ fontSize: '12px', color: 'var(--c-text-2)', background: 'var(--c-bg)', borderRadius: '8px', padding: '10px 12px' }}>
                Go to <strong style={{ color: 'var(--c-text)' }}>Settings → Claude API Key</strong> to enable this feature. Your key stays in your browser and is never sent to our servers.
              </div>
            )}
            {aiResult && (
              <div className="jm-insight-result" dangerouslySetInnerHTML={{ __html: aiResult }} />
            )}
          </div>
        </>
      )}

      {/* ── Knowledge Base ── */}
      <h2 className="jm-card-title" style={{ marginTop: '4px', marginBottom: '12px' }}>Trading Knowledge Base</h2>
      <div>
        {FAQ.map((item, i) => (
          <div key={i} className={`jm-acc-item${openFaq === i ? ' open' : ''}`}>
            <div className="jm-acc-header" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
              <div className="jm-acc-left">
                <span className="jm-acc-icon">{item.icon}</span>
                <span className="jm-acc-title">{item.title}</span>
              </div>
              <div className="jm-acc-right">
                <span className="jm-acc-badge" style={{ background: item.badgeColor, color: item.badgeText }}>{item.badge}</span>
                <span className="jm-acc-chevron">▼</span>
              </div>
            </div>
            {openFaq === i && (
              <div className="jm-acc-body" dangerouslySetInnerHTML={{ __html: item.body }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

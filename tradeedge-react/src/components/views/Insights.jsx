// AI Insights — pattern engine, emotion tracking, coaching advice
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

  // ── Emotion / mindset patterns ──
  const EMOTION_LABELS = { calm: 'Calm', confident: 'Confident', fomo: 'FOMO', anxious: 'Anxious', revenge: 'Revenge', overconfident: 'Overconfident', bored: 'Bored', focused: 'Focused' };
  const byEmotion = {};
  trades.forEach(t => {
    if (!t.emotion) return;
    if (!byEmotion[t.emotion]) byEmotion[t.emotion] = { pnl: 0, count: 0, wins: 0 };
    byEmotion[t.emotion].pnl += t.pnl;
    byEmotion[t.emotion].count++;
    if (t.pnl > 0) byEmotion[t.emotion].wins++;
  });
  const emotionEntries = Object.entries(byEmotion).filter(([,v]) => v.count >= 2);
  if (emotionEntries.length >= 2) {
    const bestEmo  = emotionEntries.reduce((a,b) => (a[1].wins/a[1].count) > (b[1].wins/b[1].count) ? a : b);
    const worstEmo = emotionEntries.reduce((a,b) => (a[1].wins/a[1].count) < (b[1].wins/b[1].count) ? a : b);
    const bestLabel  = EMOTION_LABELS[bestEmo[0]]  || bestEmo[0];
    const worstLabel = EMOTION_LABELS[worstEmo[0]] || worstEmo[0];
    if (bestEmo[1].pnl > 0) patterns.push({
      type: 'strength', icon: '🧘',
      title: `You trade best when ${bestLabel}`,
      body: `Your "${bestLabel}" trades have a ${(bestEmo[1].wins/bestEmo[1].count*100).toFixed(0)}% win rate and ${fmt(bestEmo[1].pnl)} total P&L across ${bestEmo[1].count} trades. This emotional state is your edge — find ways to replicate it consistently.`,
      value: `${(bestEmo[1].wins/bestEmo[1].count*100).toFixed(0)}%`, label: `${bestLabel} WR`,
    });
    if (worstEmo[0] !== bestEmo[0] && worstEmo[1].wins/worstEmo[1].count < 0.45) patterns.push({
      type: 'warning', icon: '⚠️',
      title: `${worstLabel} state hurts your trading`,
      body: `When feeling "${worstLabel}", your win rate drops to ${(worstEmo[1].wins/worstEmo[1].count*100).toFixed(0)}% with ${fmt(worstEmo[1].pnl)} total across ${worstEmo[1].count} trades. Step away from the screen in this state.`,
      value: `${(worstEmo[1].wins/worstEmo[1].count*100).toFixed(0)}%`, label: `${worstLabel} WR`,
    });
  }
  const revengeTrades = trades.filter(t => t.emotion === 'revenge');
  if (revengeTrades.length >= 2) {
    const revengeWins = revengeTrades.filter(t => t.pnl > 0).length;
    const revengePnl  = revengeTrades.reduce((s,t) => s + t.pnl, 0);
    patterns.push({
      type: 'warning', icon: '😤',
      title: `${revengeTrades.length} revenge trades logged — ${(revengeWins/revengeTrades.length*100).toFixed(0)}% WR`,
      body: `Your revenge trades show a ${(revengeWins/revengeTrades.length*100).toFixed(0)}% win rate and ${fmt(revengePnl)} total P&L. Set a rule: mandatory 30-minute break after any losing trade before re-entering.`,
      value: fmt(revengePnl), label: 'revenge P&L',
    });
  }

  // ── Bounce-back pattern ──
  const sortedDates = [...new Set(trades.map(t => t.date))].sort();
  if (sortedDates.length >= 6) {
    const dayPnl = {};
    trades.forEach(t => { dayPnl[t.date] = (dayPnl[t.date] || 0) + t.pnl; });
    let afterLossWins = 0, afterLossTotal = 0;
    for (let i = 1; i < sortedDates.length; i++) {
      if (dayPnl[sortedDates[i-1]] < 0) {
        const nextDayTrades = trades.filter(t => t.date === sortedDates[i]);
        afterLossTotal += nextDayTrades.length;
        afterLossWins  += nextDayTrades.filter(t => t.pnl > 0).length;
      }
    }
    if (afterLossTotal >= 5) {
      const afterLossWR = afterLossWins / afterLossTotal;
      const overallWR   = trades.filter(t => t.pnl > 0).length / trades.length;
      if (afterLossWR < overallWR - 0.1) patterns.push({
        type: 'warning', icon: '📉',
        title: 'Performance drops the day after a loss',
        body: `After losing days, your win rate falls to ${(afterLossWR*100).toFixed(0)}% vs your overall ${(overallWR*100).toFixed(0)}%. Stick strictly to your plan the morning after a red day — no revenge sizing.`,
        value: `${(afterLossWR*100).toFixed(0)}%`, label: 'post-loss WR',
      });
      if (afterLossWR > overallWR + 0.1) patterns.push({
        type: 'strength', icon: '💪',
        title: 'You bounce back well after losing days',
        body: `After losing days, your win rate rises to ${(afterLossWR*100).toFixed(0)}% vs your overall ${(overallWR*100).toFixed(0)}%. You show strong mental resilience — keep using this as confidence after tough sessions.`,
        value: `${(afterLossWR*100).toFixed(0)}%`, label: 'post-loss WR',
      });
    }
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
  if (stats.winRate >= 60) score += 15;
  else if (stats.winRate >= 50) score += 8;
  else if (stats.winRate < 35) score -= 15;
  else if (stats.winRate < 45) score -= 8;
  if (stats.rr >= 2) score += 15;
  else if (stats.rr >= 1.5) score += 8;
  else if (stats.rr < 0.8) score -= 15;
  else if (stats.rr < 1) score -= 8;
  if (stats.pf >= 2) score += 10;
  else if (stats.pf >= 1.5) score += 5;
  else if (stats.pf < 1) score -= 10;
  const byDate = {};
  trades.forEach(t => { if (t.date) { byDate[t.date] = (byDate[t.date] || 0) + t.pnl; } });
  const days = Object.values(byDate);
  const profDaysPct = days.length ? days.filter(p => p > 0).length / days.length : 0;
  if (profDaysPct >= 0.65) score += 10;
  else if (profDaysPct < 0.4) score -= 10;
  return Math.min(100, Math.max(0, Math.round(score)));
}

function scoreLabel(score) {
  if (score >= 80) return { label: 'Elite',      color: '#F4A460' };
  if (score >= 65) return { label: 'Strong',     color: '#E07A3B' };
  if (score >= 50) return { label: 'Developing', color: '#EFC97A' };
  if (score >= 35) return { label: 'Struggling', color: '#E07A3B' };
  return                   { label: 'Critical',  color: '#C65A45' };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreRing({ score }) {
  const { label, color } = scoreLabel(score);
  const r = 42, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: 110, height: 110 }}>
        <svg width="110" height="110" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="55" cy="55" r={r} fill="none" stroke="var(--c-border)" strokeWidth="8" />
          <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s ease' }} />
        </svg>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--c-text)', lineHeight: 1, fontFamily: "'Inter', sans-serif" }}>{score}</div>
          <div style={{ fontSize: 10, color, fontWeight: 700, marginTop: 2, letterSpacing: '0.06em' }}>{label}</div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Score</div>
    </div>
  );
}

function PatternCard({ pattern }) {
  const isStrength = pattern.type === 'strength';
  const isWarning  = pattern.type === 'warning';
  const accentColor = isStrength ? 'var(--c-accent)' : isWarning ? '#C65A45' : '#4E9AF1';
  return (
    <div style={{
      borderLeft: `2px solid ${accentColor}`,
      paddingLeft: 14,
      paddingTop: 2,
      paddingBottom: 2,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 14 }}>{pattern.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>{pattern.title}</span>
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right', paddingLeft: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: accentColor, fontFamily: "'Inter', sans-serif" }}>{pattern.value}</div>
          <div style={{ fontSize: 10, color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{pattern.label}</div>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--c-text-2)', lineHeight: 1.6 }}>{pattern.body}</p>
    </div>
  );
}

function StatBar({ label, value, max, color, fmt: fmtFn }) {
  const pct = max > 0 ? Math.min(1, Math.abs(value) / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--c-text-2)' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color, fontFamily: "'Inter', sans-serif" }}>{fmtFn ? fmtFn(value) : value}</span>
      </div>
      <div style={{ height: 3, background: 'var(--c-border)', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  );
}

// ── Layout helpers ────────────────────────────────────────────────────────────

function HR() {
  return <div style={{ height: 1, background: 'var(--c-border)', margin: '24px 0' }} />;
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 14 }}>
      {children}
    </div>
  );
}

function BreakdownCard({ title, children }) {
  return (
    <div style={{ border: '1px solid var(--c-border)', borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export default function Insights({ showToast }) {
  const { trades } = useApp();
  const [period, setPeriod]     = useState('all');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult]   = useState('');
  const [openFaq, setOpenFaq]     = useState(null);

  const list     = filterPeriod(trades, period);
  const s        = computeStats(list);
  const score    = useMemo(() => computeScore(s, list), [list]);
  const patterns = useMemo(() => computePatterns(list), [list]);

  // ── Symbol breakdown ──
  const bySym = useMemo(() => {
    const m = {};
    list.forEach(t => {
      if (!t.symbol) return;
      if (!m[t.symbol]) m[t.symbol] = { pnl: 0, count: 0, wins: 0 };
      m[t.symbol].pnl += t.pnl; m[t.symbol].count++; if (t.pnl > 0) m[t.symbol].wins++;
    });
    return Object.entries(m).sort((a,b) => b[1].pnl - a[1].pnl).slice(0, 5);
  }, [list]);
  const maxSymPnl = bySym.length ? Math.max(...bySym.map(([,v]) => Math.abs(v.pnl))) : 1;

  // ── Session bars ──
  const SESSION_COLORS_I = { Sydney: '#A89687', Tokyo: '#A78BFA', London: '#E07A3B', 'New York': '#E07A3B', Premarket: '#EFC97A', 'After Hours': '#8B8882' };
  const RATING_COLORS_I  = { A: '#E07A3B', B: '#A89687', C: '#EFC97A', D: '#C65A45' };
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

  // ── Emotion bars ──
  const EMOTION_ICONS   = { calm: '😌', confident: '💪', fomo: '😰', anxious: '😬', revenge: '😤', overconfident: '🤑', bored: '😑', focused: '🎯' };
  const EMOTION_COLORS  = { calm: '#E07A3B', confident: '#A89687', fomo: '#EFC97A', anxious: '#EFC97A', revenge: '#C65A45', overconfident: '#C65A45', bored: '#8B8882', focused: '#E07A3B' };
  const byEmotionArr = useMemo(() => {
    const m = {};
    list.forEach(t => {
      if (!t.emotion) return;
      if (!m[t.emotion]) m[t.emotion] = { pnl: 0, count: 0, wins: 0 };
      m[t.emotion].pnl += t.pnl; m[t.emotion].count++; if (t.pnl > 0) m[t.emotion].wins++;
    });
    return Object.entries(m).sort((a,b) => b[1].pnl - a[1].pnl);
  }, [list]);
  const maxEmotionPnl = byEmotionArr.length ? Math.max(...byEmotionArr.map(([,v]) => Math.abs(v.pnl)), 1) : 1;

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
      m[d].pnl += t.pnl; m[d].count++;
    });
    return [1,2,3,4,5].map(d => ({ day: dayNames[d], pnl: m[d]?.pnl || 0, count: m[d]?.count || 0 }));
  }, [list]);
  const maxDayPnl = byDayArr.length ? Math.max(...byDayArr.map(d => Math.abs(d.pnl)), 1) : 1;

  const analyze = async () => {
    setAiLoading(true); setAiResult('');
    const wins   = list.filter(t => t.pnl > 0);
    const losses = list.filter(t => t.pnl < 0);
    const recentNotes    = list.slice(0, 20).filter(t => t.notes).map(t => t.notes).join('\n');
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
      const resp = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] })
      });
      if (!resp.ok) {
        let errMsg = `HTTP ${resp.status}`;
        try { const err = await resp.json(); errMsg = err.error?.message || err.error || errMsg; } catch {}
        throw new Error(errMsg);
      }
      const data = await resp.json();
      setAiResult(data.content?.[0]?.text || '');
    } catch(e) {
      showToast('Analysis error: ' + e.message, 'error');
    }
    setAiLoading(false);
  };

  const FAQ = [
    { icon: '📊', title: 'What is a good win rate?', badge: 'Stats', badgeColor: '#A89687',
      body: '<p>Most professional traders operate with a <strong>40–60% win rate</strong>. What matters more is your <strong>Profit Factor</strong> (target >1.5) and <strong>R:R ratio</strong> (target >1.5:1). A 40% win rate with 2:1 R:R is more profitable than a 70% win rate with 0.5:1 R:R.</p>' },
    { icon: '📉', title: 'How to handle losing streaks?', badge: 'Psychology', badgeColor: '#E07A3B',
      body: '<p>During a losing streak: reduce position size by 50%, review your last 10 trades, check if you\'re deviating from your rules, take a 1-day break after 3+ consecutive losses, and never revenge trade — it compounds losses.</p>' },
    { icon: '💰', title: 'What is Risk-to-Reward ratio?', badge: 'Basics', badgeColor: '#E07A3B',
      body: '<p>R:R compares your potential profit vs. potential loss. A <strong>2:1 R:R</strong> means you risk $100 to make $200. Higher R:R means you need a lower win rate to be profitable. Formula: <strong>Reward ÷ Risk</strong>. Aim for at least 1.5:1.</p>' },
    { icon: '⚡', title: 'How to build consistency?', badge: 'Mindset', badgeColor: '#EFC97A',
      body: '<p>Consistency comes from: trading the <strong>same 1–3 setups</strong> until mastered, always using a <strong>stop loss</strong>, journaling every trade with a reason, reviewing weekly, and never risking more than <strong>1–2% per trade</strong>.</p>' },
  ];

  const PERIOD_LABELS = { day: 'Today', week: 'Week', month: 'Month', all: 'All' };

  return (
    <div style={{ padding: '36px 44px', maxWidth: 820, paddingBottom: 64 }}>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--c-text-2)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>
          AI Insights
        </div>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 34, letterSpacing: '-0.03em', color: 'var(--c-text)', lineHeight: 1.1 }}>
          Your edge<span style={{ color: 'var(--c-accent)' }}>.</span>
        </div>
      </div>

      {/* Period tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
        {['day','week','month','all'].map(p => (
          <button
            key={p}
            onClick={() => { setPeriod(p); setAiResult(''); }}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              background: period === p ? 'var(--c-accent)' : 'transparent',
              border: period === p ? '1px solid var(--c-accent)' : '1px solid var(--c-border)',
              color: period === p ? '#17150F' : 'var(--c-text-2)',
            }}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--c-text-2)' }}>
          <div style={{ fontSize: 32, marginBottom: 16, opacity: 0.3 }}>◇</div>
          <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            No trades in this period.<br />Log trades or import from Connections to see insights.
          </div>
        </div>
      ) : (
        <>
          {/* ── Score + Key Stats ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 24, marginBottom: 28, border: '1px solid var(--c-border)', borderRadius: 18, padding: '24px' }}>
            <ScoreRing score={score} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, alignContent: 'center' }}>
              {[
                { label: 'Net P&L',       value: fmt(s.totalPnl),                         color: s.totalPnl >= 0 ? 'var(--c-accent)' : '#C65A45' },
                { label: 'Win Rate',      value: `${s.winRate.toFixed(1)}%`,               color: s.winRate >= 50 ? 'var(--c-accent)' : '#C65A45' },
                { label: 'Profit Factor', value: isFinite(s.pf) ? s.pf.toFixed(2) : '∞',  color: s.pf >= 1.5 ? 'var(--c-accent)' : s.pf >= 1 ? '#EFC97A' : '#C65A45' },
                { label: 'Avg Win',       value: fmt(s.avgWin),                            color: 'var(--c-accent)' },
                { label: 'Avg Loss',      value: fmt(Math.abs(s.avgLoss)),                 color: '#C65A45' },
                { label: 'R:R',           value: `${s.rr.toFixed(2)}:1`,                   color: s.rr >= 1.5 ? 'var(--c-accent)' : s.rr >= 1 ? '#EFC97A' : '#C65A45' },
              ].map(stat => (
                <div key={stat.label}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: stat.color, fontFamily: "'Inter', sans-serif", marginBottom: 2 }}>{stat.value}</div>
                  <div style={{ fontSize: 10, color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <HR />

          {/* ── Pattern Insights ── */}
          {patterns.length > 0 && (
            <>
              <SectionLabel>Detected patterns</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 28 }}>
                {patterns.map((p, i) => <PatternCard key={i} pattern={p} />)}
              </div>
              <HR />
            </>
          )}

          {/* ── Breakdowns ── */}
          <SectionLabel>Breakdowns</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 28 }}>

            {bySym.length > 0 && (
              <BreakdownCard title="P&L by Instrument">
                {bySym.map(([sym, v]) => (
                  <StatBar key={sym} label={sym} value={v.pnl} max={maxSymPnl}
                    color={v.pnl >= 0 ? 'var(--c-accent)' : '#C65A45'} fmt={fmt} />
                ))}
              </BreakdownCard>
            )}

            <BreakdownCard title="P&L by Day">
              {byDayArr.map(d => (
                <StatBar key={d.day} label={`${d.day}${d.count ? ` (${d.count})` : ''}`}
                  value={d.pnl} max={maxDayPnl}
                  color={d.pnl >= 0 ? 'var(--c-accent)' : '#C65A45'} fmt={fmt} />
              ))}
            </BreakdownCard>

            {bySessArr.length > 0 && (
              <BreakdownCard title="P&L by Session">
                {bySessArr.map(([sess, v]) => (
                  <StatBar key={sess} label={`${sess} (${v.count})`} value={v.pnl} max={maxSessPnl}
                    color={SESSION_COLORS_I[sess] || (v.pnl >= 0 ? 'var(--c-accent)' : '#C65A45')} fmt={fmt} />
                ))}
              </BreakdownCard>
            )}

            {byRatingArr.length > 0 && (
              <BreakdownCard title="P&L by Rating">
                {byRatingArr.map(([r, v]) => (
                  <StatBar key={r} label={`${r}-rated (${v.count}t · ${v.count ? (v.wins/v.count*100).toFixed(0) : 0}% WR)`}
                    value={v.pnl} max={maxRatingPnl}
                    color={RATING_COLORS_I[r]} fmt={fmt} />
                ))}
              </BreakdownCard>
            )}

            {byEmotionArr.length > 0 && (
              <BreakdownCard title="P&L by Mindset">
                {byEmotionArr.map(([em, v]) => (
                  <StatBar
                    key={em}
                    label={`${EMOTION_ICONS[em] || ''} ${em.charAt(0).toUpperCase() + em.slice(1)} (${v.count}t · ${v.count ? (v.wins/v.count*100).toFixed(0) : 0}% WR)`}
                    value={v.pnl} max={maxEmotionPnl}
                    color={EMOTION_COLORS[em] || 'var(--c-accent)'} fmt={fmt} />
                ))}
              </BreakdownCard>
            )}
          </div>

          <HR />

          {/* ── AI Deep Coaching ── */}
          <SectionLabel>Deep AI coaching</SectionLabel>
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-text)', marginBottom: 4 }}>Claude analyses your data and gives personalised coaching advice.</div>
                <div style={{ fontSize: 12, color: 'var(--c-text-2)' }}>Requires a Claude API key in Settings.</div>
              </div>
              <button
                disabled={aiLoading}
                onClick={analyze}
                style={{
                  padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: 'rgba(224,122,59,0.1)', border: '1px solid rgba(224,122,59,0.35)',
                  color: 'var(--c-accent)', cursor: aiLoading ? 'default' : 'pointer',
                  opacity: aiLoading ? 0.6 : 1, fontFamily: "'Inter', sans-serif",
                  flexShrink: 0, marginLeft: 16,
                }}
              >
                {aiLoading ? '◌ Analysing…' : '◇ Analyse now'}
              </button>
            </div>
            {aiResult && (
              <div
                style={{
                  fontSize: 13, color: 'var(--c-text)', lineHeight: 1.7,
                  borderTop: '1px solid var(--c-border)', paddingTop: 18,
                }}
                dangerouslySetInnerHTML={{ __html: aiResult }}
              />
            )}
          </div>
        </>
      )}

      <HR />

      {/* ── Knowledge Base ── */}
      <SectionLabel>Trading knowledge base</SectionLabel>
      <div>
        {FAQ.map((item, i) => (
          <div key={i} style={{ borderBottom: '1px solid var(--c-border)' }}>
            <button
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 0', background: 'transparent', border: 'none', cursor: 'pointer',
                fontFamily: "'Inter', sans-serif', textAlign: 'left",
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>{item.title}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <span style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: item.badgeColor, background: `${item.badgeColor}18`,
                  padding: '3px 8px', borderRadius: 10,
                }}>
                  {item.badge}
                </span>
                <span style={{ fontSize: 11, color: 'var(--c-text-2)', transform: openFaq === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
              </div>
            </button>
            {openFaq === i && (
              <div
                style={{ fontSize: 13, color: 'var(--c-text-2)', lineHeight: 1.7, paddingBottom: 16 }}
                dangerouslySetInnerHTML={{ __html: item.body }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

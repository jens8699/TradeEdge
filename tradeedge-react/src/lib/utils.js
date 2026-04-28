// ── Number formatting ────────────────────────────────────────────────────────

export function fmt(n) {
  if (!isFinite(n)) return '∞';
  const s = n < 0 ? '-' : '';
  return s + '$' + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// R-multiple: returns e.g. "+2.50R", "-0.75R", or null if risk unknown
export function fmtR(pnl, risk) {
  if (!risk || risk <= 0 || !isFinite(pnl)) return null;
  const r = pnl / risk;
  const sign = r > 0 ? '+' : '';
  return `${sign}${r.toFixed(2)}R`;
}

// ── Period filtering ─────────────────────────────────────────────────────────

export function filterPeriod(trades, p) {
  const now = new Date();
  const iso  = now.toISOString().slice(0, 10);
  return trades.filter(t => {
    if (p === 'all') return true;
    if (p === 'day') return t.date === iso;
    const td = new Date(t.date);
    if (p === 'month') return td.getFullYear() === now.getFullYear() && td.getMonth() === now.getMonth();
    if (p === 'week') {
      const start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0, 0, 0, 0);
      const end   = new Date(start); end.setDate(start.getDate() + 7);
      return td >= start && td < end;
    }
    return true;
  });
}

// ── Stats computation ────────────────────────────────────────────────────────

export function computeStats(list) {
  const wins     = list.filter(t => t.pnl > 0);
  const losses   = list.filter(t => t.pnl < 0);
  const totalPnl = list.reduce((s, t) => s + t.pnl, 0);
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const winRate  = list.length ? wins.length / list.length * 100 : 0;
  const avgWin   = wins.length ? grossWin / wins.length : 0;
  const avgLoss  = losses.length ? grossLoss / losses.length : 0;
  const rr       = avgLoss > 0 ? avgWin / avgLoss : 0;
  const pf       = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : 0);
  const best     = list.length ? Math.max(...list.map(t => t.pnl)) : 0;
  const worst    = list.length ? Math.min(...list.map(t => t.pnl)) : 0;

  // R-multiple stats (only for trades that have risk logged)
  const winsWithR   = wins.filter(t => t.risk > 0);
  const lossesWithR = losses.filter(t => t.risk > 0);
  const avgRWin     = winsWithR.length   ? winsWithR.reduce((s, t) => s + t.pnl / t.risk, 0) / winsWithR.length     : null;
  const avgRLoss    = lossesWithR.length ? lossesWithR.reduce((s, t) => s + t.pnl / t.risk, 0) / lossesWithR.length : null;
  const expectancy  = avgRWin !== null && avgRLoss !== null
    ? (winRate / 100) * avgRWin + (1 - winRate / 100) * avgRLoss
    : null;

  return { count: list.length, wins: wins.length, losses: losses.length, totalPnl, winRate, avgWin, avgLoss, rr, pf, best, worst, avgRWin, avgRLoss, expectancy };
}

// ── Time-of-day greeting ─────────────────────────────────────────────────────

export function getGreeting(name) {
  const h = new Date().getHours();
  const firstName = (name || 'Trader').split(' ')[0].split('@')[0];
  const time = h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return { time, firstName, full: `${time}, ${firstName}` };
}

// ── Count-up animation ───────────────────────────────────────────────────────

export function animateCount(el, targetVal, duration = 700) {
  const start    = performance.now();
  const isNeg    = targetVal < 0;
  const absTarget = Math.abs(targetVal);
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3);
    const current  = absTarget * eased;
    el.textContent = (isNeg ? '-$' : '$') + current.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = (isNeg ? '-$' : '$') + absTarget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  requestAnimationFrame(step);
}

// ── Milestones ───────────────────────────────────────────────────────────────

export const MILESTONES = [
  { count: 10,  emoji: '🔟', label: '10 trades logged' },
  { count: 25,  emoji: '⭐', label: '25 trade milestone' },
  { count: 50,  emoji: '🔥', label: '50 trades — on fire' },
  { count: 100, emoji: '💯', label: '100 trades — pro level' },
  { count: 250, emoji: '🏆', label: '250 trade legend' },
];

export function getMilestone(count) {
  return [...MILESTONES].reverse().find(m => count >= m.count);
}

export function getStreak(trades) {
  if (!trades.length) return 0;
  const sorted = [...trades].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  let streak = 0;
  for (const t of sorted) {
    if (t.pnl > 0) streak++;
    else if (t.pnl < 0) break;
  }
  return streak;
}

// ── Unique ID ────────────────────────────────────────────────────────────────

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

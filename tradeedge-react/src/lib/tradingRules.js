// User-defined trading rules / personal commandments.
// Stored in localStorage for v1 — same pattern as checklistTags + tradeCritiques.
//
// Rule shape:
//   { id: string, type: RuleType, value: number, enabled: boolean }
//
// Rule types and what `value` means:
//   'daily_loss'  — stop trading after today's P&L <= -value (USD)
//   'daily_cap'   — max value trades per day
//   'max_risk'    — total risk per trade (risk × accounts) <= value (USD)
//   'min_rr'      — target/risk must be >= value (e.g. 1.5)

const STORAGE_KEY = 'te_trading_rules';

export const RULE_TYPES = [
  {
    type: 'daily_loss',
    label: 'Daily loss stop',
    desc: 'Stop trading once today\'s P&L hits a loss threshold.',
    valueLabel: 'Stop trading at',
    valuePrefix: '−$',
    valueDefault: 500,
    placeholder: 'e.g. 500',
  },
  {
    type: 'daily_cap',
    label: 'Daily trade cap',
    desc: 'Max number of trades you can log in one day.',
    valueLabel: 'Max trades / day',
    valuePrefix: '',
    valueDefault: 5,
    placeholder: 'e.g. 5',
  },
  {
    type: 'max_risk',
    label: 'Max risk per trade',
    desc: 'Total risk (risk × accounts) per trade must stay under this.',
    valueLabel: 'Max risk',
    valuePrefix: '$',
    valueDefault: 250,
    placeholder: 'e.g. 250',
  },
  {
    type: 'min_rr',
    label: 'Minimum R:R',
    desc: 'Reward must be at least this many times the risk.',
    valueLabel: 'Min R:R ratio',
    valuePrefix: '',
    valueDefault: 1.5,
    placeholder: 'e.g. 1.5',
  },
];

export function getRuleTypeMeta(type) {
  return RULE_TYPES.find(r => r.type === type) || null;
}

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(rules) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rules)); } catch {}
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function getRules() {
  return loadAll();
}

export function saveRule(rule) {
  const all = loadAll();
  if (rule.id) {
    const idx = all.findIndex(r => r.id === rule.id);
    if (idx >= 0) all[idx] = rule;
    else all.push(rule);
  } else {
    all.push({ ...rule, id: uid() });
  }
  saveAll(all);
  return all;
}

export function deleteRule(id) {
  const all = loadAll().filter(r => r.id !== id);
  saveAll(all);
  return all;
}

export function setRuleEnabled(id, enabled) {
  const all = loadAll().map(r => r.id === id ? { ...r, enabled } : r);
  saveAll(all);
  return all;
}

/**
 * Check enabled rules against the current trade context.
 *
 * ctx = {
 *   todayPnl:        number  (current day's P&L, before this trade)
 *   todayTradeCount: number  (trades already logged today, before this one)
 *   tradeRisk:       number  (proposed risk per account × accounts)
 *   tradeReward:     number  (proposed total target)
 * }
 *
 * Returns an array of { ruleId, type, message, severity: 'warn'|'block' }.
 */
export function checkAgainst(ctx) {
  const rules = loadAll().filter(r => r.enabled !== false);
  const violations = [];

  for (const r of rules) {
    if (r.type === 'daily_loss') {
      if (typeof ctx.todayPnl === 'number' && ctx.todayPnl <= -Math.abs(r.value)) {
        violations.push({
          ruleId: r.id, type: r.type,
          message: `Daily loss stop hit (you're at ${fmtMoney(ctx.todayPnl)} today, limit −$${r.value}). Take the rest of the day off.`,
          severity: 'block',
        });
      }
    } else if (r.type === 'daily_cap') {
      if (typeof ctx.todayTradeCount === 'number' && ctx.todayTradeCount >= r.value) {
        violations.push({
          ruleId: r.id, type: r.type,
          message: `Daily trade cap hit (${ctx.todayTradeCount} of ${r.value} max). Stop logging new trades.`,
          severity: 'block',
        });
      }
    } else if (r.type === 'max_risk') {
      if (typeof ctx.tradeRisk === 'number' && ctx.tradeRisk > r.value) {
        violations.push({
          ruleId: r.id, type: r.type,
          message: `Risk on this trade ($${ctx.tradeRisk.toFixed(0)}) exceeds your max ($${r.value}). Cut size.`,
          severity: 'warn',
        });
      }
    } else if (r.type === 'min_rr') {
      if (typeof ctx.tradeRisk === 'number' && ctx.tradeReward > 0 && ctx.tradeRisk > 0) {
        const rr = ctx.tradeReward / ctx.tradeRisk;
        if (rr < r.value) {
          violations.push({
            ruleId: r.id, type: r.type,
            message: `R:R is ${rr.toFixed(2)}, below your minimum of ${r.value}. Either widen target or pass.`,
            severity: 'warn',
          });
        }
      }
    }
  }

  return violations;
}

function fmtMoney(n) {
  if (n == null || isNaN(n)) return '$0';
  const abs = Math.abs(n);
  return (n < 0 ? '−$' : '$') + abs.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/**
 * Revenue Engine — Autonomous Income Tracker
 * Tracks $8,333/month goal across 3 streams. Fires Telegram alerts at milestones.
 * Rebalances targets mid-month if one stream is falling behind.
 * Zero npm dependencies.
 *
 * This runs inside Nuri every day at midnight and whenever income is recorded.
 *
 * Usage:
 *   TELEGRAM_TOKEN=tok TELEGRAM_CHAT_ID=id node index.js
 */

'use strict';

const fs    = require('fs');
const https = require('https');
const path  = require('path');

const STATE_FILE     = path.join(__dirname, 'state.json');
const MONTHLY_TARGET = 8333;
const CHAT_ID        = process.env.TELEGRAM_CHAT_ID;
const TOKEN          = process.env.TELEGRAM_TOKEN;

const STREAMS = {
  upwork:  { label: 'Upwork',  target: 5000 },
  gumroad: { label: 'Gumroad', target: 2000 },
  shopify: { label: 'Shopify', target: 1333 },
};

// ─── State ────────────────────────────────────────────────────────────────────

function load() {
  if (!fs.existsSync(STATE_FILE)) return fresh();
  const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  const now = new Date();
  if (s.month !== `${now.getFullYear()}-${now.getMonth()}`) return fresh();
  return s;
}

function fresh() {
  return {
    month: (() => { const n = new Date(); return `${n.getFullYear()}-${n.getMonth()}`; })(),
    streams: Object.fromEntries(Object.entries(STREAMS).map(([k, v]) => [k, { earned: 0, target: v.target }])),
    milestones: {},
  };
}

function save(s) { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }

// ─── Telegram ─────────────────────────────────────────────────────────────────

function notify(text) {
  if (!TOKEN || !CHAT_ID) { console.log('[ALERT]', text); return; }
  const body = JSON.stringify({ chat_id: CHAT_ID, text });
  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  });
  req.write(body);
  req.end();
}

// ─── Core logic ───────────────────────────────────────────────────────────────

function recordRevenue(stream, amount) {
  const state = load();
  state.streams[stream].earned += amount;

  // Milestone alerts: 25%, 50%, 75%, 100%
  const pct = state.streams[stream].earned / state.streams[stream].target;
  for (const m of [0.25, 0.5, 0.75, 1.0]) {
    const key = `${stream}_${m}`;
    if (pct >= m && !state.milestones[key]) {
      state.milestones[key] = true;
      notify(`${STREAMS[stream].label} hit ${m * 100}% of monthly target ($${state.streams[stream].earned.toFixed(0)} / $${state.streams[stream].target})`);
    }
  }

  save(state);
  return state;
}

function dailyCheck() {
  const state = load();
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const progress = dayOfMonth / daysInMonth;

  const lines = ['Daily revenue check:'];
  let warnings = 0;

  for (const [key, stream] of Object.entries(state.streams)) {
    const pct = stream.earned / stream.target;
    const bar = '█'.repeat(Math.round(pct * 10)) + '░'.repeat(10 - Math.round(pct * 10));
    lines.push(`${STREAMS[key].label.padEnd(8)} ${bar} $${stream.earned}/$${stream.target} (${Math.round(pct * 100)}%)`);

    // Warn if earned < expected at this point in month
    if (pct < progress - 0.15) {
      lines.push(`  ⚠ ${STREAMS[key].label} is behind pace`);
      warnings++;
    }
  }

  const total = Object.values(state.streams).reduce((s, v) => s + v.earned, 0);
  lines.push(`Total: $${total.toFixed(0)} / $${MONTHLY_TARGET} (${Math.round(total / MONTHLY_TARGET * 100)}%)`);

  notify(lines.join('\n'));
  return { state, warnings };
}

function rebalance() {
  // Mid-month: shift targets from struggling streams to performing ones
  const state = load();
  const now = new Date();
  if (now.getDate() < 14 || now.getDate() > 16) return; // only run mid-month

  for (const [key, stream] of Object.entries(state.streams)) {
    const pct = stream.earned / stream.target;
    if (pct < 0.3) {
      // This stream is struggling — reduce target, surface the gap
      const oldTarget = stream.target;
      stream.target = Math.max(stream.earned * 2, stream.target * 0.7);
      notify(`Rebalancing: ${STREAMS[key].label} target lowered from $${oldTarget} → $${Math.round(stream.target)} (only at ${Math.round(pct * 100)}% mid-month)`);
    }
  }

  save(state);
}

// ─── Run ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  // Demo: record some revenue and run daily check
  recordRevenue('upwork', 450);
  recordRevenue('shopify', 127.50);
  dailyCheck();
  rebalance();
}

module.exports = { recordRevenue, dailyCheck, rebalance };

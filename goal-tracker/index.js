/**
 * Revenue Goal Tracker
 * Tracks income across multiple streams, fires milestone alerts, rebalances targets.
 * Zero npm dependencies. State persisted to JSON file.
 *
 * Usage:
 *   node index.js status
 *   node index.js record upwork 500
 *   node index.js record shopify 150
 *   node index.js reset
 */

'use strict';

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'goal-state.json');
const MONTHLY_TARGET = 8333;

const STREAMS = {
  upwork:  { target: 5000, label: 'Upwork' },
  gumroad: { target: 2000, label: 'Gumroad' },
  shopify: { target: 1333, label: 'Shopify' },
};

// ─── State ────────────────────────────────────────────────────────────────────

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return createFreshState();
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    // Reset if new month
    const saved = new Date(state.month);
    const now = new Date();
    if (saved.getMonth() !== now.getMonth() || saved.getFullYear() !== now.getFullYear()) {
      return createFreshState();
    }
    return state;
  } catch {
    return createFreshState();
  }
}

function createFreshState() {
  const state = {
    month: new Date().toISOString().slice(0, 7),
    streams: Object.fromEntries(Object.entries(STREAMS).map(([k, v]) => [k, { earned: 0, target: v.target }])),
    milestones: {},
    transactions: [],
  };
  saveState(state);
  return state;
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ─── Core logic ───────────────────────────────────────────────────────────────

function record(stream, amount) {
  if (!STREAMS[stream]) {
    console.error(`Unknown stream: ${stream}. Valid: ${Object.keys(STREAMS).join(', ')}`);
    process.exit(1);
  }
  const state = loadState();
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) { console.error('Amount must be a positive number'); process.exit(1); }

  state.streams[stream].earned += num;
  state.transactions.push({ stream, amount: num, date: new Date().toISOString() });

  // Check milestones (25%, 50%, 75%, 100%)
  const pct = state.streams[stream].earned / state.streams[stream].target;
  for (const milestone of [0.25, 0.5, 0.75, 1.0]) {
    const key = `${stream}_${milestone}`;
    if (pct >= milestone && !state.milestones[key]) {
      state.milestones[key] = true;
      console.log(`\nMILESTONE: ${STREAMS[stream].label} reached ${Math.round(milestone * 100)}% of target!`);
    }
  }

  saveState(state);
  printStatus(state);
}

function printStatus(state) {
  const totalEarned = Object.values(state.streams).reduce((s, v) => s + v.earned, 0);
  const totalPct = (totalEarned / MONTHLY_TARGET * 100).toFixed(1);
  const daysLeft = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();

  console.log(`\n=== Revenue Goal — ${state.month} ===`);
  console.log(`Overall: $${totalEarned.toFixed(0)} / $${MONTHLY_TARGET} (${totalPct}%)`);
  console.log(`Days left in month: ${daysLeft}\n`);

  for (const [key, stream] of Object.entries(state.streams)) {
    const pct = Math.min(stream.earned / stream.target * 100, 100).toFixed(0);
    const bar = '[' + '#'.repeat(Math.floor(pct / 5)) + '-'.repeat(20 - Math.floor(pct / 5)) + ']';
    const label = STREAMS[key].label.padEnd(8);
    console.log(`${label} ${bar} $${stream.earned.toFixed(0)} / $${stream.target} (${pct}%)`);
  }

  if (daysLeft > 0) {
    const remaining = MONTHLY_TARGET - totalEarned;
    const dailyNeeded = remaining / daysLeft;
    console.log(`\nNeed $${remaining.toFixed(0)} more ($${dailyNeeded.toFixed(0)}/day to hit goal)`);
  } else {
    console.log(totalEarned >= MONTHLY_TARGET ? '\nGoal achieved!' : '\nMonth ended — goal not reached.');
  }
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

const [,, command, ...args] = process.argv;

switch (command) {
  case 'status':
    printStatus(loadState());
    break;
  case 'record':
    record(args[0], args[1]);
    break;
  case 'reset':
    fs.writeFileSync(STATE_FILE, JSON.stringify(createFreshState(), null, 2));
    console.log('State reset for new month.');
    break;
  default:
    console.log('Usage:\n  node index.js status\n  node index.js record <stream> <amount>\n  node index.js reset');
}

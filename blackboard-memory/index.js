/**
 * Blackboard Memory — Shared Agent Knowledge Base
 * Multiple AI agents post findings here. Any agent can query what others know.
 * TTL-based expiry. No database — pure JSON + Node.js fs.
 *
 * This is how Nuri's agents collaborate without direct coupling:
 *   Upwork scanner posts job trends
 *   Morning brief agent reads them
 *   Goal engine reads revenue data
 *   Reflection agent reads everything and improves strategy
 *
 * Usage:
 *   const blackboard = require('./index.js');
 *   await blackboard.post('upwork_jobs', { count: 12, topSkill: 'Node.js' }, 'upwork-scanner');
 *   const jobs = await blackboard.queryLatest('upwork_jobs');
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'blackboard.json');
const DEFAULT_TTL_HOURS = 24;

// ─── State management ─────────────────────────────────────────────────────────

function load() {
  if (!fs.existsSync(STATE_FILE)) return { entries: [] };
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { entries: [] }; }
}

function save(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function prune(state) {
  const now = Date.now();
  state.entries = state.entries.filter(e => e.expiresAt > now);
  return state;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Post a finding to the blackboard.
 * @param {string} topic      - e.g. 'upwork_jobs', 'shopify_order', 'goal_status'
 * @param {any}    content    - any JSON-serializable data
 * @param {string} source     - agent name posting this
 * @param {number} ttlHours   - how long before this expires (default 24h)
 */
function post(topic, content, source = 'unknown', ttlHours = DEFAULT_TTL_HOURS) {
  const state = prune(load());
  const entry = {
    id: `${topic}_${Date.now()}`,
    topic,
    content,
    source,
    postedAt: new Date().toISOString(),
    expiresAt: Date.now() + ttlHours * 3600 * 1000,
  };
  state.entries.push(entry);
  save(state);

  // Notify subscribers
  const handlers = subscribers[topic] || [];
  handlers.forEach(fn => fn(entry));

  return entry;
}

/** Get all non-expired entries for a topic, newest first. */
function query(topic) {
  const state = prune(load());
  return state.entries
    .filter(e => e.topic === topic)
    .sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
}

/** Get the single most recent entry for a topic. */
function queryLatest(topic) {
  return query(topic)[0] ?? null;
}

/** Get all entries posted by a specific agent. */
function queryBySource(source) {
  const state = prune(load());
  return state.entries
    .filter(e => e.source === source)
    .sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
}

/** Summary of what's on the blackboard right now. */
function getSummary() {
  const state = prune(load());
  const topics = {};
  for (const e of state.entries) {
    topics[e.topic] = (topics[e.topic] || 0) + 1;
  }
  return { total: state.entries.length, topics };
}

// ─── Pub/sub (in-process) ─────────────────────────────────────────────────────

const subscribers = {};

/** Subscribe to new posts on a topic. */
function subscribe(topic, callback) {
  if (!subscribers[topic]) subscribers[topic] = [];
  subscribers[topic].push(callback);
}

// ─── Demo ─────────────────────────────────────────────────────────────────────

if (require.main === module) {
  // Simulate 3 agents collaborating via blackboard
  post('upwork_jobs',    { count: 8, topSkill: 'Node.js', avgRate: '$45/hr' }, 'upwork-scanner');
  post('shopify_orders', { count: 2, revenue: 127.50, currency: 'USD' },       'shopify-webhook');
  post('goal_status',    { upwork: 450, gumroad: 0, shopify: 127, total: 577, target: 8333 }, 'goal-engine');

  console.log('Blackboard summary:', getSummary());
  console.log('Latest Upwork data:', queryLatest('upwork_jobs')?.content);
  console.log('All entries from goal-engine:', queryBySource('goal-engine').length);
}

module.exports = { post, query, queryLatest, queryBySource, getSummary, subscribe };

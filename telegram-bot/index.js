/**
 * AI-Powered Telegram Bot
 * Handles commands and natural language via Gemini AI.
 * Zero npm dependencies — uses Node.js built-in https module.
 *
 * Usage:
 *   TELEGRAM_TOKEN=your_token GEMINI_API_KEY=your_key node index.js
 */

'use strict';

const https = require('https');

const TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash';

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function post(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const urlObj = new URL(url);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve(JSON.parse(raw)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function tg(method, body) {
  return post(`https://api.telegram.org/bot${TOKEN}/${method}`, body);
}

// ─── Gemini AI ────────────────────────────────────────────────────────────────

async function askGemini(prompt) {
  const res = await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
    { contents: [{ parts: [{ text: prompt }] }] }
  );
  return res.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No response.';
}

// ─── Command handlers ─────────────────────────────────────────────────────────

const commands = {
  '/start': async (msg) => {
    await tg('sendMessage', {
      chat_id: msg.chat.id,
      text: `Hello ${msg.from.first_name}! I'm an AI assistant. Ask me anything or use /help.`,
    });
  },

  '/help': async (msg) => {
    await tg('sendMessage', {
      chat_id: msg.chat.id,
      text: 'Commands:\n/start — greeting\n/help — this menu\n/status — system status\n\nOr just send any message and I\'ll reply with AI.',
    });
  },

  '/status': async (msg) => {
    await tg('sendMessage', {
      chat_id: msg.chat.id,
      text: `Status: online\nUptime: ${Math.floor(process.uptime())}s\nMemory: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
    });
  },
};

// ─── Message handler ──────────────────────────────────────────────────────────

async function handleMessage(msg) {
  if (!msg?.text) return;
  const handler = commands[msg.text.split(' ')[0]];
  if (handler) {
    await handler(msg);
  } else {
    // Natural language — send to Gemini
    const reply = await askGemini(msg.text);
    await tg('sendMessage', { chat_id: msg.chat.id, text: reply });
  }
}

// ─── Polling loop ─────────────────────────────────────────────────────────────

let offset = 0;

async function poll() {
  try {
    const res = await tg('getUpdates', { offset, timeout: 30, allowed_updates: ['message'] });
    for (const update of res.result ?? []) {
      offset = update.update_id + 1;
      handleMessage(update.message).catch(e => console.error('Handler error:', e.message));
    }
  } catch (e) {
    console.error('Poll error:', e.message);
  }
  setTimeout(poll, 1000);
}

console.log('Bot started. Polling...');
poll();

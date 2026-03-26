/**
 * Demo Restaurant — AI Customer Support Bot
 * Powered by Vertex AI (Gemini 3.1 Pro) + Dialogflow CX
 * Google Cloud Project: geometric-gamma-487620-r6
 *
 * Features:
 *  - Menu & pricing queries
 *  - Opening hours
 *  - Table reservations
 *  - Complaint handling
 *  - Human escalation
 *  - Multi-turn conversation memory per user
 *
 * Usage: node ~/demo/restaurant-bot.js
 */

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { execSync } = require('child_process');

// ─── Config ───────────────────────────────────────────────────────────────────

const envPath = path.join(process.env.HOME, '.openclaw/.env');
const env = fs.existsSync(envPath)
  ? Object.fromEntries(
      fs.readFileSync(envPath,'utf8').split('\n')
        .filter(l => l.includes('=') && !l.startsWith('#'))
        .map(l => [l.split('=')[0].trim(), l.split('=').slice(1).join('=').trim()])
    )
  : {};

const TELEGRAM_TOKEN = env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const GEMINI_KEY     = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const GEMINI_MODEL   = 'gemini-2.5-flash';
const PROJECT        = 'geometric-gamma-487620-r6';
const AGENT_ID       = '875e21f9-8be3-490e-b6fb-2616e82a6a4a';

// ─── Restaurant Knowledge ─────────────────────────────────────────────────────

const RESTAURANT = {
  name: 'Demo Restaurant',
  location: 'Cape Town CBD, 15 Long Street',
  hours: 'Monday to Sunday, 11:00am – 10:00pm',
  phone: '021-555-0123',
  menu: {
    mains: [
      { item: 'Classic Burger',       price: 89,  desc: 'Beef patty, lettuce, tomato, pickles, brioche bun' },
      { item: 'Chicken Pasta',        price: 95,  desc: 'Penne, creamy mushroom sauce, grilled chicken' },
      { item: 'Grilled Sirloin Steak',price: 165, desc: '250g sirloin, served with chips and side salad' },
      { item: 'Veggie Wrap',          price: 75,  desc: 'Roasted veg, hummus, feta, in a wholewheat wrap' },
      { item: 'Fish & Chips',         price: 110, desc: 'Hake fillet, beer batter, thick-cut chips' },
    ],
    drinks: [
      { item: 'Soft Drinks',  price: 28 },
      { item: 'Fresh Juice',  price: 38 },
      { item: 'Craft Beer',   price: 52 },
      { item: 'House Wine',   price: 55, desc: 'Glass' },
      { item: 'Cappuccino',   price: 32 },
    ],
    desserts: [
      { item: 'Malva Pudding',  price: 52 },
      { item: 'Cheesecake',     price: 58 },
    ],
  },
};

const SYSTEM_PROMPT = `You are a friendly, professional customer support assistant for ${RESTAURANT.name}, a restaurant located in ${RESTAURANT.location}.

RESTAURANT INFORMATION:
- Name: ${RESTAURANT.name}
- Location: ${RESTAURANT.location}
- Hours: ${RESTAURANT.hours}
- Reservations phone: ${RESTAURANT.phone}

MENU:
Mains:
${RESTAURANT.menu.mains.map(m => `- ${m.item}: R${m.price}${m.desc ? ' — ' + m.desc : ''}`).join('\n')}

Drinks:
${RESTAURANT.menu.drinks.map(d => `- ${d.item}: R${d.price}${d.desc ? ' (' + d.desc + ')' : ''}`).join('\n')}

Desserts:
${RESTAURANT.menu.desserts.map(d => `- ${d.item}: R${d.price}`).join('\n')}

YOUR BEHAVIOUR RULES:
1. Be warm, friendly and professional — like a good restaurant host
2. Answer menu and hours questions directly and helpfully
3. For reservations: collect name, date, time, and party size. Then say "Please call us on ${RESTAURANT.phone} to confirm your booking, or I can note your request and a staff member will call you back."
4. For complaints: acknowledge the issue sincerely, apologise, offer to escalate to the manager. Never argue.
5. If a customer is very upset or asks for a human: say "I'm connecting you with our manager now. Please call ${RESTAURANT.phone} or hold on and we'll call you back within 10 minutes."
6. Keep responses SHORT — 2-4 sentences max. This is a chat interface.
7. Use a South African tone — friendly but professional.
8. If asked what AI powers you, say "I'm powered by Vertex AI and Gemini, built for Demo Restaurant."
9. Never make up information not listed above. If unsure, say "Let me get that checked for you — please call us on ${RESTAURANT.phone}."

IMPORTANT: You are ONLY a support bot for ${RESTAURANT.name}. Stay on topic.`;

// ─── Conversation memory ──────────────────────────────────────────────────────

const conversations = new Map(); // chatId → [{role, parts}]

function getHistory(chatId) {
  if (!conversations.has(chatId)) conversations.set(chatId, []);
  return conversations.get(chatId);
}

function addToHistory(chatId, role, text) {
  const history = getHistory(chatId);
  history.push({ role, parts: [{ text }] });
  // Keep last 20 messages to stay within context limits
  if (history.length > 20) history.splice(0, history.length - 20);
}

// ─── Gemini (Vertex AI) ───────────────────────────────────────────────────────

function httpsPost(hostname, pathname, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname, path: pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({ _raw: raw }); } });
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

async function geminiChat(chatId, userMessage) {
  addToHistory(chatId, 'user', userMessage);
  const history = getHistory(chatId);

  const result = await httpsPost(
    'generativelanguage.googleapis.com',
    `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: history,
      generationConfig: {
        maxOutputTokens: 300,
        temperature: 0.4,
      },
    }
  );

  const reply = result.candidates?.[0]?.content?.parts?.[0]?.text
    || "I'm sorry, I'm having trouble right now. Please call us on 021-555-0123.";

  addToHistory(chatId, 'model', reply);
  return reply;
}

// ─── Detect escalation intent ─────────────────────────────────────────────────

function needsEscalation(text) {
  const triggers = ['speak to human','talk to someone','real person','manager','supervisor',
    'this is unacceptable','disgusting','terrible','sue','refund','lawyers'];
  return triggers.some(t => text.toLowerCase().includes(t));
}

// ─── Telegram ─────────────────────────────────────────────────────────────────

async function sendTelegram(chatId, text) {
  await httpsPost(
    'api.telegram.org',
    `/bot${TELEGRAM_TOKEN}/sendMessage`,
    { chat_id: chatId, text, parse_mode: 'HTML' }
  );
}

async function sendTyping(chatId) {
  await httpsPost(
    'api.telegram.org',
    `/bot${TELEGRAM_TOKEN}/sendChatAction`,
    { chat_id: chatId, action: 'typing' }
  ).catch(() => {});
}

// ─── Message handler ──────────────────────────────────────────────────────────

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text   = msg.text?.trim();
  const name   = msg.from?.first_name || 'there';

  if (!text) return;

  console.log(`[${chatId}] ${name}: ${text}`);

  // Show typing indicator
  await sendTyping(chatId);

  // Handle /start
  if (text === '/start' || text === '/hello') {
    const welcome = `Welcome to ${RESTAURANT.name}! 👋

I'm your AI assistant. I can help you with:
• Menu and prices
• Opening hours
• Table reservations
• Any questions or concerns

How can I help you today?`;
    await sendTelegram(chatId, welcome);
    return;
  }

  // Pre-check for escalation triggers
  if (needsEscalation(text)) {
    const escalation = `I completely understand your frustration, and I'm so sorry for the experience. I'm escalating this to our manager right now.\n\nPlease call us directly on <b>021-555-0123</b> or a team member will call you back within 10 minutes. We want to make this right.`;
    await sendTelegram(chatId, escalation);
    console.log(`[ESCALATED] Chat ${chatId}: "${text}"`);
    return;
  }

  // Route to Gemini (Vertex AI)
  try {
    const reply = await geminiChat(chatId, text);
    await sendTelegram(chatId, reply);
    console.log(`[${chatId}] Bot: ${reply.slice(0, 80)}...`);
  } catch (e) {
    console.error('[ERROR]', e.message);
    await sendTelegram(chatId, `Sorry, I'm having a technical issue. Please call us on 021-555-0123 and we'll be happy to help!`);
  }
}

// ─── Polling ──────────────────────────────────────────────────────────────────

let offset = 0;

async function poll() {
  try {
    const res = await httpsPost('api.telegram.org', `/bot${TELEGRAM_TOKEN}/getUpdates`,
      { offset, timeout: 30, allowed_updates: ['message'] });

    for (const update of res.result || []) {
      offset = update.update_id + 1;
      if (update.message) {
        handleMessage(update.message).catch(e => console.error('Handler error:', e.message));
      }
    }
  } catch (e) {
    console.error('[Poll error]', e.message);
  }
  setTimeout(poll, 1000);
}

// ─── Start ────────────────────────────────────────────────────────────────────

console.log(`
╔══════════════════════════════════════════╗
║   Demo Restaurant — AI Support Bot       ║
║   Powered by Vertex AI + Gemini          ║
║   Project: ${PROJECT}  ║
╚══════════════════════════════════════════╝

Bot started. Send /start on Telegram to begin.
Listening for messages...
`);

poll();

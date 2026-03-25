/**
 * Shopify Order Webhook → Telegram Notifications
 * Verifies HMAC-SHA256 signature, parses order, sends formatted alert.
 * Zero npm dependencies — Node.js built-ins only.
 *
 * Usage:
 *   SHOPIFY_SECRET=your_secret TELEGRAM_TOKEN=tok TELEGRAM_CHAT_ID=id node index.js
 *
 * Register webhook in Shopify Admin:
 *   Settings → Notifications → Webhooks → orders/create → http://your-server:3000/webhook
 */

'use strict';

const http = require('http');
const crypto = require('crypto');
const https = require('https');

const PORT = process.env.PORT || 3000;
const SHOPIFY_SECRET = process.env.SHOPIFY_SECRET;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ─── HMAC verification ────────────────────────────────────────────────────────

function verifyShopify(rawBody, hmacHeader) {
  const expected = crypto
    .createHmac('sha256', SHOPIFY_SECRET)
    .update(rawBody)
    .digest('base64');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hmacHeader));
}

// ─── Telegram sender ──────────────────────────────────────────────────────────

function sendTelegram(text) {
  const body = JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' });
  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${TELEGRAM_TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  });
  req.write(body);
  req.end();
}

// ─── Order formatter ──────────────────────────────────────────────────────────

function formatOrder(order, topic) {
  const name = order.customer
    ? `${order.customer.first_name} ${order.customer.last_name}`
    : 'Guest';
  const items = (order.line_items || [])
    .map(i => `  • ${i.title} x${i.quantity}`)
    .join('\n');
  const eventLabel = {
    'orders/create': 'New Order',
    'orders/paid': 'Order Paid',
    'orders/cancelled': 'Order Cancelled',
    'orders/fulfilled': 'Order Fulfilled',
  }[topic] ?? topic;

  return [
    `<b>${eventLabel} #${order.order_number}</b>`,
    `Customer: ${name}`,
    `Total: ${order.currency} ${order.total_price}`,
    `Status: ${order.financial_status} / ${order.fulfillment_status ?? 'unfulfilled'}`,
    items ? `Items:\n${items}` : '',
  ].filter(Boolean).join('\n');
}

// ─── HTTP server ──────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/webhook') {
    res.writeHead(404).end();
    return;
  }

  let raw = '';
  req.on('data', chunk => raw += chunk);
  req.on('end', () => {
    const hmac = req.headers['x-shopify-hmac-sha256'];
    const topic = req.headers['x-shopify-topic'];

    if (!hmac || !verifyShopify(raw, hmac)) {
      console.warn('Invalid Shopify signature — rejected');
      res.writeHead(401).end('Unauthorized');
      return;
    }

    res.writeHead(200).end('OK');

    try {
      const order = JSON.parse(raw);
      const message = formatOrder(order, topic);
      sendTelegram(message);
      console.log(`[${topic}] Order #${order.order_number} — notified`);
    } catch (e) {
      console.error('Parse error:', e.message);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Shopify webhook server listening on port ${PORT}`);
});

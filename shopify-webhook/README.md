# Shopify Order Webhook → Telegram

Receives Shopify order events and sends formatted Telegram notifications. HMAC-SHA256 verified.

## Setup

```bash
export SHOPIFY_SECRET=your_webhook_secret
export TELEGRAM_TOKEN=your_bot_token
export TELEGRAM_CHAT_ID=your_chat_id
node index.js
```

## Register Webhook in Shopify

1. Shopify Admin → Settings → Notifications → Webhooks
2. Add webhook: `orders/create` → `http://your-server:3000/webhook`

## Supported Events

- `orders/create` — new order placed
- `orders/paid` — payment confirmed
- `orders/cancelled` — order cancelled
- `orders/fulfilled` — order shipped

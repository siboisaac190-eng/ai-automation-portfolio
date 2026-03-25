# AI Telegram Bot

Command routing + Gemini AI natural language responses. No npm required.

## Setup

```bash
export TELEGRAM_TOKEN=your_bot_token
export GEMINI_API_KEY=your_gemini_key
node index.js
```

## Features

- `/start` `/help` `/status` command handlers
- Any non-command message → Gemini AI reply
- Long-polling (no webhook server needed)
- Single file, zero dependencies

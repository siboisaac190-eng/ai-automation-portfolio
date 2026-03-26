# AI ↔ AI Email Bridge

Two AI systems communicate autonomously via Gmail — no human in the loop.

**The problem it solves:** Nuri (always-on AI on my Mac) needs to ask Claude Code to fix bugs or build features, and receive the result — without me doing anything.

## How It Works

```
Nuri detects crash (3x in 1 hour)
  → sends [NURI] Bug Fix email via SMTP
    → Claude Code reads inbox via IMAP
      → fixes the code → replies [CLAUDE] Bug Fix - COMPLETE
        → Nuri picks up reply at 6:50am
          → Isaac gets Telegram: "Bug fixed automatically"
```

## Setup

```bash
export GMAIL_ADDRESS=you@gmail.com
export GMAIL_APP_PASSWORD=your_app_password  # Gmail → Security → App Passwords

node index.js send    # Nuri sends a bug report
node index.js check   # Check for Claude Code replies
```

## Technical

- Pure Node.js `tls` module — no nodemailer, no npm
- SMTP on port 465 (TLS), IMAP on port 993 (TLS)
- Subject-line routing: `[NURI]` outbound, `[CLAUDE]` inbound
- Reads only UNSEEN emails matching the subject filter

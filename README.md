# AI Automation Portfolio — Sibomana Isaac

Production-ready Node.js automation. Built for real systems, not demos.

Every module here runs inside **Nuri** — my autonomous AI Business OS that operates 24/7 on a MacBook Air M1, scanning for freelance work, tracking revenue, fixing its own bugs, and briefing me every morning on Telegram.

---

## Modules

### Core Bot Infrastructure
| Module | What it does |
|---|---|
| [`telegram-bot/`](./telegram-bot/) | AI-powered Telegram bot — commands + Gemini natural language |
| [`shopify-webhook/`](./shopify-webhook/) | Shopify order events → verified HMAC → Telegram notifications |

### Multi-Agent Systems (the interesting stuff)
| Module | What it does |
|---|---|
| [`blackboard-memory/`](./blackboard-memory/) | Shared memory bus — 6 agents post findings, any agent reads them |
| [`email-bridge/`](./email-bridge/) | Two AIs talk via Gmail: Nuri reports bugs → Claude Code fixes → replies |
| [`revenue-engine/`](./revenue-engine/) | Tracks $8,333/month goal, fires milestone alerts, rebalances mid-month |

### Utilities
| Module | What it does |
|---|---|
| [`ai-agent/`](./ai-agent/) | Goal-driven agent: plan → execute → reflect |
| [`goal-tracker/`](./goal-tracker/) | CLI revenue tracker with progress bars |

---

## Architecture: How These Fit Together

```
                    ISAAC (Telegram)
                         │
                         ▼
                    NURI (always on)
                    ┌────────────────┐
                    │ telegram-bot   │ ← commands from Isaac
                    │ shopify-webhook│ ← orders from Shopify
                    │ revenue-engine │ ← tracks income 24/7
                    │ blackboard     │ ← agents share findings
                    │ email-bridge   │ ← talks to Claude Code
                    └────────────────┘
                         │
              bug/task via Gmail ([NURI])
                         │
                         ▼
                   CLAUDE CODE
              reads → fixes → replies ([CLAUDE])
                         │
                    Nuri picks up reply
                         │
                         ▼
              "Bug fixed automatically" (Telegram)
```

---

## Tech Stack

- **Runtime:** Node.js 22
- **AI:** Gemini 3.1 Pro / 2.5 Flash
- **Zero npm** in core modules — Node.js built-ins only (`tls`, `https`, `fs`, `crypto`, `http`)
- **Protocols:** SMTP port 465 · IMAP port 993 · HTTPS · WebSocket

---

## Hire Me

Available on Upwork for Node.js automation, AI agents, Telegram bots, Shopify integrations.
**github.com/siboisaac190-eng** · Response under 4 hours.

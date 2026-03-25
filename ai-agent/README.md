# Autonomous AI Agent

Goal-driven agent that plans tasks, executes each step with memory context, then reflects on results.

## Setup

```bash
export GEMINI_API_KEY=your_key
node index.js "research Node.js freelance opportunities"
```

## How It Works

1. **Plan** — Gemini breaks the goal into 3-5 steps
2. **Execute** — Each step runs with previous results as context
3. **Reflect** — Agent summarizes what was done and recommends next action

## Example Output

```
Goal: Write a plan to get 3 freelance clients this week
Planning...
  Step 1: Identify target platforms (Upwork, Toptal, LinkedIn)
  Step 2: Write a compelling profile headline
  Step 3: Draft 3 outreach messages
  ...
=== AGENT SUMMARY ===
Completed outreach plan with 3 platform-specific strategies...
```

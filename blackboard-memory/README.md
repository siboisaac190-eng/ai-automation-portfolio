# Blackboard Memory — Multi-Agent Knowledge Base

Shared memory system that lets multiple AI agents collaborate without being directly connected.

**The problem it solves:** Nuri runs 6 agents in parallel. They need to share findings without calling each other directly — loose coupling, no bottlenecks.

## How It Works

```
upwork-scanner  →  posts { jobs: 8, topSkill: 'Node.js' }   → blackboard
shopify-agent   →  posts { orders: 2, revenue: $127 }        → blackboard
goal-engine     →  reads both → updates progress bars        ← blackboard
morning-brief   →  reads all  → builds Isaac's 7am summary   ← blackboard
reflector       →  reads all  → improves strategy overnight  ← blackboard
```

## Usage

```js
const blackboard = require('./index.js');

// Agent 1 posts a finding
blackboard.post('upwork_jobs', { count: 8, topSkill: 'Node.js' }, 'upwork-scanner');

// Agent 2 reads it (from a completely separate process)
const jobs = blackboard.queryLatest('upwork_jobs');
console.log(jobs.content.topSkill); // 'Node.js'

// Subscribe to live updates
blackboard.subscribe('shopify_orders', entry => {
  console.log('New order:', entry.content.revenue);
});
```

## Features

- TTL-based expiry (default 24h, configurable per post)
- In-process pub/sub for real-time agent notifications
- Zero dependencies — JSON file persistence
- Thread-safe reads (atomic file writes)

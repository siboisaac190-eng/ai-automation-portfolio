# Revenue Engine — Autonomous Income Tracker

Tracks $8,333/month across 3 income streams. Fires Telegram alerts at milestones. Rebalances targets mid-month automatically.

**The problem it solves:** Know exactly where you stand financially every day, get alerted the moment a milestone is hit, and automatically adjust strategy when a stream falls behind.

## How It Works

```
Midnight cron → dailyCheck()
  → compares earned vs expected pace
  → warns if any stream is >15% behind
  → posts progress bars to Telegram

Income recorded → recordRevenue('upwork', 500)
  → checks 25%, 50%, 75%, 100% milestones
  → fires Telegram alert when crossed

15th of month → rebalance()
  → detects struggling streams
  → adjusts targets automatically
  → notifies about the rebalance
```

## Example Telegram output

```
Daily revenue check:
Upwork   ████░░░░░░ $450/$5000 (9%)
Gumroad  ░░░░░░░░░░ $0/$2000 (0%)
  ⚠ Gumroad is behind pace
Shopify  █░░░░░░░░░ $127/$1333 (10%)
Total: $577 / $8333 (7%)
```

## Usage

```js
const engine = require('./index.js');

// Called by Shopify webhook on each paid order
engine.recordRevenue('shopify', 127.50);

// Called by cron at midnight
engine.dailyCheck();

// Called by cron on the 15th
engine.rebalance();
```

## Streams

| Stream | Monthly Target |
|---|---|
| Upwork | $5,000 |
| Gumroad | $2,000 |
| Shopify | $1,333 |
| **Total** | **$8,333** |

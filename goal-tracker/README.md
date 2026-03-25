# Revenue Goal Tracker

Tracks monthly income across multiple streams with milestone alerts and progress bars.

## Setup

```bash
node index.js status
node index.js record upwork 500
node index.js record shopify 150
```

## Example Output

```
=== Revenue Goal — 2026-03 ===
Overall: $650 / $8333 (7.8%)
Days left in month: 15

Upwork   [###-----------------] $500 / $5000 (10%)
Gumroad  [--------------------] $0 / $2000 (0%)
Shopify  [##------------------] $150 / $1333 (11%)

Need $7683 more ($512/day to hit goal)
```

## Streams

| Stream | Target |
|---|---|
| Upwork | $5,000/month |
| Gumroad | $2,000/month |
| Shopify | $1,333/month |
| **Total** | **$8,333/month** |

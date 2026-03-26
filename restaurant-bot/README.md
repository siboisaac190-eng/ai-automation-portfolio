# Restaurant AI Support Bot

24/7 customer support bot for restaurants. Handles menu queries, reservations, complaints, and escalation — on Telegram or WhatsApp.

**Live stack:** Gemini 3.1 Pro (Vertex AI) + Telegram Bot API + Node.js (zero npm)

## Tested Conversations

```
Customer: What time do you open?
Bot:      Howzit! We're open from 11am to 10pm, seven days a week. Come pop in anytime!

Customer: How much is the steak?
Bot:      Our Grilled Sirloin Steak is R165. It's a real treat!

Customer: I want to book a table for 4 this Saturday at 7pm
Bot:      Lekker! Could I get your name? You can confirm by calling 021-555-0123.

Customer: My food was cold and the waiter was rude.
Bot:      I'm so sorry to hear that. That's not the standard we aim for.
          I'd like to escalate this to our manager immediately.

Customer: I want to speak to a manager right now.
Bot:      I'm connecting you with our manager now. Please call 021-555-0123
          or we'll call you back within 10 minutes.
```

## Features

- Multi-turn conversation memory per user (remembers context within a chat)
- Complaint detection and empathetic handling
- Hard-coded escalation triggers (rude, refund, manager, unacceptable)
- `sendChatAction` typing indicator while generating response
- System prompt with full restaurant menu, hours, location, phone
- Single file, zero dependencies

## Setup

```bash
TELEGRAM_BOT_TOKEN=your_token GEMINI_API_KEY=your_key node restaurant-bot.js
```

Then message your bot on Telegram. Send `/start` to begin.

## Customise For Any Restaurant

Edit the `RESTAURANT` object at the top of `restaurant-bot.js`:
- Name, location, phone
- Full menu with prices
- Opening hours

## Sell This To

Any restaurant getting 20+ WhatsApp messages per day.

**Price: R8,000 setup + R2,000/month**
ROI: Replaces 1 support staff member (R8,000/month salary). Pays for itself in 30 days.

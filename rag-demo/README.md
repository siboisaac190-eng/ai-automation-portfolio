# RAG Business Knowledge Base

Ask any question. Get a precise answer from your private documents in under 2 seconds.

**Live stack:** Vertex AI Agent Builder + Gemini 3.1 Pro + Node.js (zero npm)

## How It Works

```
User asks question
  → api.js searches Vertex AI data store
    → retrieves top matching document chunks
      → Gemini reads chunks + question
        → returns grounded answer with sources
```

## Setup

```bash
# 1. Create Vertex AI data store and upload your documents
# 2. Set your project and engine IDs in api.js
# 3. Run:
GEMINI_API_KEY=your_key node api.js
# 4. Open http://localhost:3000
```

## What Gets Demonstrated

- Searches 4 business documents (AI guide, pricing, case studies, RAG overview)
- Returns answers with source citations
- Falls back to local Gemini RAG if Vertex AI index is still building
- Dark UI with 6 suggested questions

## Sample Questions

- "How much does the Starter package cost?"
- "Show me a case study of a business that saved money"
- "What is RAG and why is it better than a normal chatbot?"
- "How long to see ROI from AI automation?"

## Sell This To

Any business with documents staff or customers need to search:
law firms, medical practices, property agencies, HR departments, retail.

**Price: R15,000 setup + R3,500/month**

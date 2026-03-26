/**
 * RAG Demo API Server
 * Hybrid RAG: tries Vertex AI search first, falls back to local search + Gemini.
 * Once Vertex AI finishes indexing (~30 min after first run), it uses that.
 *
 * Usage: node ~/demo/api.js
 * Open:  http://localhost:3000
 */

'use strict';

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { execSync } = require('child_process');

const PORT         = 3000;
const PROJECT      = 'geometric-gamma-487620-r6';
const ENGINE_ID    = 'business-demo-engine';
const KNOWLEDGE_DIR = path.join(process.env.HOME, '.openclaw/knowledge');
const GEMINI_MODEL  = 'gemini-2.5-flash';

// Load .env
const envPath = path.join(process.env.HOME, '.openclaw/.env');
const env = fs.existsSync(envPath)
  ? Object.fromEntries(fs.readFileSync(envPath,'utf8').split('\n').filter(l=>l.includes('=')).map(l=>l.split('=')))
  : {};
const GEMINI_KEY = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY?.trim() || '';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAccessToken() {
  try { return execSync('gcloud auth print-access-token 2>/dev/null',{encoding:'utf8'}).trim(); }
  catch { return null; }
}

function httpsPost(hostname, pathname, body, headers={}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname, path: pathname, method: 'POST',
      headers: {'Content-Type':'application/json','Content-Length':Buffer.byteLength(data),...headers},
    }, res => {
      let raw='';
      res.on('data',c=>raw+=c);
      res.on('end',()=>{ try{resolve(JSON.parse(raw))}catch{resolve({_raw:raw})} });
    });
    req.on('error',reject);
    req.write(data); req.end();
  });
}

// ─── LOCAL RAG (instant, always works) ───────────────────────────────────────

function loadKnowledgeBase() {
  if (!fs.existsSync(KNOWLEDGE_DIR)) return [];
  return fs.readdirSync(KNOWLEDGE_DIR)
    .filter(f => f.endsWith('.txt'))
    .map(f => ({
      id: path.basename(f, '.txt'),
      title: path.basename(f, '.txt').replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),
      content: fs.readFileSync(path.join(KNOWLEDGE_DIR, f), 'utf8'),
    }));
}

function scoreChunk(content, question) {
  const qWords = question.toLowerCase().split(/\W+/).filter(w=>w.length>3);
  const cLower = content.toLowerCase();
  return qWords.reduce((score, word) => {
    const count = (cLower.match(new RegExp(word,'g'))||[]).length;
    return score + count;
  }, 0);
}

function localSearch(question) {
  const docs = loadKnowledgeBase();
  return docs
    .map(doc => ({ ...doc, score: scoreChunk(doc.content, question) }))
    .filter(d => d.score > 0)
    .sort((a,b) => b.score - a.score)
    .slice(0, 3);
}

async function localRagAnswer(question) {
  const relevant = localSearch(question);

  if (!relevant.length) {
    return {
      answer: 'I could not find information about that in the knowledge base. Try asking about AI automation, pricing packages, case studies, or RAG technology.',
      sources: [],
      method: 'local-no-results',
    };
  }

  // Take top 2000 chars from each relevant doc
  const context = relevant.map(d =>
    `[Document: ${d.title}]\n${d.content.slice(0,2000)}`
  ).join('\n\n---\n\n');

  const prompt = `You are a helpful AI assistant for an AI automation business. Answer the customer's question clearly and helpfully using ONLY the document excerpts below. Be specific, mention concrete numbers and facts where available. If relevant, recommend next steps.

DOCUMENTS:
${context}

CUSTOMER QUESTION: ${question}

ANSWER (be helpful and specific, 2-4 paragraphs):`;

  const result = await httpsPost(
    'generativelanguage.googleapis.com',
    `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      contents:[{parts:[{text:prompt}]}],
      generationConfig:{ maxOutputTokens:1024, temperature:0.2 },
    }
  );

  const answer = result.candidates?.[0]?.content?.parts?.[0]?.text
    || 'Unable to generate answer. Please try again.';

  return {
    answer,
    sources: relevant.map(d=>({id:d.id, title:d.title})),
    method: 'local-gemini-rag',
  };
}

// ─── VERTEX AI RAG (kicks in once index is built, ~30 min) ───────────────────

async function vertexSearch(question) {
  const token = getAccessToken();
  if (!token) return null;

  const result = await httpsPost(
    'discoveryengine.googleapis.com',
    `/v1/projects/${PROJECT}/locations/global/collections/default_collection/engines/${ENGINE_ID}/servingConfigs/default_search:search`,
    {
      query: question,
      pageSize: 5,
      contentSearchSpec:{
        extractiveContentSpec:{maxExtractiveAnswerCount:3},
        summarySpec:{
          summaryResultCount:3,
          includeCitations:true,
          modelPromptSpec:{preamble:'You are a helpful business AI assistant. Answer only from the provided documents.'}
        }
      }
    },
    {'Authorization':`Bearer ${token}`, 'X-Goog-User-Project':PROJECT}
  );

  if (!result.results?.length && !result.summary?.summaryText) return null;

  const sources = (result.results||[]).map(r=>({
    id: r.document?.id||'unknown',
    title: (r.document?.id||'').replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),
  })).filter((s,i,a)=>a.findIndex(x=>x.id===s.id)===i);

  const answer = result.summary?.summaryText
    || (result.results||[]).map(r=>r.document?.derivedStructData?.snippets?.[0]?.snippet||'').filter(Boolean).join('\n\n')
    || null;

  if (!answer) return null;
  return { answer, sources, method:'vertex-rag' };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

async function handleAsk(question) {
  console.log(`[RAG] "${question}"`);

  // Try Vertex AI first (fast once indexed)
  const vertexResult = await vertexSearch(question).catch(()=>null);
  if (vertexResult) {
    console.log(`[RAG] Answered via ${vertexResult.method} (${vertexResult.sources.length} sources)`);
    return vertexResult;
  }

  // Fall back to local RAG (always works)
  const localResult = await localRagAnswer(question);
  console.log(`[RAG] Answered via ${localResult.method} (${localResult.sources.length} sources)`);
  return localResult;
}

// ─── HTTP server ──────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    const html = fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
    res.writeHead(200,{'Content-Type':'text/html'}); res.end(html); return;
  }

  if (req.method === 'POST' && req.url === '/ask') {
    let body='';
    req.on('data',c=>body+=c);
    req.on('end', async()=>{
      try {
        const {question} = JSON.parse(body);
        if (!question?.trim()) { res.writeHead(400).end(JSON.stringify({error:'Question required'})); return; }
        const result = await handleAsk(question.trim());
        res.writeHead(200,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
        res.end(JSON.stringify(result));
      } catch(e) {
        console.error('[RAG] Error:', e.message);
        res.writeHead(500).end(JSON.stringify({error:e.message}));
      }
    });
    return;
  }

  res.writeHead(404).end('Not found');
});

server.listen(PORT, ()=>{
  console.log(`\nRAG Demo → http://localhost:${PORT}`);
  console.log(`Knowledge: ${KNOWLEDGE_DIR}`);
  console.log(`Vertex AI: projects/${PROJECT}/engines/${ENGINE_ID}`);
  console.log(`Mode: local-gemini-rag (Vertex AI index building in background)\n`);
});

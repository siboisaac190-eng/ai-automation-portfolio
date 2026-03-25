/**
 * Autonomous AI Agent — Goal-Driven Task Executor
 * Plans a list of tasks from a goal, executes each step, reports results.
 * Powered by Gemini AI. Zero npm dependencies.
 *
 * Usage:
 *   GEMINI_API_KEY=your_key node index.js "research Node.js job trends on Upwork"
 */

'use strict';

const https = require('https');

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.5-flash';

// ─── Gemini client ────────────────────────────────────────────────────────────

function gemini(prompt, jsonMode = false) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
        maxOutputTokens: 2048,
      },
    });
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          resolve(jsonMode ? JSON.parse(text) : text);
        } catch (e) {
          reject(new Error('Gemini parse error: ' + e.message));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Agent ────────────────────────────────────────────────────────────────────

class Agent {
  constructor(goal) {
    this.goal = goal;
    this.memory = [];
    this.results = [];
  }

  async plan() {
    console.log(`\nGoal: ${this.goal}`);
    console.log('Planning...\n');
    const plan = await gemini(
      `You are an AI agent. The user's goal is: "${this.goal}"

      Break this into 3-5 concrete, actionable steps. Return JSON:
      { "steps": ["step 1", "step 2", ...] }`,
      true
    );
    this.steps = plan.steps;
    this.steps.forEach((s, i) => console.log(`  Step ${i + 1}: ${s}`));
    return this.steps;
  }

  async executeStep(step, index) {
    console.log(`\n[${index + 1}/${this.steps.length}] Executing: ${step}`);
    const context = this.memory.length
      ? `Previous results:\n${this.memory.join('\n')}\n\n`
      : '';
    const result = await gemini(
      `${context}Goal: ${this.goal}
      Current task: ${step}

      Complete this task. Be specific and actionable. Provide a concrete result or output.`
    );
    this.memory.push(`Step ${index + 1} (${step}): ${result.slice(0, 200)}`);
    this.results.push({ step, result });
    console.log(`  Result: ${result.slice(0, 150)}...`);
    return result;
  }

  async reflect() {
    const summary = await gemini(
      `Goal: ${this.goal}

      Steps completed:
      ${this.results.map((r, i) => `${i + 1}. ${r.step}\n   ${r.result.slice(0, 200)}`).join('\n\n')}

      Write a concise summary of what was accomplished and what the next action should be.`
    );
    return summary;
  }

  async run() {
    await this.plan();
    for (let i = 0; i < this.steps.length; i++) {
      await this.executeStep(this.steps[i], i);
    }
    console.log('\nReflecting on results...\n');
    const summary = await this.reflect();
    console.log('=== AGENT SUMMARY ===');
    console.log(summary);
    return { goal: this.goal, steps: this.results, summary };
  }
}

// ─── Run ──────────────────────────────────────────────────────────────────────

const goal = process.argv[2] || 'Write a plan to get 3 freelance clients this week';
new Agent(goal).run().catch(console.error);

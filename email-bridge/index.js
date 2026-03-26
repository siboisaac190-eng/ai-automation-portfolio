/**
 * AI ↔ AI Email Bridge
 * Two AI systems (Nuri + Claude Code) communicate autonomously via Gmail.
 * Built with Node.js TLS only — no nodemailer, no npm.
 *
 * Flow:
 *   Nuri detects a bug → sends [NURI] email via SMTP
 *   Claude Code reads it via IMAP → fixes the code → replies [CLAUDE]
 *   Nuri picks up the reply → notifies Isaac on Telegram
 *
 * Usage:
 *   GMAIL_ADDRESS=you@gmail.com GMAIL_APP_PASSWORD=xxxx node index.js send
 *   GMAIL_ADDRESS=you@gmail.com GMAIL_APP_PASSWORD=xxxx node index.js check
 */

'use strict';

const tls = require('tls');

const GMAIL  = process.env.GMAIL_ADDRESS;
const PASS   = process.env.GMAIL_APP_PASSWORD;

// ─── SMTP sender (port 465, TLS) ──────────────────────────────────────────────

function sendEmail(subject, body) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: 'smtp.gmail.com', port: 465 }, () => {
      const enc = s => Buffer.from(s).toString('base64');
      let step = 0;

      const commands = [
        `EHLO localhost\r\n`,
        `AUTH LOGIN\r\n`,
        `${enc(GMAIL)}\r\n`,
        `${enc(PASS)}\r\n`,
        `MAIL FROM:<${GMAIL}>\r\n`,
        `RCPT TO:<${GMAIL}>\r\n`,
        `DATA\r\n`,
        [
          `From: Nuri AI <${GMAIL}>`,
          `To: ${GMAIL}`,
          `Subject: ${subject}`,
          ``,
          body,
          `.`,
          ``,
        ].join('\r\n') + '\r\n',
        `QUIT\r\n`,
      ];

      socket.on('data', data => {
        const line = data.toString();
        if (line.startsWith('4') || line.startsWith('5')) {
          reject(new Error(`SMTP error: ${line.trim()}`));
          socket.destroy();
          return;
        }
        if (step < commands.length) socket.write(commands[step++]);
        else { resolve(); socket.destroy(); }
      });
    });

    socket.on('error', reject);
  });
}

// ─── IMAP reader (port 993, TLS) ─────────────────────────────────────────────

function checkInbox(subjectFilter) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: 'imap.gmail.com', port: 993 }, () => {
      let buf = '', seq = 1, messages = [];
      const tag = () => `A${String(seq++).padStart(3, '0')}`;
      const cmd = s => socket.write(`${tag()} ${s}\r\n`);

      socket.on('data', chunk => {
        buf += chunk.toString();
        const lines = buf.split('\r\n');
        buf = lines.pop();

        for (const line of lines) {
          // LOGIN
          if (line.includes('* OK') && seq === 1) cmd(`LOGIN ${GMAIL} "${PASS}"`);
          // SELECT
          if (line.match(/A001 OK/)) cmd('SELECT INBOX');
          // SEARCH
          if (line.match(/A002 OK/)) cmd(`SEARCH UNSEEN SUBJECT "${subjectFilter}"`);
          // FETCH matching messages
          if (line.startsWith('* SEARCH')) {
            const ids = line.replace('* SEARCH', '').trim().split(' ').filter(Boolean);
            if (ids.length) cmd(`FETCH ${ids.join(',')} (BODY[HEADER.FIELDS (SUBJECT FROM DATE)])`);
            else { cmd('LOGOUT'); resolve([]); }
          }
          // Collect headers
          if (line.startsWith('Subject:')) messages.push({ subject: line.slice(9).trim() });
          if (line.match(/A004 OK|A003 OK/)) { cmd('LOGOUT'); resolve(messages); }
          if (line.match(/A\d+ OK LOGOUT/)) socket.destroy();
        }
      });

      socket.on('error', reject);
    });
  });
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

const [,, command] = process.argv;

if (command === 'send') {
  const subject = '[NURI] Bug Fix - Gateway crashed 3 times';
  const body = [
    'FROM: Nuri v29',
    `TIME: ${new Date().toISOString()}`,
    'TASK: Gateway keeps crashing on port 18789',
    'PRIORITY: HIGH',
    'CONTEXT: Crashed 3 times in the last hour. Latest error: ECONNREFUSED',
    '',
    'Please read logs, identify root cause, and push a fix.',
    'Reply with [CLAUDE] subject when done.',
  ].join('\n');

  sendEmail(subject, body)
    .then(() => console.log('Sent:', subject))
    .catch(e => console.error('Failed:', e.message));

} else if (command === 'check') {
  checkInbox('[CLAUDE]')
    .then(msgs => {
      if (!msgs.length) return console.log('No replies yet.');
      msgs.forEach(m => console.log('Reply:', m.subject));
    })
    .catch(e => console.error('Failed:', e.message));

} else {
  console.log('Usage:\n  node index.js send    — Nuri sends bug report\n  node index.js check   — check for Claude replies');
}

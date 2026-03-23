#!/usr/bin/env node

/**
 * Tally Form Stress Tester
 *
 * Submits the form at irregular intervals with random messages.
 *
 * Usage:
 *   node tally-stress-test.mjs                    # 10 submissions, 30s-120s between each
 *   node tally-stress-test.mjs --count 50         # 50 submissions
 *   node tally-stress-test.mjs --min 5 --max 30   # 5s to 30s intervals
 *   node tally-stress-test.mjs --forever           # Run until stopped (Ctrl+C)
 *   node tally-stress-test.mjs --no-confirm        # Skip confirmation prompts (auto-send)
 */

import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

// --- Config ---
const FORM_URL = 'https://tally.so/r/J9LdGJ';

const MESSAGES = [
  "mon IA a répondu au call à ma place et personne s'en est rendu compte",
  "j'ai automatisé mon daily standup, du coup j'ai oublié que le call existait encore",
  "ChatGPT m'a dit que le call était annulé. j'aurais pas dû lui faire confiance",
  "mon bot Slack a accepté une réunion en même temps sans me prévenir",
  "j'ai demandé à mon agent de me réveiller, il a décidé que je méritais de dormir",
  "mon script cron a envoyé mon 'je suis en route' 3h trop tôt, j'ai recru que c'était fait",
  "j'étais en train de debug une boucle infinie dans mon assistant, ça a duré 4h",
  "mon copilot a auto-complété mon message d'excuse avant même que je rate le call",
  "j'ai lancé une automatisation qui a répondu 'bien reçu' à tous mes messages, y compris l'invite",
  "mon IA a résumé le call en 3 lignes, du coup j'ai cru que j'y étais",
];

// --- Parse CLI args ---
const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  if (name === 'forever') return true;
  return Number(args[idx + 1]) || fallback;
}

const COUNT = Math.min(
  getArg('forever', false) ? MESSAGES.length : getArg('count', 10),
  MESSAGES.length,
);
const MIN_DELAY_S = getArg('min', 30);
const MAX_DELAY_S = getArg('max', 120);
const NO_CONFIRM = args.includes('--no-confirm');

// --- Helpers ---
// Shuffle and cycle through messages — never repeat until all have been used
const shuffled = [...MESSAGES].sort(() => Math.random() - 0.5);
let messageIndex = 0;

function randomMessage() {
  const msg = shuffled[messageIndex];
  messageIndex++;
  if (messageIndex >= shuffled.length) {
    console.log('\n   ⚠️  Tous les messages ont été utilisés, fin.');
    process.exit(0);
  }
  return msg;
}

function randomDelay() {
  const ms = (MIN_DELAY_S + Math.random() * (MAX_DELAY_S - MIN_DELAY_S)) * 1000;
  return Math.round(ms);
}

function timestamp() {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

import readline from 'node:readline';

function confirm(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, answer => {
      rl.close();
      const a = answer.trim().toLowerCase();
      resolve(a === 'y' || a === 'o' || a === 'oui' || a === 'yes');
    });
  });
}

// --- Proxy setup ---
function getProxyConfig() {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!proxyUrl) return undefined;
  const m = proxyUrl.match(/^http:\/\/([^:]+):([^@]+)@([^:]+):(\d+)$/);
  if (!m) return undefined;
  return { server: `http://${m[3]}:${m[4]}`, username: m[1], password: m[2] };
}

// --- Submit one form ---
async function submitForm(browser, message) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    await page.goto(FORM_URL, { timeout: 45000, waitUntil: 'load' });
    await page.waitForTimeout(3000);

    // Fill textarea
    const selectors = ['textarea', '[role="textbox"]', '[contenteditable="true"]'];
    let filled = false;
    for (const sel of selectors) {
      const el = await page.$(sel);
      if (el) {
        try { await el.fill(message); } catch { await el.click(); await page.keyboard.type(message); }
        filled = true;
        break;
      }
    }

    if (!filled) throw new Error('No input field found');

    await page.waitForTimeout(500);

    // Click submit
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const b of btns) {
        if (b.textContent?.toLowerCase().includes('envoyer')) { b.click(); return; }
      }
      document.querySelector('button[type="submit"]')?.click();
    });

    await page.waitForTimeout(3000);

    const result = await page.evaluate(() => document.body?.innerText?.substring(0, 200));
    const success = result?.toLowerCase().includes('thank') || result?.toLowerCase().includes('merci');
    return { success, result: result?.split('\n')[0] };
  } finally {
    await context.close();
  }
}

// --- Main loop ---
async function main() {
  const proxyConfig = getProxyConfig();
  console.log(`\n🧪 Tally Form Stress Test`);
  console.log(`   URL: ${FORM_URL}`);
  console.log(`   Submissions: ${COUNT === Infinity ? '∞ (forever)' : COUNT}`);
  console.log(`   Interval: ${MIN_DELAY_S}s - ${MAX_DELAY_S}s (random)`);
  console.log(`   Proxy: ${proxyConfig ? proxyConfig.server : 'none'}`);
  console.log(`   Messages pool: ${MESSAGES.length} variations`);
  console.log(`   Confirm: ${NO_CONFIRM ? 'non (auto-send)' : 'oui (validation avant chaque envoi)'}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    proxy: proxyConfig,
  });

  let successes = 0;
  let failures = 0;

  const shutdown = async () => {
    console.log(`\n\n📊 Results: ${successes} success, ${failures} failed out of ${successes + failures} attempts`);
    await browser.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    for (let i = 1; i <= COUNT; i++) {
      const message = randomMessage();
      const delay = i < COUNT ? randomDelay() : 0;

      console.log(`\n[${timestamp()}] #${i} Message: "${message}"`);
      if (i < COUNT) console.log(`   Prochain envoi dans: ${(delay / 1000).toFixed(0)}s`);

      if (!NO_CONFIRM) {
        const ok = await confirm(`   Envoyer ? (o/n) `);
        if (!ok) {
          console.log(`   ⏭️  Ignoré`);
          continue;
        }
      }

      process.stdout.write(`   Envoi en cours... `);
      try {
        const { success, result } = await submitForm(browser, message);
        if (success) {
          successes++;
          console.log(`✅`);
        } else {
          failures++;
          console.log(`⚠️  (${result})`);
        }
      } catch (err) {
        failures++;
        console.log(`❌ ${err.message}`);
      }

      // Random delay before next submission (skip after last one)
      if (i < COUNT) {
        console.log(`   ⏳ Attente ${(delay / 1000).toFixed(0)}s...`);
        await sleep(delay);
      }
    }
  } finally {
    await shutdown();
  }
}

main();

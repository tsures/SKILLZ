#!/usr/bin/env node
/**
 * מפתח הנושאים הלשוניים ומטבעות הלשון של האקדמיה ללשון העברית.
 *
 * שני דברים נאספים כאן, ושניהם עובדות ולא טקסט:
 *
 * 1. מפתח הנושאים — שם הנושא והכתובת שלו. עד עכשיו כל ממצא הפנה
 *    לשורש האתר, משום שלא רציתי להמציא קישורים עמוקים. עם המפתח
 *    אפשר להפנות לעמוד הנושא עצמו.
 *
 * 2. מטבעות לשון — שמות הניבים שהאקדמיה כתבה עליהם, והכתובת של כל
 *    אחד. אלה צורות ניב מוסמכות שאפשר גם לצטט את מקורן. הכתובת
 *    מקודדת את הניב המנוקד, ולכן די בה — אין צורך לשלוף את הכתבות.
 *
 *   node scripts/harvest-topics.mjs
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'data');
const CACHE_DIR = join(DATA_DIR, 'cache');
const OUT = join(DATA_DIR, 'academy-topics.json');

const PAGES = {
  topics:
    'https://hebrew-academy.org.il/' +
    '%d7%9e%d7%a4%d7%aa%d7%97-%d7%94%d7%a0%d7%95%d7%a9%d7%90%d7%99%d7%9d-' +
    '%d7%94%d7%9c%d7%a9%d7%95%d7%a0%d7%99%d7%99%d7%9d/',
  idioms:
    'https://hebrew-academy.org.il/topic/milim/' +
    '%d7%9e%d7%98%d7%91%d7%a2%d7%95%d7%aa-%d7%9c%d7%a9%d7%95%d7%9f/',
};

const USER_AGENT = 'hebrew-editor-mcp/0.1 (local proofreading tool; polite client)';
const NIQQUD = /[֑-ׇֽֿׁׂׅׄ]/g;

async function getPage(name, url) {
  const cachePath = join(CACHE_DIR, `${name}.html`);
  if (existsSync(cachePath)) return readFileSync(cachePath, 'utf8');
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  const html = await res.text();
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath, html, 'utf8');
  return html;
}

const stripTags = (s) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();

function parseTopics(html) {
  const topics = [];
  const seen = new Set();
  for (const m of html.matchAll(
    /<li class="topics-tree-l2-link">\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g,
  )) {
    const topic = stripTags(m[2]);
    if (!topic || seen.has(topic)) continue;
    seen.add(topic);
    topics.push({ topic, url: m[1] });
  }
  return topics;
}

/**
 * שם הניב מקודד ב־slug של הכתובת, בכתיב מנוקד.
 * כך אפשר לקבל את הצורה המוסמכת בלי לשלוף את גוף הכתבה.
 */
function parseIdioms(html) {
  const out = [];
  const seen = new Set();
  for (const m of html.matchAll(
    /<div class="image-title-item">\s*<a href="([^"]+)"/g,
  )) {
    const url = m[1];
    const slug = url.replace(/\/+$/, '').split('/').pop() ?? '';
    const decoded = decodeURIComponent(slug).replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
    const plain = decoded.replace(NIQQUD, '').trim();
    if (!/^[א-ת' ]+$/.test(plain)) continue;
    if (plain.split(' ').length < 2 || plain.split(' ').length > 7) continue;
    if (seen.has(plain)) continue;
    seen.add(plain);
    out.push({ idiom: plain, vocalized: decoded, url });
  }
  return out;
}

async function main() {
  console.log('שולף את מפתח הנושאים הלשוניים ואת מטבעות הלשון...');

  const topics = parseTopics(await getPage('mafteah', PAGES.topics));
  const idioms = parseIdioms(await getPage('matbeot', PAGES.idioms));

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify({
      source: 'האקדמיה ללשון העברית',
      harvestedAt: new Date().toISOString(),
      notice:
        'שמות נושאים, שמות ניבים וכתובות בלבד. גוף הכתבות אינו נאסף. ' +
        'הזכויות בתוכן שמורות לאקדמיה ללשון העברית.',
      topics,
      idioms,
    }),
    'utf8',
  );

  console.log(`\nנשמר ב־${OUT}`);
  console.table({ 'נושאים': topics.length, 'מטבעות לשון': idioms.length });
  console.log('\nדוגמאות נושאים:', topics.slice(0, 5).map((t) => t.topic).join(' · '));
  console.log('דוגמאות ניבים:', idioms.slice(0, 5).map((i) => i.idiom).join(' · '));
}

main().catch((err) => {
  console.error('השליפה נכשלה:', err.message);
  process.exit(1);
});

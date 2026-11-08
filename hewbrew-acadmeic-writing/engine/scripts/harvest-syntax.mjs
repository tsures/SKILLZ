#!/usr/bin/env node
/**
 * קציר מדור ״תחביר וניסוח״ של האקדמיה ללשון העברית.
 *
 * מה זה עושה
 * ───────────
 * המדור הוא אוסף פסקי לשון קצרים — ״יש או ישנו״, ״הרבה דברים או דברים
 * רבים״, ״רוב האנשים הצביע או הצביעו״ — וכל אחד מהם כלל שאפשר לקודד.
 * הסקריפט אוסף אותם כדי שאפשר יהיה לקרוא אותם ולכתוב מהם כללים.
 *
 *   node scripts/harvest-syntax.mjs
 *   node scripts/harvest-syntax.mjs --category 1271
 *
 * מאיפה
 * ─────
 * אתר האקדמיה בנוי על וורדפרס, וממשק ה־REST שלו פתוח לקריאה. עדיף
 * לקרוא ממנו מאשר לפרק HTML: תשובה אחת מחזירה את כל הקטגוריה בשדות
 * מסודרים, וזה גם עומס קטן בהרבה על השרת. מזהה הקטגוריה נמצא בשאילתה
 * ‎/wp-json/wp/v2/categories?search=…‎ — ״תחביר וניסוח״ הוא 1271.
 *
 * גבולות
 * ──────
 * בקשה אחת לכל עמוד תוצאות, בהשהיה, והתשובות נשמרות במטמון. הפלט
 * נשמר ב־data/ המוחרג מ־git ואינו מופץ. הזכויות בטקסטים שמורות
 * לאקדמיה ללשון העברית; הקובץ משמש קריאה מקומית בלבד, ומה שנכנס
 * לקוד הוא הכלל עצמו בניסוח שלנו.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'data');
const CACHE_DIR = join(DATA_DIR, 'cache-syntax');
const OUT = join(DATA_DIR, 'academy-syntax.json');

const API = 'https://hebrew-academy.org.il/wp-json/wp/v2';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const argv = process.argv.slice(2);
const category = argv.includes('--category') ? argv[argv.indexOf('--category') + 1] : '1271';
const delay = argv.includes('--delay') ? Number(argv[argv.indexOf('--delay') + 1]) : 700;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * הורדה עם מטמון.
 *
 * הבקשות נשלחות ב־curl ולא ב־fetch: השרת מגיש דרך Cloudflare, שדוחה
 * את טביעת ה־TLS של Node גם כשכותרות הבקשה זהות.
 */
function getCached(url) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const key = createHash('sha1').update(url).digest('hex').slice(0, 16);
  const path = join(CACHE_DIR, `${key}.json`);
  if (existsSync(path)) return { body: readFileSync(path, 'utf8'), cached: true };

  const body = execFileSync(
    'curl',
    ['-sS', '-A', USER_AGENT, '--max-time', '60', '--compressed', url],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  writeFileSync(path, body, 'utf8');
  return { body, cached: false };
}

const unescapeHtml = (s) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8216;|&#8217;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));

const toText = (html) =>
  unescapeHtml(
    String(html ?? '')
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<style[\s\S]*?<\/style>/g, '')
      .replace(/<\/(p|div|li|h[1-6])>/g, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

async function main() {
  console.log('קציר מדור ״תחביר וניסוח״ של האקדמיה ללשון העברית');
  console.log('נקרא מממשק ה־REST הפתוח של האתר, לקריאה מקומית בלבד.\n');

  const entries = [];
  for (let page = 1; page <= 20; page++) {
    const url =
      `${API}/posts?categories=${category}&per_page=100&page=${page}` +
      '&_fields=id,link,title,content,date';
    let parsed;
    try {
      const { body, cached } = getCached(url);
      parsed = JSON.parse(body);
      if (!cached) await sleep(delay);
    } catch (err) {
      console.error(`עמוד ${page} נכשל: ${err.message}`);
      break;
    }
    if (!Array.isArray(parsed) || parsed.length === 0) break;

    for (const post of parsed) {
      const title = toText(post.title?.rendered);
      const body = toText(post.content?.rendered);
      if (title && body) entries.push({ id: post.id, title, url: post.link, body });
    }
    console.log(`עמוד ${page}: ${parsed.length} ערכים`);
    if (parsed.length < 100) break;
  }

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        source: 'האקדמיה ללשון העברית — תחביר וניסוח',
        api: `${API}/posts?categories=${category}`,
        harvestedAt: new Date().toISOString(),
        notice:
          'טקסטים שנאספו לקריאה מקומית בלבד. הזכויות שמורות לאקדמיה ' +
          'ללשון העברית. אין להפיץ את הקובץ הזה.',
        entries,
      },
      null,
      1,
    ),
    'utf8',
  );

  console.log(`\nנשמרו ${entries.length} ערכים ב־${OUT}.`);
  console.log('הזכויות שמורות לאקדמיה ללשון העברית. אין להפיץ את data/.');
}

main().catch((err) => {
  console.error('הקציר נכשל:', err.message);
  process.exit(1);
});

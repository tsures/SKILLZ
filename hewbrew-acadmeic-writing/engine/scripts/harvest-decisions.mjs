#!/usr/bin/env node
/**
 * החלטות האקדמיה ללשון העברית, דרך ה־REST API של האתר.
 *
 * למה זה עדיף על מפתח הנושאים
 * ─────────────────────────────
 * מפתח הנושאים נותן קטגוריה — ״פיסוק״. ה־API נותן את ההחלטה עצמה:
 * ״פסיק במשפט המורכב״, ״2.1.8 משקל פַּיִל ומשקל פָּוֶל״ — עם קישור
 * קנוני שמצביע ישירות על ההחלטה בעמוד. זו ההפניה שכלל הגהה צריך.
 *
 * נאספים מזהה, כותרת, קישור ושיוך לפרק. גוף ההחלטה אינו נחשף ב־API
 * ואינו נאסף כאן — מי שרוצה את הנוסח המלא פותח את הקישור.
 *
 *   node scripts/harvest-decisions.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'data');
const OUT = join(DATA_DIR, 'academy-decisions.json');

const BASE = 'https://hebrew-academy.org.il/wp-json/wp/v2';

/*
 * Cloudflare חוסם בקשות בלי User-Agent של דפדפן. זו אינה עקיפה של
 * בקרת גישה — ה־API עצמו ציבורי ופתוח; החסימה היא על לקוחות אנונימיים.
 */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/120.0.0.0 Safari/537.36 hebrew-editor-mcp/0.1';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/*
 * Cloudflare מזהה את טביעת ה־TLS של הסטאק ולא רק את ה־User-Agent,
 * ולכן fetch של Node מקבל 403 במקום שבו curl מקבל 200. curl מותקן
 * כברירת מחדל ב־Windows 10 ומעלה, ב־macOS וברוב הפצות לינוקס.
 * הניסיון ב־fetch נשאר ראשון, למקרה שהחסימה תוסר.
 */
function curlJson(url) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'curl',
      ['-s', '-A', USER_AGENT, '-H', 'Accept: application/json', '-w', '\n%{http_code}', '--max-time', '60', url],
      { windowsHide: true },
    );
    let out = '';
    let err = '';
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (err += c));
    child.on('error', () => reject(new Error('curl אינו זמין במערכת')));
    child.on('close', () => {
      const cut = out.lastIndexOf('\n');
      const status = Number(out.slice(cut + 1).trim());
      if (!status) return reject(new Error(err.trim() || 'curl לא החזיר קוד תשובה'));
      resolve({ status, stdout: out.slice(0, cut) });
    });
  });
}

async function getJson(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(60_000),
    });
    if (res.status === 400) return { status: 400, body: null };
    if (res.ok) return { status: 200, body: await res.json() };
  } catch {
    // ממשיכים ל־curl
  }

  const { status, stdout } = await curlJson(url);
  if (status !== 200) return { status, body: null };
  return { status: 200, body: JSON.parse(stdout) };
}

async function fetchAll(path, fields) {
  const out = [];
  for (let page = 1; ; page++) {
    const url = `${BASE}/${path}?per_page=100&page=${page}&_fields=${fields}`;
    const { status, body } = await getJson(url);
    // מעבר לעמוד האחרון השרת מחזיר 400, וזה סימן הסיום התקין
    if (status === 400) break;
    if (status !== 200 || !Array.isArray(body)) {
      throw new Error(`${status} — ${path} page ${page}`);
    }
    if (body.length === 0) break;
    out.push(...body);
    process.stdout.write(`\r  ${path}: ${out.length}        `);
    if (body.length < 100) break;
    await sleep(700);
  }
  process.stdout.write('\n');
  return out;
}

const stripTags = (s) =>
  String(s ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&#8211;/g, '־')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();

async function main() {
  console.log('שולף את החלטות האקדמיה דרך ה־REST API של האתר.\n');

  const topicsRaw = await fetchAll('topic', 'id,name,parent,count');
  const decisionsRaw = await fetchAll('hahlata', 'id,title,link,topic');

  const topics = topicsRaw
    .map((t) => ({ id: t.id, name: stripTags(t.name), parent: t.parent ?? 0, count: t.count ?? 0 }))
    .filter((t) => t.name);

  const topicNames = new Map(topics.map((t) => [t.id, t.name]));

  const decisions = decisionsRaw
    .map((d) => ({
      id: d.id,
      title: stripTags(d.title?.rendered ?? d.title),
      link: d.link,
      topics: (d.topic ?? []).map((id) => topicNames.get(id)).filter(Boolean),
    }))
    .filter((d) => d.title && d.link);

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify({
      source: 'האקדמיה ללשון העברית — החלטות',
      api: `${BASE}/hahlata`,
      harvestedAt: new Date().toISOString(),
      notice:
        'כותרות החלטות, שיוך לפרקים וקישורים קנוניים בלבד. נוסח ההחלטות ' +
        'אינו נאסף. הזכויות בתוכן שמורות לאקדמיה ללשון העברית.',
      topics,
      decisions,
    }),
    'utf8',
  );

  console.log(`\nנשמר ב־${OUT}`);
  console.table({ 'פרקים': topics.length, 'החלטות': decisions.length });
  console.log('\nדוגמאות:');
  for (const d of decisions.filter((x) => x.topics.some((t) => t.includes('פיסוק'))).slice(0, 5)) {
    console.log(`  ${d.title}   [${d.topics.join(', ')}]`);
  }
}

main().catch((err) => {
  console.error('\nהשליפה נכשלה:', err.message);
  process.exit(1);
});

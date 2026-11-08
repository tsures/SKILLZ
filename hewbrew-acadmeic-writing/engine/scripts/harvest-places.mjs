#!/usr/bin/env node
/**
 * רשימת שמות היישובים בישראל, מאתר האקדמיה ללשון העברית.
 *
 * למה זה נחוץ
 * ────────────
 * שם מקום אינו מילה מילונית, ולכן כל בדיקת כתיב עלולה לסמן אותו
 * כשגיאה: ״כפר סבא״, ״נס ציונה״, ״מעלה אדומים״. הרשימה משמשת
 * רשימת היתר — מה שמופיע בה לעולם אינו מדווח.
 *
 * נאספים שם היישוב בכתיב מלא ובכתיב מנוקד בלבד. אלה עובדות: כך
 * נכתב שם היישוב על פי הקביעה הרשמית.
 *
 *   node scripts/harvest-places.mjs
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'data');
const CACHE = join(DATA_DIR, 'cache', 'yishuvim.html');
const OUT = join(DATA_DIR, 'places.json');

const URL_PAGE =
  'https://hebrew-academy.org.il/' +
  '%d7%a8%d7%a9%d7%99%d7%9e%d7%aa-%d7%a9%d7%9e%d7%95%d7%aa-' +
  '%d7%94%d7%99%d7%99%d7%a9%d7%95%d7%91%d7%99%d7%9d-%d7%91%d7%99%d7%a9%d7%a8%d7%90%d7%9c/';

const USER_AGENT = 'hebrew-editor-mcp/0.1 (local proofreading tool; polite client)';

const NIQQUD = /[֑-ׇֽֿׁׂׅׄ]/g;

function decodeEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&#39;/g, "'")
    .replace(/&#8211;/g, '־')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function getPage() {
  if (existsSync(CACHE)) return readFileSync(CACHE, 'utf8');
  const res = await fetch(URL_PAGE, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const html = await res.text();
  mkdirSync(dirname(CACHE), { recursive: true });
  writeFileSync(CACHE, html, 'utf8');
  return html;
}

async function main() {
  console.log('שולף את רשימת שמות היישובים מאתר האקדמיה...');
  const html = await getPage();

  const names = new Set();
  const vocalized = {};

  for (const row of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) =>
      decodeEntities(m[1].replace(/<[^>]+>/g, '')).trim(),
    );
    if (cells.length < 2) continue;

    const [plene, menukad] = cells;
    if (!plene || plene === 'כתיב מלא') continue;
    // הערות בסוגריים — ״(שבט)״, ״(מושב)״ — אינן חלק מן השם
    const clean = plene.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
    if (!/^[א־-ת'"׳״\-־ ]+$/.test(clean)) continue;

    names.add(clean);
    // כל מילה בשם מצטרפת בנפרד, כדי שגם ״סבא״ שב״כפר סבא״ לא תסומן
    for (const word of clean.split(/[\s־-]+/)) {
      if (word.length >= 2) names.add(word);
    }
    if (menukad) vocalized[clean] = menukad.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  }

  const list = [...names].sort();
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify({
      source: 'רשימת שמות היישובים בישראל, האקדמיה ללשון העברית',
      url: URL_PAGE,
      harvestedAt: new Date().toISOString(),
      count: list.length,
      names: list,
      vocalized,
    }),
    'utf8',
  );

  console.log(`נשמרו ${list.length} שמות ורכיבי שם ב־${OUT}`);
  console.log('דוגמאות:', list.slice(0, 8).join(' · '));
}

main().catch((err) => {
  console.error('השליפה נכשלה:', err.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * איסוף צורות הניב התקניות ממילון הניבים של נעמן (nivon.co.il).
 *
 * מה נאסף ומה לא
 * ────────────────
 * נאספת **כותרת הערך בלבד** — צורת הניב המנוקדת והצורה בכתיב מלא.
 * זו עובדה לשונית: כך נאמר הניב בעברית.
 *
 * לא נאספים ההגדרות, הדוגמאות, הפירושים והמקורות. אלה חיבורו של
 * מחבר המילון, והם ספרו. הכלי הזה אינו מעתיק אותם ואינו מציג אותם.
 *
 * למה בכלל צריך את זה
 * ─────────────────────
 * שיבוש ניב הוא כמעט תמיד שינוי של אות אחת — ״רקם עור וגידים״ במקום
 * ״קרם עור וגידים״ — ולכן בודק איות רגיל אינו תופס אותו. עם רשימת
 * הצורות התקניות אפשר לזהות כל שיבוש כזה לפי מרחק עריכה, ולא רק
 * שיבושים שנרשמו מראש ברשימה ידנית.
 *
 *   node scripts/harvest-idioms.mjs
 *   node scripts/harvest-idioms.mjs --delay 2000
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'data');
const CACHE_DIR = join(DATA_DIR, 'cache-idioms');
const OUT = join(DATA_DIR, 'idioms.json');

const BASE = 'http://www.nivon.co.il/results.asp';
const USER_AGENT = 'hebrew-editor-mcp/0.1 (local proofreading tool; polite crawler)';

const argv = process.argv.slice(2);
const delayIndex = argv.indexOf('--delay');
const DELAY_MS = delayIndex >= 0 ? Number(argv[delayIndex + 1]) : 2000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const NIQQUD = /[֑-ׇֽֿׁׂׅׄ]/g;
const stripNiqqud = (s) => s.replace(NIQQUD, '');

/** האתר מדבר windows-1255, גם בכתובת וגם בגוף התשובה */
function encodeCp1255(text) {
  // הטווח העברי ב־cp1255 הוא רציף ומתחיל ב־0xE0 עבור אל״ף
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code >= 0x05d0 && code <= 0x05ea) {
      out += '%' + (0xe0 + (code - 0x05d0)).toString(16).toUpperCase();
    } else if (code === 0x20) {
      out += '+';
    } else {
      out += encodeURIComponent(ch);
    }
  }
  return out;
}

function decodeCp1255(buffer) {
  let out = '';
  for (const byte of buffer) {
    if (byte >= 0xe0 && byte <= 0xfa) out += String.fromCodePoint(0x05d0 + (byte - 0xe0));
    else if (byte < 0x80) out += String.fromCharCode(byte);
    else out += ' ';
  }
  return out;
}

let requests = 0;

async function fetchLetter(letter) {
  const cachePath = join(CACHE_DIR, `${letter}.txt`);
  if (existsSync(cachePath)) return readFileSync(cachePath, 'utf8');

  if (requests > 0) await sleep(DELAY_MS);
  requests++;

  const res = await fetch(`${BASE}?search=${encodeCp1255(letter)}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const html = decodeCp1255(new Uint8Array(await res.arrayBuffer()));

  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath, html, 'utf8');
  return html;
}

const HEBREW_PHRASE = /^[א-ת֑-ׇ'"׳״\-־ ]+$/;

/**
 * כותרת הערך מופיעה ב־<strong> שאינו אחד מן התוויות הקבועות.
 * נאספת הכותרת בלבד; כל השאר נזרק.
 */
function extractHeadwords(html) {
  const LABELS = new Set(['דוגמה:', 'מקור:', 'דוגמה', 'מקור']);
  const found = new Set();

  for (const m of html.matchAll(/<strong>([^<]{2,80})<\/strong>/g)) {
    const raw = m[1].replace(/&nbsp;/g, ' ').trim();
    if (!raw || LABELS.has(raw)) continue;
    if (!HEBREW_PHRASE.test(raw)) continue;
    const plain = stripNiqqud(raw).replace(/\s+/g, ' ').trim();
    // ניב הוא צירוף: מילה בודדת אינה ניב
    if (plain.split(' ').length < 2) continue;
    if (plain.split(' ').length > 6) continue;
    found.add(plain);
  }
  return [...found];
}

async function main() {
  console.log('איסוף צורות ניב תקניות ממילון הניבים של נעמן.');
  console.log('נאספות כותרות הערכים בלבד — לא הגדרות, לא דוגמאות ולא מקורות.\n');

  const letters = [...'אבגדהוזחטיכלמנסעפצקרשת'];
  const all = new Set();

  for (const [i, letter] of letters.entries()) {
    try {
      const html = await fetchLetter(letter);
      const heads = extractHeadwords(html);
      for (const h of heads) all.add(h);
      process.stdout.write(`\r  ${i + 1}/${letters.length}  «${letter}»  · ${all.size} ניבים        `);
    } catch (err) {
      process.stdout.write(`\n  «${letter}» נכשל: ${err.message}\n`);
    }
  }
  process.stdout.write('\n\n');

  const idioms = [...all].sort();
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify({
      source: 'מילון הניבים של נעמן, nivon.co.il',
      harvestedAt: new Date().toISOString(),
      notice:
        'צורות ניב תקניות בלבד, לזיהוי שיבושים. ההגדרות, הדוגמאות והמקורות ' +
        'שבמילון המקורי אינם נאספים ואינם מופצים. הזכויות במילון שמורות למחברו.',
      count: idioms.length,
      idioms,
    }),
    'utf8',
  );

  console.log(`נשמרו ${idioms.length} צורות ניב ב־${OUT}`);
  console.log('דוגמאות:', idioms.slice(0, 6).join(' · '));
  console.log('\nהזכויות במילון שמורות למחברו. נאספו צורות בלבד.');
}

main().catch((err) => {
  console.error('\nהאיסוף נכשל:', err.message);
  process.exit(1);
});

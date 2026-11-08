#!/usr/bin/env node
/**
 * קציר עובדות ממאגר המונחים של האקדמיה ללשון העברית.
 *
 * מה נאסף ולמה
 * ─────────────
 * לכל ערך במאגר יש שתי צורות זו לצד זו: הצורה המנוקדת והצורה בכתיב מלא.
 * הסרת הניקוד מן הצורה המנוקדת נותנת בדיוק את הכתיב החסר, ולכן כל ערך
 * שבו השניים נבדלים הוא זוג ״כתיב חסר ← כתיב מלא״ שנוצר מן המקור עצמו,
 * ולא מרשימה שנכתבה ביד. בנוסף נאספות המקבילות הלועזיות.
 *
 * גבולות השימוש
 * ──────────────
 * robots.txt של האתר מתיר זחילה (Allow: /) אך קובע במפורש
 * `Content-Signal: ai-train=no, use=reference`, והאתר נושא הודעת
 * ״כל הזכויות שמורות״. לכן:
 *   · שום דבר כאן אינו מאמן מודל.
 *   · הפלט נשמר ב־data/ המוחרג מ־git ואינו נארז בחבילה.
 *   · נאספות עובדות מילוניות בלבד — צורות כתיב ומקבילות מונחים —
 *     ולא טקסטים, הסברים או הגדרות.
 * זהו שימוש עיוני מקומי. אין להפיץ את הקובץ שנוצר.
 *
 * שימוש
 * ─────
 *   node scripts/harvest-academy.mjs               כל המילונים
 *   node scripts/harvest-academy.mjs --limit 10    עשרה מילונים, לבדיקה
 *   node scripts/harvest-academy.mjs --delay 2500  האטה נוספת
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'data');
const CACHE_DIR = join(DATA_DIR, 'cache');
const OUT = join(DATA_DIR, 'academy-terms.json');

const BASE = 'https://terms.hebrew-academy.org.il';
const USER_AGENT =
  'hebrew-editor-mcp/0.1 (local proofreading tool; polite crawler; contact: local user)';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback;
};
const LIMIT = flag('--limit', Infinity);
const DELAY_MS = flag('--delay', 1500);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── שליפה מנומסת עם מטמון ────────────────────────────────────────────────────

let requestCount = 0;

async function fetchCached(url, cacheKey) {
  const cachePath = join(CACHE_DIR, `${cacheKey}.html`);
  if (existsSync(cachePath)) return readFileSync(cachePath, 'utf8');

  // בקשה אחת בכל פעם, עם השהיה — אין סיבה להעמיס על שרת ציבורי
  if (requestCount > 0) await sleep(DELAY_MS);
  requestCount++;

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  const body = await res.text();

  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath, body, 'utf8');
  return body;
}

// ── ניתוח ────────────────────────────────────────────────────────────────────

const NIQQUD = /[֑-ׇֽֿׁׂׅׄ]/g;
const stripNiqqud = (s) => s.replace(NIQQUD, '');
const HEBREW_ONLY = /^[א-ת׳״"'־ \-]+$/;

function decode(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

const stripTags = (s) => decode(s.replace(/<[^>]+>/g, ''));

/** שולף את זוגות ״מנוקד / כתיב מלא״ מתוך מקטע HTML */
function extractPairs(fragment) {
  const groups = fragment.match(
    /<span class="keta_kvutsat-nirdafim">[\s\S]*?(?=<span class="keta_kvutsat-nirdafim">|$)/g,
  );
  if (!groups) return [];

  const pairs = [];
  for (const g of groups) {
    const vocalized = /<span class="keta_munnah-meudkan">([\s\S]*?)<\/span>/.exec(g);
    const plene = /<span class="keta_munnah-ktiv-male">([\s\S]*?)<\/span>/.exec(g);
    if (!vocalized || !plene) continue;
    const v = stripTags(vocalized[1]);
    const p = stripTags(plene[1]);
    if (v && p) pairs.push({ vocalized: v, plene: p });
  }
  return pairs;
}

/** מפרק דף מילון לערכים */
function parseDictionary(htmlText) {
  const entries = [];
  const blocks = htmlText.match(
    /<div class="keta-general-container"[\s\S]*?(?=<div class="keta-general-container"|<footer|$)/g,
  );
  if (!blocks) return entries;

  for (const block of blocks) {
    const subject = /<div class="keta_nose"[^>]*>([\s\S]*?)<\/div>/.exec(block);
    const rtl = /<div class="rtl-dir">([\s\S]*?)<\/div>/.exec(block);
    const ltr = /<div class="ltr-dir">([\s\S]*?)<\/div>/.exec(block);

    const hebrew = rtl ? extractPairs(rtl[1]) : [];
    const foreign = ltr ? extractPairs(ltr[1]).map((p) => p.plene) : [];
    if (hebrew.length === 0) continue;

    entries.push({
      subject: subject ? stripTags(subject[1]) : '',
      hebrew,
      foreign,
    });
  }
  return entries;
}

// ── בניית הלקסיקון ───────────────────────────────────────────────────────────

function build(entries) {
  /** כתיב חסר ← כתיב מלא */
  const ktiv = new Map();
  /** מונח לועזי ← חלופות עבריות */
  const foreign = new Map();
  /** כל צורות הכתיב המלא שנראו — משמש לזיהוי דו־משמעות */
  const pleneForms = new Set();

  for (const entry of entries) {
    for (const { vocalized, plene } of entry.hebrew) {
      if (!HEBREW_ONLY.test(plene)) continue;
      pleneForms.add(plene);

      // מילה בודדת בלבד: בצירופים הכתיב החסר של איבר אחד אינו נגזר נכון
      if (/\s/.test(plene)) continue;

      const deficient = stripNiqqud(vocalized);
      if (!deficient || deficient === plene) continue;
      if (!HEBREW_ONLY.test(deficient)) continue;

      const existing = ktiv.get(deficient);
      if (existing && existing !== plene) {
        // אותו כתיב חסר מוביל לשתי צורות מלאות — אין הכרעה
        ktiv.set(deficient, null);
      } else if (existing === undefined) {
        ktiv.set(deficient, plene);
      }
    }

    for (const term of entry.foreign) {
      if (!/^[A-Za-z][A-Za-z\s\-'.]*$/.test(term)) continue;
      const key = term.toLowerCase();
      const list = foreign.get(key) ?? new Set();
      for (const { plene } of entry.hebrew) {
        if (HEBREW_ONLY.test(plene)) list.add(plene);
      }
      if (list.size) foreign.set(key, list);
    }
  }

  /*
   * כתיב חסר שהוא בעצמו צורת כתיב מלא תקנית של ערך אחר הוא דו־משמעי,
   * ואסור לתקן אותו אוטומטית. זו אותה זהירות שמופעלת ברשימה הידנית,
   * אלא שכאן היא נגזרת מן הנתונים עצמם.
   */
  const unambiguous = {};
  const ambiguous = {};
  for (const [deficient, plene] of ktiv) {
    if (plene === null) continue;
    if (pleneForms.has(deficient)) ambiguous[deficient] = plene;
    else unambiguous[deficient] = plene;
  }

  return {
    ktivMale: unambiguous,
    ktivMaleAmbiguous: ambiguous,
    foreignTerms: Object.fromEntries(
      [...foreign].map(([k, v]) => [k, [...v].slice(0, 4)]),
    ),
  };
}

// ── ריצה ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('קציר עובדות ממאגר המונחים של האקדמיה ללשון העברית');
  console.log('נאספים: זוגות כתיב חסר/מלא ומקבילות מונחים. שום טקסט הסבר.\n');

  const index = await fetchCached(`${BASE}/Millonim`, 'index');
  const ids = [...new Set([...index.matchAll(/ShowMillon\?KodMillon=(\d+)/g)].map((m) => m[1]))];
  console.log(`נמצאו ${ids.length} מילונים.`);

  const selected = ids.slice(0, LIMIT === Infinity ? ids.length : LIMIT);
  console.log(`נשלפים ${selected.length}, בהשהיה של ${DELAY_MS} אלפיות שנייה בין בקשות.\n`);

  const all = [];
  for (const [i, id] of selected.entries()) {
    try {
      const page = await fetchCached(`${BASE}/Millonim/ShowMillon?KodMillon=${id}`, `millon-${id}`);
      const entries = parseDictionary(page);
      all.push(...entries);
      process.stdout.write(
        `\r  ${i + 1}/${selected.length}  מילון ${id}  · ${all.length} ערכים        `,
      );
    } catch (err) {
      process.stdout.write(`\n  מילון ${id} נכשל: ${err.message}\n`);
    }
  }
  process.stdout.write('\n\n');

  const lexicon = build(all);
  const payload = {
    source: 'מאגר המונחים של האקדמיה ללשון העברית',
    url: BASE,
    harvestedAt: new Date().toISOString(),
    dictionaries: selected.length,
    entries: all.length,
    notice:
      'עובדות מילוניות שנאספו לשימוש עיוני מקומי. הזכויות במאגר המקורי ' +
      'שמורות לאקדמיה ללשון העברית. אין להפיץ את הקובץ הזה.',
    ...lexicon,
  };

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload), 'utf8');

  console.log(`נשמר ב־${OUT}`);
  console.table({
    'מילונים': selected.length,
    'ערכים': all.length,
    'זוגות כתיב חסר ← מלא': Object.keys(lexicon.ktivMale).length,
    'זוגות דו־משמעיים': Object.keys(lexicon.ktivMaleAmbiguous).length,
    'מונחים לועזיים': Object.keys(lexicon.foreignTerms).length,
  });
  console.log(
    '\nהזכויות במאגר שמורות לאקדמיה ללשון העברית. הקובץ נשמר ב־data/,',
  );
  console.log('שמוחרג מ־git, ואינו נארז בחבילה. אין להפיץ אותו.');
}

main().catch((err) => {
  console.error('\nהקציר נכשל:', err.message);
  console.error('השרת עובד גם בלי הלקסיקון החיצוני.');
  process.exit(1);
});

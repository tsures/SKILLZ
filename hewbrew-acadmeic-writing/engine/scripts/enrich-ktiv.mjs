#!/usr/bin/env node
/**
 * העשרת לקסיקון הכתיב מ־kalanit, שירות החיפוש של האקדמיה ללשון העברית.
 *
 * מה זה עושה
 * ───────────
 * לכל מילה עברית השירות מחזיר שלוש צורות: המילה כפי שהיא נשמרת במאגר,
 * הכתיב המלא שלה, והצורה המנוקדת. כשהראשונה נבדלת מן השנייה — זה בדיוק
 * זוג ״כתיב חסר ← כתיב מלא״ מוסמך.
 *
 * במקום לנחש אילו מילים כדאי לבדוק, אפשר להריץ את הכלי על המסמכים
 * שלכם עצמכם. כך הלקסיקון לומד בדיוק את אוצר המילים שאתם כותבים בו.
 *
 *   node scripts/enrich-ktiv.mjs --file עבודה.txt
 *   node scripts/enrich-ktiv.mjs --file פרק1.txt --file פרק2.txt
 *   node scripts/enrich-ktiv.mjs --words תכנית,נסיון,בטחון
 *
 * גבולות
 * ──────
 * הבקשות נשלחות אחת־אחת בהשהיה. התוצאה נשמרת ב־data/ המוחרג מ־git.
 * נשמרות צורות כתיב בלבד — לא הגדרות ולא טקסטים.
 * חשוב: הכלי שולח את המילים שבמסמך לשרת של האקדמיה. אם המסמך רגיש,
 * עדיף להריץ אותו על רשימת מילים ולא על הטקסט המלא.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'data');
const OUT = join(DATA_DIR, 'academy-terms.json');

const API = 'https://kalanit.hebrew-academy.org.il/api/Ac/';
const USER_AGENT = 'hebrew-editor-mcp/0.1 (local proofreading tool; polite client)';

// ── ארגומנטים ────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const files = [];
let wordsArg = '';
let delay = 400;

for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--file') files.push(argv[++i]);
  else if (argv[i] === '--words') wordsArg = argv[++i];
  else if (argv[i] === '--delay') delay = Number(argv[++i]);
}

if (files.length === 0 && !wordsArg) {
  console.log('שימוש: node scripts/enrich-ktiv.mjs --file <קובץ> [--file ...] | --words א,ב,ג');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NIQQUD = /[֑-ׇֽֿׁׂׅׄ]/g;
const HEBREW_WORD = /[א-ת]{3,}/g;

/** אותיות שימוש שנקלפות לפני הבדיקה, כדי לבדוק את המילה עצמה */
const PREFIXES = ['ולכש', 'לכש', 'וכש', 'כש', 'ומ', 'וש', 'וה', 'וב', 'ול', 'וכ', 'ה', 'ו', 'ב', 'ל', 'כ', 'מ', 'ש'];

function collectWords() {
  const words = new Set();
  for (const f of files) {
    if (!existsSync(f)) {
      console.error(`הקובץ ${f} לא נמצא — מדולג.`);
      continue;
    }
    const text = readFileSync(f, 'utf8').replace(NIQQUD, '');
    for (const m of text.matchAll(HEBREW_WORD)) words.add(m[0]);
  }
  for (const w of wordsArg.split(',').map((s) => s.trim()).filter(Boolean)) words.add(w);
  return [...words];
}

async function query(word) {
  const res = await fetch(API + '?SearchString=' + encodeURIComponent(word), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * מוציא זוג כתיב חסר/מלא מתשובת השירות.
 * ערכי פועל מדולגים: הכתיב שלהם תלוי בבניין ובגוף, ולא בערך המילוני.
 */
function pairFrom(results, word) {
  if (!Array.isArray(results)) return null;
  for (const item of results) {
    const stored = (item.keywordWithoutNikud || '').trim();
    const plene = (item.ktiv_male || '').trim();
    if (!stored || !plene) continue;
    if (stored.includes('_')) continue; // ערך פועל
    if (/\s/.test(stored) || /\s|,/.test(plene)) continue; // צירוף
    if (stored === plene) continue;
    // רק אם הערך אכן מתאים למילה שחיפשנו, בצורה זו או אחרת
    if (stored !== word && plene !== word) continue;
    return { deficient: stored, plene };
  }
  return null;
}

function loadExisting() {
  if (!existsSync(OUT)) {
    return {
      source: 'שירות החיפוש של האקדמיה ללשון העברית',
      url: API,
      harvestedAt: new Date().toISOString(),
      dictionaries: 0,
      entries: 0,
      notice:
        'צורות כתיב שנאספו לשימוש עיוני מקומי. הזכויות במאגר המקורי ' +
        'שמורות לאקדמיה ללשון העברית. אין להפיץ את הקובץ הזה.',
      ktivMale: {},
      ktivMaleAmbiguous: {},
      foreignTerms: {},
    };
  }
  return JSON.parse(readFileSync(OUT, 'utf8'));
}

async function main() {
  const words = collectWords();
  console.log(`${words.length} מילים ייחודיות לבדיקה.`);
  console.log('הבקשות נשלחות לשרת האקדמיה אחת־אחת. אפשר לעצור בכל רגע.\n');

  const lexicon = loadExisting();
  const known = new Set([
    ...Object.keys(lexicon.ktivMale),
    ...Object.keys(lexicon.ktivMaleAmbiguous),
  ]);

  let added = 0;
  let checked = 0;
  let failed = 0;

  for (const word of words) {
    // מדלגים על מילה שכבר ידועה, ועל צורה שהיא רק אות שימוש ומילה ידועה
    const bare = PREFIXES.reduce(
      (acc, p) => (acc === word && word.startsWith(p) && known.has(word.slice(p.length)) ? word.slice(p.length) : acc),
      word,
    );
    if (known.has(word) || bare !== word) continue;

    checked++;
    try {
      const pair = pairFrom(await query(word), word);
      if (pair && !known.has(pair.deficient)) {
        lexicon.ktivMale[pair.deficient] = pair.plene;
        known.add(pair.deficient);
        added++;
        console.log(`  + ${pair.deficient} ← ${pair.plene}`);
      }
    } catch (err) {
      failed++;
      if (failed <= 3) console.error(`  ! ${word}: ${err.message}`);
    }
    await sleep(delay);
  }

  lexicon.harvestedAt = new Date().toISOString();
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(OUT, JSON.stringify(lexicon), 'utf8');

  console.log(`\nנבדקו ${checked} מילים, נוספו ${added} זוגות כתיב${failed ? `, ${failed} כשלו` : ''}.`);
  console.log(`סך הכול בלקסיקון: ${Object.keys(lexicon.ktivMale).length} זוגות.`);
  console.log('הזכויות במאגר שמורות לאקדמיה ללשון העברית. אין להפיץ את data/.');
}

main().catch((err) => {
  console.error('ההעשרה נכשלה:', err.message);
  process.exit(1);
});

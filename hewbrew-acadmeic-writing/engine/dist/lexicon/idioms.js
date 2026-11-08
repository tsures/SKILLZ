/**
 * מאגר צורות הניב התקניות, וזיהוי שיבוש לפי מרחק עריכה.
 *
 * שיבוש ניב הוא כמעט תמיד שינוי של אות אחת או החלפת סדר של שתיים:
 * ״רקם עור וגידים״ במקום ״קרם עור וגידים״. בודק איות אינו תופס זאת,
 * משום ששתי הצורות מורכבות ממילים קיימות.
 *
 * הקובץ נטען מ־data/idioms.json שנוצר מקומית, ואינו חלק מן המאגר.
 * בהיעדרו הכלל פשוט אינו פעיל.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { academyIdioms } from './topics.js';
const EMPTY = { source: '', idioms: [], index: new Map(), academyUrls: new Map() };
function dataPath() {
    const fromEnv = process.env.HEBREW_EDITOR_IDIOMS_DATA;
    if (fromEnv)
        return resolve(fromEnv);
    const here = dirname(fileURLToPath(import.meta.url));
    return join(here, '..', '..', 'data', 'idioms.json');
}
let cached = null;
export function loadIdioms(force = false) {
    if (cached && !force)
        return cached;
    const path = dataPath();
    try {
        const raw = existsSync(path)
            ? JSON.parse(readFileSync(path, 'utf8'))
            : { idioms: [] };
        /*
         * ניבי האקדמיה מצטרפים לרשימה, ולכל אחד נשמרת הכתובת שלו.
         * הם עדיפים כמקור: הם מוסמכים, ואפשר להפנות אליהם.
         */
        const academyUrls = new Map();
        for (const entry of academyIdioms()) {
            academyUrls.set(entry.idiom, entry.url);
        }
        const all = new Set([...(raw.idioms ?? []), ...academyUrls.keys()]);
        const idioms = [...all].filter((s) => typeof s === 'string' && s.includes(' '));
        const index = new Map();
        for (const [i, idiom] of idioms.entries()) {
            for (const word of idiom.split(' ')) {
                const list = index.get(word) ?? [];
                list.push(i);
                index.set(word, list);
            }
        }
        cached = { source: raw.source ?? 'האקדמיה ללשון העברית', idioms, index, academyUrls };
    }
    catch (err) {
        process.stderr.write(`[hebrew-editor] מאגר הניבים ב־${path} אינו קריא: ${err.message}\n`);
        cached = EMPTY;
    }
    return cached;
}
export function clearIdiomCache() {
    cached = null;
}
/**
 * מרחק דמראו־לוינשטיין: הוספה, מחיקה, החלפה, והחלפת סדר של שתי אותיות
 * סמוכות. החלפת הסדר חיונית כאן, שכן ״רקם״ מול ״קרם״ היא בדיוק זה.
 * החישוב נעצר ברגע שברור שהמרחק גדול מן הסף.
 */
export function damerauLevenshtein(a, b, max) {
    if (Math.abs(a.length - b.length) > max)
        return max + 1;
    let prev2 = [];
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    let cur = [];
    for (let i = 1; i <= a.length; i++) {
        cur = new Array(b.length + 1);
        cur[0] = i;
        let rowMin = cur[0];
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            let value = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                value = Math.min(value, prev2[j - 2] + 1);
            }
            cur[j] = value;
            if (value < rowMin)
                rowMin = value;
        }
        if (rowMin > max)
            return max + 1;
        prev2 = prev;
        prev = cur;
    }
    return prev[b.length];
}
const FINAL_TO_REGULAR = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
function normalizeFinals(word) {
    let out = '';
    for (const ch of word)
        out += FINAL_TO_REGULAR[ch] ?? ch;
    return out;
}
/** אותיות שמשמשות תחיליות וסופיות נטייה */
const INFLECTIONAL_PREFIXES = new Set(['א', 'י', 'ת', 'נ', 'מ', 'ה', 'ו', 'ש', 'ב', 'ל', 'כ']);
const INFLECTIONAL_SUFFIXES = new Set(['ה', 'ו', 'י', 'ת', 'ם', 'ן', 'נ', 'א']);
/**
 * האם שתי המילים הן אותה מילה בנטייה שונה.
 *
 * ״עָשׂוּ״ מול ״עָשָׂה״ נבדלות רק בסופית הנטייה, ולכן ״עשו לילות כימים״
 * הוא הניב התקין בגוף אחר ולא שיבוש. לעומת זאת ״שוקד״ מול ״שוקט״
 * נבדלות באות שאינה סופית נטייה, וזה כן שיבוש.
 */
function isInflectionOf(rawA, rawB) {
    /*
     * האות הסופית חייבת להיות מנורמלת לפני ההשוואה: ״קרמה״ בלי האות
     * האחרונה הוא ״קרמ״, ואילו הצורה הבסיסית נכתבת ״קרם״ במ״ם סופית.
     * בלי הנרמול כל נטייה שנוגעת באות סופית נראית כשיבוש.
     */
    const a = normalizeFinals(rawA);
    const b = normalizeFinals(rawB);
    if (a === b)
        return true;
    // הבדל בסופית בלבד
    if (a.length === b.length) {
        let diffs = 0;
        let lastDiff = -1;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) {
                diffs++;
                lastDiff = i;
            }
        }
        if (diffs !== 1)
            return false;
        const atEnd = lastDiff === a.length - 1;
        const atStart = lastDiff === 0;
        if (atEnd)
            return INFLECTIONAL_SUFFIXES.has(a[lastDiff]) && INFLECTIONAL_SUFFIXES.has(b[lastDiff]);
        if (atStart)
            return INFLECTIONAL_PREFIXES.has(a[0]) && INFLECTIONAL_PREFIXES.has(b[0]);
        return false;
    }
    // מילה אחת ארוכה בתו אחד: תוספת תחילית או סופית נטייה
    const [shortWord, longWord] = a.length < b.length ? [a, b] : [b, a];
    if (longWord.length - shortWord.length !== 1)
        return false;
    if (longWord.slice(1) === shortWord)
        return INFLECTIONAL_PREFIXES.has(longWord[0]);
    if (longWord.slice(0, -1) === shortWord)
        return INFLECTIONAL_SUFFIXES.has(longWord[longWord.length - 1]);
    return false;
}
/**
 * מחפש ניב תקני שהצירוף הנתון קרוב אליו אך אינו זהה לו.
 *
 * הסינון מחמיר בכוונה: אותו מספר מילים, לפחות מחצית המילים זהות,
 * ומרחק עריכה של שתי אותיות לכל היותר. בלי כל אלה כל צירוף בעברית
 * היה נמצא ״קרוב״ לאיזה ניב.
 */
export function findMisquotedIdiom(phrase) {
    const store = loadIdioms();
    if (store.idioms.length === 0)
        return null;
    const words = phrase.split(' ');
    if (words.length < 2 || words.length > 6)
        return null;
    if (phrase.length < 8)
        return null;
    // מועמדים: ניבים שחולקים לפחות מילה אחת עם הצירוף
    const candidates = new Set();
    for (const word of words) {
        for (const i of store.index.get(word) ?? [])
            candidates.add(i);
    }
    if (candidates.size === 0)
        return null;
    const maxDistance = phrase.length >= 14 ? 2 : 1;
    let best = null;
    for (const i of candidates) {
        const canonical = store.idioms[i];
        if (canonical === phrase)
            return null; // הצירוף תקין כפי שהוא
        const canonWords = canonical.split(' ');
        if (canonWords.length !== words.length)
            continue;
        const shared = canonWords.filter((w, k) => w === words[k]).length;
        if (shared * 2 < words.length)
            continue;
        /*
         * אם כל המילים הנבדלות הן אותה מילה בנטייה אחרת, זהו הניב התקין
         * בגוף או במין אחר — ולא שיבוש.
         */
        const differing = canonWords
            .map((w, k) => [w, words[k]])
            .filter(([w, v]) => w !== v);
        if (differing.every(([w, v]) => isInflectionOf(w, v)))
            continue;
        const distance = damerauLevenshtein(phrase, canonical, maxDistance);
        if (distance === 0 || distance > maxDistance)
            continue;
        if (!best || distance < best.distance || (distance === best.distance && shared > best.sharedWords)) {
            best = { canonical, distance, sharedWords: shared, url: store.academyUrls.get(canonical) };
        }
    }
    return best;
}
export function idiomsSummary() {
    const store = loadIdioms();
    if (store.idioms.length === 0) {
        return 'מאגר הניבים אינו טעון. אפשר לייצר אותו בפקודה: npm run harvest:idioms';
    }
    return (`${store.idioms.length} צורות ניב` +
        ` · מהן ${store.academyUrls.size} עם הפניה לאקדמיה`);
}
//# sourceMappingURL=idioms.js.map
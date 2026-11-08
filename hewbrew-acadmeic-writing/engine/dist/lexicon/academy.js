/**
 * טעינת הלקסיקון שנקצר ממאגר המונחים של האקדמיה.
 *
 * הקובץ אינו חלק מן המאגר של הפרויקט. הוא נוצר מקומית על ידי
 * `npm run harvest`, נשמר ב־data/ המוחרג מ־git, ואינו מופץ.
 * בהיעדרו השרת עובד במלואו על הרשימות המובנות.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isCommonWordForm } from './commonWords.js';
const EMPTY = {
    source: '',
    harvestedAt: '',
    dictionaries: 0,
    entries: 0,
    ktivMale: {},
    ktivMaleAmbiguous: {},
    foreignTerms: {},
};
/**
 * סיומות של כינויי קניין ושל גופי העבר.
 *
 * ערך במאגר המונחים עשוי להופיע בצורה נטויה — ״רְאִיָּתִי״ — והכתיב
 * החסר שלו מתנגש אז בצורת פועל שכיחה: ״ראיתי״. הצורות האלה נשמטות,
 * משום שהמאגר אינו כולל נטיית פועל ולכן אינו יכול לזהות את ההתנגשות בעצמו.
 */
const INFLECTION_SUFFIXES = [
    'תי', 'נו', 'תם', 'תן', 'יי', 'יו', 'יה', 'יך',
    'ינו', 'יכם', 'יהם', 'תיו', 'תיה', 'כם', 'הם',
];
/** אורך מזערי: מילים קצרות מתנגשות כמעט תמיד במילה תקנית אחרת */
const MIN_LENGTH = 4;
function isSafeAutoEntry(deficient) {
    if (deficient.length < MIN_LENGTH)
        return false;
    if (/[^א-ת]/.test(deficient))
        return false;
    if (INFLECTION_SUFFIXES.some((s) => deficient.endsWith(s)))
        return false;
    /*
     * הכתיב החסר שנגזר מן המאגר עלול להיות בעצמו מילה עברית רגילה —
     * נטיית פועל, מילת יחס נטויה או שם שכיח. המאגר אינו יכול לזהות את
     * ההתנגשות משום שאין בו נטיית פועל ואין בו מילות תפקוד.
     */
    return !isCommonWordForm(deficient);
}
/** מסנן זוגות שנגזרו אוטומטית ואינם בטוחים דיים לתיקון */
function filterAuto(map) {
    const out = {};
    for (const [deficient, plene] of Object.entries(map)) {
        if (isSafeAutoEntry(deficient))
            out[deficient] = plene;
    }
    return out;
}
function dataPath() {
    const fromEnv = process.env.HEBREW_EDITOR_ACADEMY_DATA;
    if (fromEnv)
        return resolve(fromEnv);
    const here = dirname(fileURLToPath(import.meta.url));
    // dist/lexicon → שורש הפרויקט
    return join(here, '..', '..', 'data', 'academy-terms.json');
}
let cached = null;
export function loadAcademyLexicon(force = false) {
    if (cached && !force)
        return cached;
    const path = dataPath();
    if (!existsSync(path)) {
        cached = EMPTY;
        return cached;
    }
    try {
        const raw = JSON.parse(readFileSync(path, 'utf8'));
        cached = {
            ...EMPTY,
            ...raw,
            ktivMale: filterAuto(raw.ktivMale ?? {}),
            /*
             * הרשימה הדו־משמעית שנגזרה אוטומטית אינה נטענת כלל. בהגדרה הכתיב
             * החסר שלה הוא בעצמו ערך תקני במאגר — ״גדול״, ״מקבל״, ״מדבר״ —
             * ולכן הצעה עליו היא רעש בכל הופעה שנייה. הרשימה הדו־משמעית
             * המובנית שב־knowledge/ktivMale.ts נבדקה ידנית וממשיכה לפעול.
             */
            ktivMaleAmbiguous: {},
            foreignTerms: raw.foreignTerms ?? {},
        };
    }
    catch (err) {
        process.stderr.write(`[hebrew-editor] לקסיקון האקדמיה ב־${path} אינו קריא: ${err.message}\n` +
            '[hebrew-editor] ממשיך עם הרשימות המובנות.\n');
        cached = EMPTY;
    }
    return cached;
}
export function isAcademyLexiconLoaded() {
    return loadAcademyLexicon().entries > 0;
}
export function academyLexiconSummary() {
    const lex = loadAcademyLexicon();
    if (lex.entries === 0) {
        return 'לקסיקון האקדמיה אינו טעון. אפשר לייצר אותו בפקודה: npm run harvest';
    }
    return [
        `מקור: ${lex.source}`,
        `נקצר: ${lex.harvestedAt}`,
        `${lex.dictionaries} מילונים · ${lex.entries} ערכים`,
        `${Object.keys(lex.ktivMale).length} זוגות כתיב חסר ← מלא`,
        `${Object.keys(lex.foreignTerms).length} מונחים לועזיים`,
    ].join('\n');
}
export function clearAcademyCache() {
    cached = null;
}
//# sourceMappingURL=academy.js.map
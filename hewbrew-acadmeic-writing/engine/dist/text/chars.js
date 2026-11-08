/**
 * קבועים ופעולות עזר ברמת התו לעברית.
 *
 * כל הפעולות כאן עובדות על נקודות קוד בודדות ואינן משנות אורך מחרוזת,
 * למעט אלו שמסירות סימני ניקוד — שם האורך משתנה ולכן מוחזרת גם מפת היסטים.
 */
// ── טווחי יוניקוד ────────────────────────────────────────────────────────────
/** אותיות עבריות בסיסיות: א..ת (כולל אותיות סופיות) */
export const HEBREW_LETTER_RE = /[\u05D0-\u05EA]/;
/** סימני ניקוד וטעמים: טעמי המקרא, נקודות, דגש, שין/שׂין, קמץ קטן */
export const NIQQUD_RE = /[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/;
/** ניקוד בלבד, בלי טעמי מקרא */
export const VOWEL_RE = /[\u05B0-\u05BC\u05BF\u05C1\u05C2\u05C7]/;
export const MAQAF = '\u05BE'; // ־ מקף עברי
export const GERESH = '\u05F3'; // ׳ גרש
export const GERSHAYIM = '\u05F4'; // ״ גרשיים
export const SOF_PASUQ = '\u05C3'; // ׃
export const ELLIPSIS = '\u2026'; // …
export const EN_DASH = '\u2013'; // – קו מפריד
export const EM_DASH = '\u2014'; // —
export const NBSP = '\u00A0';
export const RLM = '\u200F';
export const LRM = '\u200E';
export const ZWJ = '\u200D';
export const ZWNJ = '\u200C';
/** תווי בקרת כיווניות שאין להם מקום בטקסט ערוך */
export const BIDI_CONTROL_RE = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/;
// ── ניקוד ─────────────────────────────────────────────────────────────────────
/** שמות סימני הניקוד, לצורכי הודעות והסברים */
export const NIQQUD_NAMES = {
    '\u05B0': 'שווא',
    '\u05B1': 'חטף סגול',
    '\u05B2': 'חטף פתח',
    '\u05B3': 'חטף קמץ',
    '\u05B4': 'חיריק',
    '\u05B5': 'צירה',
    '\u05B6': 'סגול',
    '\u05B7': 'פתח',
    '\u05B8': 'קמץ',
    '\u05B9': 'חולם',
    '\u05BA': 'חולם חסר לוו',
    '\u05BB': 'קובוץ',
    '\u05BC': 'דגש',
    '\u05C1': 'נקודת שין',
    '\u05C2': 'נקודת שׂין',
    '\u05C7': 'קמץ קטן',
};
export const SHVA = '\u05B0';
export const HATAF_SEGOL = '\u05B1';
export const HATAF_PATAH = '\u05B2';
export const HATAF_QAMATS = '\u05B3';
export const HIRIQ = '\u05B4';
export const TSERE = '\u05B5';
export const SEGOL = '\u05B6';
export const PATAH = '\u05B7';
export const QAMATS = '\u05B8';
export const HOLAM = '\u05B9';
export const QUBUTS = '\u05BB';
export const DAGESH = '\u05BC';
export const QAMATS_QATAN = '\u05C7';
export const SHIN_DOT = '\u05C1';
export const SIN_DOT = '\u05C2';
// ── אותיות סופיות ─────────────────────────────────────────────────────────────
const FINAL_TO_REGULAR = {
    '\u05DA': '\u05DB', // ך → כ
    '\u05DD': '\u05DE', // ם → מ
    '\u05DF': '\u05E0', // ן → נ
    '\u05E3': '\u05E4', // ף → פ
    '\u05E5': '\u05E6', // ץ → צ
};
const REGULAR_TO_FINAL = Object.fromEntries(Object.entries(FINAL_TO_REGULAR).map(([final, regular]) => [regular, final]));
export function isHebrewLetter(ch) {
    return HEBREW_LETTER_RE.test(ch);
}
export function isNiqqud(ch) {
    return NIQQUD_RE.test(ch);
}
export function isFinalForm(ch) {
    return ch in FINAL_TO_REGULAR;
}
export function hasFinalForm(ch) {
    return ch in REGULAR_TO_FINAL;
}
/** ך → כ. תו שאינו סופי מוחזר כמות שהוא. */
export function toRegularForm(ch) {
    return FINAL_TO_REGULAR[ch] ?? ch;
}
/** כ → ך. תו שאין לו צורה סופית מוחזר כמות שהוא. */
export function toFinalForm(ch) {
    return REGULAR_TO_FINAL[ch] ?? ch;
}
/**
 * מנרמל מילה לצורת השוואה: מסיר ניקוד, ממיר אותיות סופיות לרגילות.
 * משמש להתאמה מול רשימות מילים שנשמרות בצורה מנורמלת.
 */
export function normalizeForLookup(word) {
    let out = '';
    for (const ch of stripNiqqud(word))
        out += toRegularForm(ch);
    return out;
}
/** מסיר סימני ניקוד וטעמים. */
export function stripNiqqud(text) {
    return text.replace(new RegExp(NIQQUD_RE.source, 'g'), '');
}
/**
 * מסיר ניקוד ומחזיר גם מפה מכל היסט בפלט אל ההיסט המקורי,
 * כדי שכלל שרץ על טקסט מנוקה יוכל לדווח על מיקום בטקסט המקורי.
 */
export function stripNiqqudWithMap(text) {
    let out = '';
    const map = [];
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (isNiqqud(ch))
            continue;
        map.push(i);
        out += ch;
    }
    map.push(text.length); // שומר על תקפות היסט הסיום
    return { text: out, map };
}
/** האם המחרוזת מכילה לפחות אות עברית אחת */
export function containsHebrew(text) {
    return new RegExp(HEBREW_LETTER_RE.source).test(text);
}
/** האם המחרוזת מנוקדת (יש בה לפחות סימן ניקוד אחד) */
export function isVocalized(text) {
    return new RegExp(VOWEL_RE.source).test(text);
}
/**
 * אותיות גרוניות — משפיעות על הניקוד בנטיית הפועל
 * (חטפים במקום שווא נע, פתח גנובה, ואי־קבלת דגש).
 */
export const GUTTURALS = new Set(['\u05D0', '\u05D4', '\u05D7', '\u05E2']); // א ה ח ע
/** ר אינה גרונית ממש אך אינה מקבלת דגש, ולכן מטופלת יחד איתן */
export const NO_DAGESH = new Set(['\u05D0', '\u05D4', '\u05D7', '\u05E2', '\u05E8']); // + ר
/** אותיות בג"ד כפ"ת — מקבלות דגש קל */
export const BEGED_KEFET = new Set([
    '\u05D1', '\u05D2', '\u05D3', '\u05DB', '\u05E4', '\u05EA',
]);
/** אותיות השימוש שיכולות להיצמד לראש מילה: מש"ה וכל"ב */
export const PREFIX_LETTERS = new Set([
    '\u05DE', '\u05E9', '\u05D4', '\u05D5', '\u05DB', '\u05DC', '\u05D1',
]);
/**
 * תווים לטיניים שנראים כמו אותיות עבריות או מתחלפים איתם בהקלדה.
 * שימושי לזיהוי מילה עברית שנשתל בה תו לטיני.
 */
export const LATIN_LOOKALIKES = new Set(['o', 'O', 'p', 'P', 'x', 'X', 'i', 'I', 'l', 'c']);
//# sourceMappingURL=chars.js.map
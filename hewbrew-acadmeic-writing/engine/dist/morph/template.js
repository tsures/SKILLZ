/**
 * מנוע התבניות של הנטייה.
 *
 * תבנית היא מחרוזת שבה הספרות 1, 2, 3, 4 מציינות את אותיות השורש
 * וכל שאר התווים הם אותיות ותנועות קבועות. שני תווי בקרה:
 *
 *   `*`  לפני אות — דגש חזק מפורש (פִּעֵל, נִפְעַל בעתיד).
 *   `^`  אחרי תנועה — אֵם קריאה שמופיעה בכתיב חסר הניקוד בלבד:
 *        חיריק ← יו״ד, חולם חסר ← ו״ו, קובוץ ← ו״ו.
 *   `~`  לפני אות — האות מופיעה בכתיב חסר הניקוד בלבד. משמשת לכפל
 *        יו״ד עיצורית: קְנִיָּה מנוקד מול ״קנייה״ בכתיב מלא.
 *   `-`  אחרי שווא — השווא נע אף שההברה שלפניו נראית סגורה. נחוץ
 *        בצורות שבהן השווא ירש תנועה מלאה, כגון פִּקְדִי, ולכן אין
 *        דגש קל באות שאחריו.
 *
 * כך אותה תבנית מפיקה גם ״דִּבּוּר״ מנוקד וגם ״דיבור״ בכתיב מלא,
 * בלי להחזיק שתי רשימות שעלולות להיפרד זו מזו.
 */
import { BEGED_KEFET, DAGESH, HIRIQ, HOLAM, QUBUTS, SHVA, TSERE, NIQQUD_RE, GUTTURALS, HATAF_PATAH, HATAF_SEGOL, HATAF_QAMATS, PATAH, SEGOL, QAMATS, hasFinalForm, toFinalForm, SHIN_DOT, SIN_DOT, } from '../text/chars.js';
const MATER_FOR_VOWEL = {
    [HIRIQ]: 'י',
    [TSERE]: 'י',
    [HOLAM]: 'ו',
    [QUBUTS]: 'ו',
};
/** ממיר תבנית ושורש לרצף מקטעים */
export function expand(template, radicals) {
    const segments = [];
    let pendingDagesh = false;
    let pendingPlainOnly = false;
    for (const ch of template) {
        if (ch === '*') {
            pendingDagesh = true;
            continue;
        }
        if (ch === '~') {
            pendingPlainOnly = true;
            continue;
        }
        if (ch === '-') {
            const last = segments[segments.length - 1];
            if (last)
                last.shvaNa = true;
            continue;
        }
        if (ch === '^') {
            const last = segments[segments.length - 1];
            if (last)
                last.mater = true;
            continue;
        }
        if (NIQQUD_RE.test(ch)) {
            const last = segments[segments.length - 1];
            if (!last)
                continue;
            if (ch === DAGESH)
                last.dagesh = true;
            else
                last.vowels.push(ch);
            continue;
        }
        const radicalIndex = '1234'.indexOf(ch);
        if (radicalIndex >= 0) {
            const letter = radicals[radicalIndex];
            if (letter === undefined) {
                throw new Error(`התבנית דורשת אות שורש ${ch} אך השורש קצר ממנה`);
            }
            segments.push({
                letter,
                dagesh: pendingDagesh,
                vowels: [],
                mater: false,
                plainOnly: pendingPlainOnly,
                radical: radicalIndex + 1,
            });
            pendingDagesh = false;
            pendingPlainOnly = false;
            continue;
        }
        segments.push({
            letter: ch,
            dagesh: pendingDagesh,
            vowels: [],
            mater: false,
            plainOnly: pendingPlainOnly,
        });
        pendingDagesh = false;
        pendingPlainOnly = false;
    }
    return segments;
}
/** תנועות ארוכות — שווא שבא אחריהן הוא שווא נע */
const LONG_VOWELS = new Set([QAMATS, TSERE, HOLAM]);
/**
 * האם השווא שעל המקטע הוא שווא נח.
 *
 * שווא נח בא אחרי הברה סגורה, כלומר אחרי תנועה קצרה. שלושה מקרים
 * שבהם השווא נע ולכן אינו גורר דגש קל באות שאחריו:
 * בראש מילה, אחרי תנועה ארוכה, ואחרי אות בעלת דגש חזק.
 */
function isShvaNach(segments, index) {
    const seg = segments[index];
    if (!seg.vowels.includes(SHVA))
        return false;
    // שווא שסומן בתבנית כנע במקורו
    if (seg.shvaNa)
        return false;
    // שווא בראש מילה הוא תמיד נע
    if (index === 0)
        return false;
    // שווא תחת אות דגושה בדגש חזק הוא נע
    if (seg.dagesh)
        return false;
    const prev = segments[index - 1];
    // שני שוואים ברצף באמצע מילה: הראשון נח והשני נע
    if (prev.vowels.includes(SHVA))
        return false;
    const prevVowel = prev.vowels.find((v) => v !== SHVA);
    if (prevVowel && LONG_VOWELS.has(prevVowel))
        return false;
    // שורוק וחולם מלאים נכתבים כאם קריאה ולכן אין להם סימן תנועה משלהם
    if (prev.letter === 'ו' && !prevVowel)
        return false;
    return true;
}
/**
 * דגש קל באותיות בג״ד כפ״ת: בראש מילה, ואחרי שווא נח.
 */
function applyDageshQal(segments) {
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (seg.dagesh || !BEGED_KEFET.has(seg.letter))
            continue;
        if (i === 0) {
            seg.dagesh = true;
            continue;
        }
        if (isShvaNach(segments, i - 1))
            seg.dagesh = true;
    }
}
/**
 * אות גרונית אינה נושאת שווא נע אלא חטף.
 * החטף נבחר לפי התנועה שלפני האות הגרונית, בקירוב המקובל.
 */
function applyGutturalHatafs(segments) {
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (!GUTTURALS.has(seg.letter))
            continue;
        if (!seg.vowels.includes(SHVA))
            continue;
        // שווא בסוף מילה הוא נח ונשאר כמות שהוא
        if (i === segments.length - 1)
            continue;
        // רק שווא נע מתחלף בחטף
        if (isShvaNach(segments, i))
            continue;
        const prev = segments[i - 1];
        const prevVowel = prev?.vowels.find((v) => v !== SHVA);
        const hataf = prevVowel === SEGOL || prevVowel === TSERE
            ? HATAF_SEGOL
            : prevVowel === QAMATS || prevVowel === HOLAM
                ? HATAF_QAMATS
                : HATAF_PATAH;
        seg.vowels = seg.vowels.map((v) => (v === SHVA ? hataf : v));
    }
}
/**
 * למ״ד הפועל גרונית (ח, ע) בסוף מילה.
 *
 * שני שינויים כלליים ומאומתים מול לוחות האקדמיה, שורש של״ח:
 *
 * 1. פתח גנובה — גרונית סוגרת מילה אחרי תנועה מלאה מקבלת פתח:
 *    מְשַׁלֵּחַ, מַשְׁלִיחַ, לְהַשְׁלִיחַ, הִשְׁתַּלֵּחַ.
 * 2. נקבת ההווה — הסגולים מתחלפים בפתחים:
 *    מְשַׁלַּחַת ולא ״מְשַׁלֶּחֶת״, נִשְׁלַחַת ולא ״נִשְׁלֶחֶת״.
 *
 * שינויים נוספים בגזרה — הצירי שבציווי ובעתיד נפעל — אינם כלליים
 * באותה מידה, ולכן הבניין נשאר מסומן partial.
 */
function applyFinalGuttural(segments) {
    const last = segments[segments.length - 1];
    if (!last)
        return;
    const isGuttural = (s) => Boolean(s && (s.letter === 'ח' || s.letter === 'ע') && s.radical !== undefined);
    // 1. פתח גנובה
    if (isGuttural(last) && last.vowels.length === 0) {
        /*
         * אם קריאה — היו״ד שב״הִשְׁלִיחַ״ — אינה נושאת תנועה משלה,
         * ולכן מדלגים עליה אל התנועה שהיא מייצגת.
         */
        let i = segments.length - 2;
        while (i > 0 && (segments[i].letter === 'י' || segments[i].letter === 'ו') && segments[i].vowels.length === 0) {
            i--;
        }
        const prevVowel = segments[i]?.vowels.find((v) => v !== SHVA);
        const openers = new Set([TSERE, HIRIQ, HOLAM]);
        if (prevVowel && openers.has(prevVowel))
            last.vowels.push(PATAH);
        return;
    }
    // 2. נקבת ההווה: ־ֶחֶת ← ־ַחַת
    if (last.letter === 'ת' && last.vowels.length === 0) {
        const guttural = segments[segments.length - 2];
        if (!isGuttural(guttural) || !guttural.vowels.includes(SEGOL))
            return;
        guttural.vowels = guttural.vowels.map((v) => (v === SEGOL ? PATAH : v));
        const before = segments[segments.length - 3];
        if (before?.vowels.includes(SEGOL)) {
            before.vowels = before.vowels.map((v) => (v === SEGOL ? PATAH : v));
        }
    }
}
/** אותיות שאינן מקבלות דגש — הדגש נופל, ולעיתים התנועה שלפניו מתארכת */
function relaxDagesh(segments) {
    let changed = false;
    for (const seg of segments) {
        if (!seg.dagesh)
            continue;
        if (!'אהחער'.includes(seg.letter))
            continue;
        seg.dagesh = false;
        changed = true;
    }
    return { changed };
}
/** מרכיב מחרוזת מתוך מקטעים */
export function render(segments, options) {
    // אות שקיימת רק בכתיב המלא אינה משתתפת בחישוב הדגש והחטפים
    const copy = segments
        .filter((s) => !s.plainOnly)
        .map((s) => ({ ...s, vowels: [...s.vowels] }));
    applyDageshQal(copy);
    applyGutturalHatafs(copy);
    applyFinalGuttural(copy);
    relaxDagesh(copy);
    if (options.nikud) {
        let vocalized = '';
        for (const seg of copy) {
            vocalized += seg.letter;
            if (seg.letter === 'ש' && !seg.vowels.some((v) => v === SHIN_DOT || v === SIN_DOT)) {
                vocalized += options.sin ? SIN_DOT : SHIN_DOT;
            }
            if (seg.dagesh)
                vocalized += DAGESH;
            vocalized += seg.vowels.join('');
        }
        return finalizeLetters(vocalized);
    }
    let out = '';
    for (const [i, seg] of segments.entries()) {
        out += seg.letter;
        /*
         * כפל יו״ד עיצורית: פ״א הפועל שהיא יו״ד ונושאת תנועה מלאה
         * באמצע מילה נכתבת בשתי יו״דים בכתיב חסר הניקוד —
         * הִתְיַשֵּׁב ← ״התיישב״, מְיַצֵּג ← ״מייצג״.
         * ההגבלה לאות השורש הראשונה מכוונת: ביו״ד שבמקומות אחרים
         * הכלל אינו חל באותה מידה (חָיָה נכתב ״חיה״ ולא ״חייה״).
         */
        const isConsonantalRootYod = seg.letter === 'י' &&
            seg.radical === 1 &&
            i > 0 &&
            !seg.mater &&
            seg.vowels.some((v) => v !== SHVA);
        if (isConsonantalRootYod)
            out += 'י';
        if (seg.mater) {
            const vowel = seg.vowels.find((v) => v in MATER_FOR_VOWEL);
            if (vowel)
                out += MATER_FOR_VOWEL[vowel];
        }
    }
    return finalizeLetters(out);
}
/** האות האחרונה במילה עוברת לצורתה הסופית */
export function finalizeLetters(word) {
    // סדר יוניקוד קנוני: הדגש והתנועה ממוינים לפי מחלקת הצירוף שלהם,
    // כך שאותה מילה תיוצג תמיד באותו רצף בתים וניתן יהיה להשוות מחרוזות
    const chars = [...word.normalize('NFC')];
    for (let i = chars.length - 1; i >= 0; i--) {
        const ch = chars[i];
        if (NIQQUD_RE.test(ch))
            continue;
        if (hasFinalForm(ch))
            chars[i] = toFinalForm(ch);
        break;
    }
    return chars.join('');
}
/** בונה את שתי הצורות בבת אחת */
export function build(template, radicals, options = {}) {
    const segments = expand(template, radicals);
    return {
        plain: render(segments, { nikud: false }),
        nikud: render(segments, { nikud: true, sin: options.sin }),
    };
}
//# sourceMappingURL=template.js.map
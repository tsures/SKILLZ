/**
 * שגיאות ותיקוני לשון נפוצים.
 *
 * רוב הערכים כאן נשענים על החלטות האקדמיה או על מדורי ההסבר שלה
 * (״למדו לשונכם״, ״רגע של עברית״). ערך שמסומן manual מדווח בלי תיקון
 * אוטומטי, משום שהצורה הנכונה תלויה בהמשך המשפט.
 */
import { academy, convention, regexRule, termRule } from './helpers.js';
const HEB = '\\u05D0-\\u05EA';
const HEB_ANY = '\\u05D0-\\u05EA\\u0591-\\u05C7';
/**
 * מילים הפותחות ביו״ד שאינן פועל בעתיד: בינוני של פ״י בבניין קל,
 * ולצדו שמות תואר ושמות עצם. בלעדיהן הכלל על ״אני י...״ מסמן ״אני יודע״.
 */
const YOD_INITIAL_NON_VERBS = new Set([
    'יודע', 'יודעת', 'יכול', 'יכולה', 'יושב', 'יושבת', 'יוצא', 'יוצאת',
    'יורד', 'יורדת', 'יוצר', 'יוצרת', 'ישן', 'ישנה', 'ירא', 'יראה',
    'יהודי', 'יהודייה', 'ישראלי', 'ישראלית', 'יחיד', 'יחידה', 'יסודי',
    'ידוע', 'ידועה', 'יציב', 'יציבה', 'ישיר', 'ישירה', 'יעיל', 'יעילה',
    'יומי', 'יומית', 'יתום', 'יתומה', 'ירוק', 'ירוקה', 'יקרה', 'ישרה',
    'יחסית', 'יחסי', 'יפהפה', 'יזם', 'יזמית',
]);
/** מיליות שעבוד שנוהגים לחבר אליהן ו״ו במקום שי״ן */
const CONJUNCTION_ERRORS = [
    { avoid: 'היות ו', prefer: 'היות ש', note: 'מילית השעבוד היא שי״ן ולא ו״ו' },
    { avoid: 'מאחר ו', prefer: 'מאחר ש', note: 'מילית השעבוד היא שי״ן ולא ו״ו' },
    { avoid: 'מכיוון ו', prefer: 'מכיוון ש', note: 'מילית השעבוד היא שי״ן ולא ו״ו' },
    { avoid: 'כיוון ו', prefer: 'כיוון ש', note: 'מילית השעבוד היא שי״ן ולא ו״ו' },
    { avoid: 'למרות ו', prefer: 'למרות ש' },
    { avoid: 'בזמן ו', prefer: 'בזמן ש' },
    { avoid: 'במידה ו', prefer: 'אם', note: '״במידה ש״ מציין מידה; לתנאי משמשת המילה ״אם״' },
    { avoid: 'היה ו', prefer: 'אם', note: 'ניסוח משפטי מיושן; בעברית תקנית ״אם״', manual: true, noPrefix: true },
    { avoid: 'באם', prefer: 'אם', note: 'צירוף שאינו תקני' },
    { avoid: 'כמעט ולא', prefer: 'כמעט לא', note: 'הו״ו מיותרת' },
    { avoid: 'כמעט ואין', prefer: 'כמעט אין', note: 'הו״ו מיותרת' },
    { avoid: 'בטרם ו', prefer: 'בטרם' },
];
/** מילות יחס וצירופי קישור */
const CONNECTIVES = [
    { avoid: 'בכדי', prefer: 'כדי', note: '״בכדי״ פירושו לחינם; לציון תכלית משמשת ״כדי״' },
    { avoid: 'בנוסף ל', prefer: 'נוסף על', severity: 'suggestion', manual: true },
    { avoid: 'בנוסף לכך', prefer: 'נוסף על כך', severity: 'suggestion', manual: true },
    { avoid: 'בנוסף', prefer: 'נוסף על כך', severity: 'suggestion', manual: true },
    { avoid: 'אודות', prefer: 'על אודות', note: '״אודות״ אינה עומדת בפני עצמה', manual: true, okAfter: 'על' },
    { avoid: 'בגלל ש', prefer: 'מפני ש', note: '״בגלל״ באה לפני שם עצם, לא לפני פסוקית' },
    { avoid: 'בגלל זה', prefer: 'משום כך', severity: 'suggestion' },
    { avoid: 'למרות ש', prefer: 'אף על פי ש', note: '״למרות״ באה לפני שם עצם', severity: 'suggestion', manual: true },
    { avoid: 'לאור', prefer: 'לנוכח', note: 'תרגום שאילה; ״לנוכח״ או ״בעקבות״ מדויקות יותר', severity: 'suggestion', manual: true },
    { avoid: 'כנגד', prefer: 'נגד', note: '״כנגד״ פירושה מול, לעומת', severity: 'suggestion', manual: true, noPrefix: true },
    { avoid: 'כמו גם', prefer: 'וכן', note: 'תרגום שאילה מאנגלית', severity: 'suggestion', manual: true },
    { avoid: 'מאידך', prefer: 'מנגד', note: 'הצורה המלאה היא ״מאידך גיסא״', severity: 'suggestion', manual: true },
    { avoid: 'מחד', prefer: 'מצד אחד', note: 'הצורה המלאה היא ״מחד גיסא״', severity: 'suggestion', manual: true },
    { avoid: 'יחסית ל', prefer: 'בהשוואה ל', severity: 'suggestion', manual: true },
    { avoid: 'נכון להיום', prefer: 'כיום', severity: 'suggestion', manual: true },
    { avoid: 'על מנת', prefer: 'כדי', severity: 'suggestion', manual: true },
    { avoid: 'מזה שנים', prefer: 'זה שנים', severity: 'suggestion' },
];
/** ״הינו״ ובני משפחתו — אוגד שאינו קיים בעברית תקנית */
const COPULA_ERRORS = [
    { avoid: 'הינו', prefer: 'הוא', note: '״הינו״ אינו אוגד; מקורו בטעות בקריאת ״הנו״' },
    { avoid: 'הינה', prefer: 'היא', note: '״הינה״ אינו אוגד' },
    { avoid: 'הינם', prefer: 'הם', note: '״הינם״ אינו אוגד' },
    { avoid: 'הינן', prefer: 'הן', note: '״הינן״ אינו אוגד' },
    { avoid: 'מהווה', prefer: 'הוא', note: 'לרוב אפשר להסתפק באוגד או להשמיטו', severity: 'suggestion', manual: true },
];
/** מילות יחס קבועות אחרי פעלים ושמות תואר */
const GOVERNMENT_ERRORS = [
    { avoid: 'אחראי על', prefer: 'אחראי ל', note: 'הצירוף התקני הוא ״אחראי ל...״' },
    { avoid: 'אחראית על', prefer: 'אחראית ל' },
    { avoid: 'אחראים על', prefer: 'אחראים ל' },
    { avoid: 'התייחס על', prefer: 'התייחס ל' },
    { avoid: 'להתייחס על', prefer: 'להתייחס ל' },
    { avoid: 'השפיע ל', prefer: 'השפיע על' },
    { avoid: 'להשפיע ל', prefer: 'להשפיע על' },
    { avoid: 'התמקד על', prefer: 'התמקד ב' },
    { avoid: 'להתמקד על', prefer: 'להתמקד ב' },
    { avoid: 'התבסס ל', prefer: 'התבסס על' },
    { avoid: 'דן על', prefer: 'דן ב', manual: true },
    { avoid: 'העדיף על פני', prefer: 'העדיף על', note: '״על פני״ כפילות מיותרת', severity: 'suggestion' },
    { avoid: 'זכאי על', prefer: 'זכאי ל' },
    { avoid: 'ממונה ל', prefer: 'ממונה על' },
];
/** צורות שכתיבן או צורתן אינם תקניים */
const FORM_ERRORS = [
    { avoid: 'הכל', prefer: 'הכול', note: 'האקדמיה קבעה ״הכול״ בכתיב חסר הניקוד' },
    { avoid: 'בסך הכל', prefer: 'בסך הכול' },
    { avoid: 'סך הכל', prefer: 'סך הכול' },
    { avoid: 'ככל הנראה', prefer: 'ככל הנראה', severity: 'style', manual: true },
    { avoid: 'כל שהוא', prefer: 'כלשהו', note: 'נכתב כמילה אחת' },
    { avoid: 'כל שהיא', prefer: 'כלשהי', note: 'נכתב כמילה אחת' },
    { avoid: 'כל שהם', prefer: 'כלשהם' },
    { avoid: 'יותר מידי', prefer: 'יותר מדי', note: '״מדי״ בדל״ת אחת' },
    { avoid: 'מיותר מידי', prefer: 'יותר מדי' },
    { avoid: 'דיי', prefer: 'די', noPrefix: true },
    { avoid: 'בעיקרון', prefer: 'עקרונית', note: 'שיבוש נפוץ של ״עקרונית״ או ״ביסודו של דבר״', severity: 'suggestion', manual: true },
    { avoid: 'לפחות ולא יותר', prefer: 'לכל היותר', manual: true },
];
/** כפל לשון ועודפות */
const REDUNDANCY = [
    { avoid: 'הכי טוב ביותר', prefer: 'הטוב ביותר', note: 'כפל דרגת ההפלגה' },
    { avoid: 'הכי גדול ביותר', prefer: 'הגדול ביותר' },
    { avoid: 'הכי חשוב ביותר', prefer: 'החשוב ביותר' },
    { avoid: 'לחזור שוב', prefer: 'לחזור', note: '״לחזור״ כולל בתוכו את ״שוב״', severity: 'suggestion' },
    { avoid: 'עלה למעלה', prefer: 'עלה', severity: 'suggestion' },
    { avoid: 'ירד למטה', prefer: 'ירד', severity: 'suggestion' },
    { avoid: 'להמשיך הלאה', prefer: 'להמשיך', severity: 'suggestion' },
    { avoid: 'תוכנית עתידית', prefer: 'תוכנית', severity: 'suggestion', manual: true },
    { avoid: 'עובדה קיימת', prefer: 'עובדה', severity: 'suggestion' },
    { avoid: 'בשלב זה של הזמן', prefer: 'בשלב זה', severity: 'suggestion' },
];
export const commonErrorRules = [
    termRule({
        id: 'common/conjunctions',
        category: 'common-errors',
        severity: 'error',
        title: 'מילית שעבוד עם ו״ו במקום שי״ן',
        authority: academy('מילות השעבוד — ״היות ש״, ״מאחר ש״, ״מכיוון ש״'),
        entries: CONJUNCTION_ERRORS,
        allowPrefixes: true,
    }),
    termRule({
        id: 'common/connectives',
        category: 'common-errors',
        severity: 'warning',
        title: 'מילות קישור ומילות יחס',
        authority: academy('שימושי לשון — מילות קישור'),
        entries: CONNECTIVES,
        allowPrefixes: true,
    }),
    termRule({
        id: 'common/copula',
        category: 'common-errors',
        severity: 'error',
        title: '״הינו״ במקום אוגד תקני',
        authority: academy('שימושי לשון — ״הוא״ ולא ״הינו״'),
        entries: COPULA_ERRORS,
    }),
    termRule({
        id: 'common/government',
        category: 'common-errors',
        severity: 'error',
        title: 'מילת היחס הנדרשת אחרי הפועל',
        authority: academy('שימושי לשון — מילות היחס הקבועות של הפועל'),
        entries: GOVERNMENT_ERRORS,
    }),
    termRule({
        id: 'common/forms',
        category: 'common-errors',
        severity: 'warning',
        title: 'צורות כתיב שאינן תקניות',
        authority: academy('כללי הכתיב ושימושי לשון'),
        entries: FORM_ERRORS,
        allowPrefixes: true,
    }),
    termRule({
        id: 'common/redundancy',
        category: 'common-errors',
        severity: 'suggestion',
        title: 'כפל לשון',
        authority: convention('כלכליות הלשון'),
        entries: REDUNDANCY,
    }),
    // ── ״יש את״ / ״אין את״ ────────────────────────────────────────────────────
    regexRule({
        id: 'common/yesh-et',
        category: 'common-errors',
        severity: 'error',
        title: '״את״ אחרי ״יש״ או ״אין״',
        authority: academy('התחביר — ״יש״ ו״אין״ אינם פעלים יוצאים'),
        /*
         * בין ״יש״ ל״את״ עשוי לבוא כינוי שייכות — ״יש לי את הספר״ —
         * ולכן הוא נבלע בתבנית במקום לשבור את ההתאמה.
         */
        pattern: new RegExp(`(?<![${HEB_ANY}])(יש|אין|היה|יהיה|היו)(\\s+ל(?:י|ו|ה|נו|כם|כן|הם|הן|ך))?\\s+את(?![${HEB_ANY}])`),
        message: (m) => `אחרי «${m[1]}» אין מציבים את מילית המושא ״את״ — מה שנראה כמושא הוא בעצם הנושא במשפט.`,
        suggestion: (m) => `${m[1]}${m[2] ?? ''} (בלי ״את״)`,
        replacement: (m) => `${m[1]}${m[2] ?? ''}`,
        autoFixSafe: true,
    }),
    // ── ״את״ לפני שם רבים בלתי מיודע ─────────────────────────────────────────
    regexRule({
        id: 'common/et-indefinite',
        category: 'common-errors',
        severity: 'suggestion',
        title: '״את״ לפני שם שאינו מיודע',
        authority: academy('התחביר — ״את״ באה לפני מושא מיודע בלבד'),
        /*
         * מוגבל בכוונה לשמות ברבים. אחרי ״את״ יכול לבוא שם פרטי מיודע מטבעו
         * (״ראיתי את דוד״), ובלי מילון אין דרך להבחין בו; שם ברבים שאינו מיודע
         * הוא הסימן הבטוח יחסית לשגיאה.
         */
        pattern: new RegExp(`(?<![${HEB_ANY}])את\\s+([${HEB}]{3,}(?:ים|ות))(?![${HEB_ANY}])`),
        message: (m) => {
            const next = m[1];
            // מילה הפותחת בה״א הידיעה מיודעת, וזה בדיוק מה שהכלל דורש
            if (next.startsWith('ה'))
                return null;
            // שמות פרטיים נפוצים שסיומם נראה כרבים
            if (['חיים', 'אפרים', 'מרים', 'ירושלים', 'מצרים', 'אלוהים'].includes(next))
                return null;
            return `מילית המושא ״את״ באה רק לפני מושא מיודע. «${next}» אינו מיודע — צריך «את ה${next}», או ״את״ נשמטת.`;
        },
        suggestion: (m) => `את ה${m[1]}`,
        autoFixSafe: false,
    }),
    // ── ״כמות״ לפני שם ספיר ──────────────────────────────────────────────────
    regexRule({
        id: 'common/kamut-countable',
        category: 'common-errors',
        severity: 'warning',
        title: '״כמות״ לפני שם שאפשר לספור',
        authority: academy('שימושי לשון — ״כמות״ מול ״מספר״'),
        pattern: new RegExp(`(?<![${HEB_ANY}])כמות\\s+(?:של\\s+)?(ה?[${HEB}]{3,}(?:ים|ות))(?![${HEB_ANY}])`),
        message: (m) => `״כמות״ מציינת מידה שאינה נספרת. לפני שם ספיר כמו «${m[1]}» מתאימה המילה ״מספר״.`,
        suggestion: (m) => `מספר ${m[1]}`,
        autoFixSafe: false,
    }),
    // ── ״אלא״ מול ״אלה״ ──────────────────────────────────────────────────────
    regexRule({
        id: 'common/ela-ele',
        category: 'common-errors',
        severity: 'error',
        title: '״אלה״ במקום ״אלא״',
        authority: academy('שימושי לשון — ״אלא״ מילת ניגוד ו״אלה״ כינוי רמז'),
        /*
         * ״אלא״ באה אחרי שלילה ומציינת ניגוד; ״אלה״ היא כינוי רמז לרבים.
         * הדרישה לשלילה קודמת באותו משפט היא מה שהופך את הזיהוי לבטוח:
         * ״אלה הדברים״ תקין לגמרי, ורק ״אינה X אלה Y״ שגוי.
         */
        pattern: new RegExp(`(?<![${HEB_ANY}])(לא|אין|אינו|אינה|אינם|אינן|איננו|איני)\\s+(?:[${HEB}'״"-]+\\s+){0,6}אלה(?=\\s+[${HEB}])`),
        /*
         * ״מה אלה הדברים״ הוא כינוי רמז תקין גם אחרי שלילה, ולכן מילת שאלה
         * צמודה מבטלת את הזיהוי. בלי החרגה כזאת התיקון האוטומטי היה משבש
         * משפט תקין.
         */
        message: (m) => /(?:מה|מי|איזה|איזו|אילו)\s+אלה$/.test(m[0])
            ? null
            : 'אחרי שלילה באה מילת הניגוד ״אלא״, ולא כינוי הרמז ״אלה״.',
        suggestion: 'אלא',
        replacement: (m) => m[0].replace(/אלה$/, 'אלא'),
        autoFixSafe: true,
    }),
    // ── מספרי עשרות מעורבים במין ─────────────────────────────────────────────
    regexRule({
        id: 'common/teen-gender-mix',
        category: 'numbers',
        severity: 'error',
        title: 'ערבוב מין בשם המספר מ־11 עד 19',
        authority: academy('כללי הדקדוק — התאם המין בשם המספר'),
        pattern: new RegExp(`(?<![${HEB_ANY}])(אחד|שנים|שלושה|ארבעה|חמישה|שישה|שבעה|תשעה)\\s+(עשרה)(?![${HEB_ANY}])` +
            `|(?<![${HEB_ANY}])(אחת|שתים|שתיים|שלוש|ארבע|חמש|שש|שבע|תשע)\\s+(עשר)(?![${HEB_ANY}])`),
        message: (m) => {
            const masculine = m[1] !== undefined;
            const unit = masculine ? m[1] : m[3];
            const fixed = masculine ? 'עשר' : 'עשרה';
            return (`«${unit}» ב${masculine ? 'זכר' : 'נקבה'} ואילו «${masculine ? m[2] : m[4]}» ` +
                `ב${masculine ? 'נקבה' : 'זכר'}. שני חלקי שם המספר חייבים להיות באותו מין: «${unit} ${fixed}».`);
        },
        suggestion: (m) => `${m[1] ?? m[3]} ${m[1] !== undefined ? 'עשר' : 'עשרה'}`,
        replacement: (m) => `${m[1] ?? m[3]} ${m[1] !== undefined ? 'עשר' : 'עשרה'}`,
    }),
    // ── ראשי תיבות שנכתבו כמילה ──────────────────────────────────────────────
    termRule({
        id: 'common/acronym-without-gershayim',
        category: 'typography',
        severity: 'warning',
        title: 'ראשי תיבות שנכתבו בלי גרשיים',
        authority: academy('כללי הפיסוק — הגרשיים בראשי תיבות'),
        /*
         * רק ראשי תיבות שהצורה בלי הגרשיים אינה מילה תקנית אחרת.
         * ״דוח״ הושמט בכוונה: הצורה רווחת מאוד ולא אימתתי שהאקדמיה
         * מחייבת גרשיים דווקא. ״עוד״ ו״שח״ הושמטו משום שהן מילים גמורות.
         */
        entries: [
            { avoid: 'תנך', prefer: 'תנ״ך', manual: true },
            { avoid: 'צהל', prefer: 'צה״ל', manual: true },
            { avoid: 'מנכל', prefer: 'מנכ״ל', manual: true },
            { avoid: 'סמנכל', prefer: 'סמנכ״ל', manual: true },
            { avoid: 'ביהס', prefer: 'ביה״ס', manual: true },
            { avoid: 'אחכ', prefer: 'אח״כ', manual: true },
        ],
        allowPrefixes: true,
        message: (entry, matched) => `«${matched}» הוא ראשי תיבות, ולכן נכתב בגרשיים לפני האות האחרונה: «${entry.prefer}».`,
    }),
    // ── גוף ראשון עתיד בצורה דיבורית ─────────────────────────────────────────
    regexRule({
        id: 'common/first-person-future',
        category: 'common-errors',
        severity: 'warning',
        title: 'עתיד מדבר בצורת נסתר',
        authority: academy('נטיית הפועל — עתיד מדבר נפתח באל״ף'),
        pattern: new RegExp(`(?<![${HEB_ANY}])אני\\s+(י[${HEB}]{3,})(?![${HEB_ANY}])`),
        message: (m) => {
            /*
             * ״אני יודע״ הוא בינוני ולא עתיד. הבינוני של פ״י בקל הוא קבוצה סגורה,
             * ולצדה שמות תואר ושמות עצם שפותחים ביו״ד — שניהם צריכים חריגה.
             */
            if (YOD_INITIAL_NON_VERBS.has(m[1]))
                return null;
            return `בעתיד של גוף מדבר הפועל נפתח באל״ף: «אני א${m[1].slice(1)}» ולא «אני ${m[1]}».`;
        },
        suggestion: (m) => `אני א${m[1].slice(1)}`,
        replacement: (m) => `אני א${m[1].slice(1)}`,
        autoFixSafe: true,
    }),
];
//# sourceMappingURL=commonErrors.js.map
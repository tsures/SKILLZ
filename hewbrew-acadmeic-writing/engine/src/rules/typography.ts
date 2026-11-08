/**
 * טיפוגרפיה עברית: גרש וגרשיים, מקף עברי, רווחים, אותיות סופיות,
 * ותווים זרים שנשתלו בטעות בתוך מילה עברית.
 */

import type { Finding, Rule, RuleContext } from '../text/diagnostics.js';
import { makeFinding } from '../text/diagnostics.js';
import { academy, convention, regexRule } from './helpers.js';
import {
  GERESH,
  GERSHAYIM,
  MAQAF,
  isFinalForm,
  hasFinalForm,
  toFinalForm,
  toRegularForm,
} from '../text/chars.js';

const HEB = '\\u05D0-\\u05EA';
const HEB_ANY = '\\u05D0-\\u05EA\\u0591-\\u05C7';

/** קיצורים שסביר שאחריהם יבוא גרש ולא מירכאה בודדת */
const GERESH_ABBREVIATIONS = [
  'עמ', 'מס', 'גב', 'פרופ', 'רח', 'וכו', 'וכד', 'וגו', 'ד', 'ר', 'ש', 'כד',
  'ת', 'א', 'ב', 'ג', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק',
];

/** אותיות שאחריהן גרש מסמן עיצור לועזי: ג׳ירפה, צ׳ק, ז׳אנר */
const FOREIGN_SOUND_LETTERS = 'גזצדת';

export const typographyRules: Rule[] = [
  // ── גרשיים בראשי תיבות ───────────────────────────────────────────────────
  regexRule({
    id: 'typo/gershayim-acronym',
    category: 'typography',
    severity: 'suggestion',
    title: 'ראשי תיבות בגרשיים העבריים ״',
    /*
     * האקדמיה קבעה שראשי תיבות מסומנים בגרשיים ושמקומם לפני האות
     * האחרונה (החלטה 30), אך לא הבחינה בין התו העברי ״ (U+05F4) ובין
     * המירכאה של המקלדת — היא עצמה כותבת צה"ל בטקסט ההחלטה. ההעדפה
     * לתו העברי היא מוסכמה טיפוגרפית, ולכן היא הצעה ולא אזהרה.
     */
    authority: convention('טיפוגרפיה עברית — התו ״ (U+05F4) לראשי תיבות'),
    // מירכאה כפולה בין אותיות עבריות, כשאחריה בדיוק אות אחת: צה"ל, תנ"ך
    pattern: new RegExp(`(?<=[${HEB}])"(?=[${HEB}](?![${HEB_ANY}]))`),
    message:
      'ראשי תיבות מסומנים בגרשיים. התו העברי ״ (U+05F4) עדיף על המירכאה ' +
      'של המקלדת, אף שהאקדמיה לא הבחינה בין השניים.',
    suggestion: 'להחליף לגרשיים עבריים ״',
    replacement: GERSHAYIM,
  }),

  regexRule({
    id: 'typo/gershayim-position',
    category: 'typography',
    severity: 'error',
    title: 'מקום הגרשיים בראשי תיבות — לפני האות האחרונה',
    authority: academy('כללי הפיסוק — הגרשיים באים לפני האות האחרונה'),
    // גרשיים ואחריהם שתי אותיות או יותר, בתוך צירוף שנראה כראשי תיבות
    pattern: new RegExp(`(?<![${HEB_ANY}])([${HEB}])${GERSHAYIM}([${HEB}]{2,3})(?![${HEB_ANY}])`),
    message: (m) =>
      `הגרשיים בראשי תיבות באים לפני האות האחרונה בלבד. הצורה «${m[0]}» מציבה אותם מוקדם מדי.`,
    suggestion: (m) => {
      const letters = m[1] + m[2];
      return letters.slice(0, -1) + GERSHAYIM + letters.slice(-1);
    },
    replacement: (m) => {
      const letters = m[1] + m[2];
      return letters.slice(0, -1) + GERSHAYIM + letters.slice(-1);
    },
    autoFixSafe: true,
  }),

  /*
   * אין כאן כלל על מירכאות מסוג ״.
   *
   * החלטה 26 של האקדמיה מונה שלושה שימושים למירכאות — ציטוט ודיבור ישיר,
   * שם של יצירה או של מוסד, ומילה הזקוקה להבלטה ובייחוד כשאינה משמשת
   * במשמעותה הרגילה (״הציבור ׳מתרשם׳״) — ומסיימת בהערה מפורשת: ״בבחירת
   * סוג המירכאות – כפולות או יחידות – יש מנהגים שונים... האקדמיה לא קבעה
   * מסמרות בעניין זה.״
   *
   * כלל קודם כאן סימן ״מלאכותי״ כשגיאה בטענה שהסימן ״ שמור לראשי תיבות.
   * זו הייתה קביעה שהאקדמיה לא קבעה, והיא גם התעלמה משימוש ההבלטה שהוא
   * בדיוק מה שהמירכאות עשו שם. הכלל הוסר.
   * https://hebrew-academy.org.il/topic/hahlatot/punctuation/#target-3467
   */


  // ── גרש ──────────────────────────────────────────────────────────────────
  regexRule({
    id: 'typo/geresh-abbreviation',
    category: 'typography',
    severity: 'suggestion',
    title: 'גרש בקיצור נכתב בסימן ׳',
    authority: academy('כללי הפיסוק — הגרש בקיצורי מילים'),
    pattern: new RegExp(`(?<![${HEB_ANY}])(${GERESH_ABBREVIATIONS.join('|')})'(?![${HEB}])`),
    message: (m) =>
      `בקיצור «${m[1]}׳» יש להשתמש בגרש עברי ׳ (U+05F3) ולא במירכאה בודדת.`,
    suggestion: (m) => m[1] + GERESH,
    replacement: (m) => m[1] + GERESH,
  }),

  regexRule({
    id: 'typo/geresh-foreign-sound',
    category: 'typography',
    severity: 'suggestion',
    title: 'גרש לציון עיצור לועזי',
    authority: academy('כללי התעתיק — ציון עיצורים לועזיים בגרש'),
    pattern: new RegExp(`(?<![${HEB_ANY}])([${FOREIGN_SOUND_LETTERS}])'(?=[${HEB}])`),
    message: (m) =>
      `לציון העיצור הלועזי אחרי «${m[1]}» יש להשתמש בגרש עברי ׳ ולא במירכאה בודדת.`,
    suggestion: (m) => m[1] + GERESH,
    replacement: (m) => m[1] + GERESH,
  }),

  // ── מקף עברי ─────────────────────────────────────────────────────────────
  regexRule({
    id: 'typo/maqaf-compound',
    category: 'typography',
    severity: 'suggestion',
    title: 'מקף עברי בצירופים',
    authority: academy('כללי הפיסוק — המקף'),
    pattern: new RegExp(`(?<=[${HEB}])-(?=[${HEB}])`),
    message: 'בצירוף עברי יש להשתמש במקף עברי ־ (U+05BE) ולא במקף המקלדת.',
    suggestion: 'מקף עברי ־',
    replacement: MAQAF,
  }),

  regexRule({
    id: 'typo/maqaf-prefix-number',
    category: 'typography',
    severity: 'suggestion',
    title: 'מקף בין אות שימוש לספרה',
    authority: academy('כללי הפיסוק — המקף בין אות שימוש למספר'),
    pattern: new RegExp(`(?<![${HEB_ANY}])([\\u05D1\\u05DE\\u05DC\\u05DB\\u05E9\\u05D4\\u05D5])-(?=[0-9])`),
    message: (m) => `בצירוף «${m[1]}־» עם מספר יש להשתמש במקף עברי ־.`,
    suggestion: (m) => m[1] + MAQAF,
    replacement: (m) => m[1] + MAQAF,
  }),

  // ── רווחים ───────────────────────────────────────────────────────────────
  regexRule({
    id: 'typo/space-before-punctuation',
    category: 'typography',
    severity: 'error',
    title: 'אין רווח לפני סימן פיסוק',
    authority: academy('כללי הפיסוק — סימני הפיסוק נצמדים למילה שלפניהם'),
    pattern: /[ \t]+(?=[,;:!?](?![0-9]))|[ \t]+(?=\.(?![.\d]))/,
    message: 'סימן פיסוק נצמד למילה שלפניו; אין להשאיר רווח לפניו.',
    suggestion: 'להסיר את הרווח',
    replacement: '',
  }),

  regexRule({
    id: 'typo/space-after-punctuation',
    category: 'typography',
    severity: 'error',
    title: 'חסר רווח אחרי סימן פיסוק',
    authority: academy('כללי הפיסוק — אחרי סימן פיסוק בא רווח'),
    pattern: new RegExp(`([,;:!?])(?=[${HEB}A-Za-z])|(?<=[${HEB}]{2})(\\.)(?=[${HEB}A-Za-z])`),
    message: 'אחרי סימן פיסוק יש לבוא רווח.',
    suggestion: 'להוסיף רווח',
    replacement: (m) => `${m[1] ?? m[2]} `,
  }),

  regexRule({
    id: 'typo/double-space',
    category: 'typography',
    severity: 'warning',
    title: 'רווח כפול',
    authority: convention('רווח יחיד בין מילים'),
    pattern: /(?<=\S) {2,}(?=\S)/,
    message: 'יש כאן יותר מרווח אחד בין מילים.',
    suggestion: 'רווח יחיד',
    replacement: ' ',
  }),

  regexRule({
    id: 'typo/trailing-space',
    category: 'typography',
    severity: 'suggestion',
    title: 'רווחים בסוף שורה',
    authority: convention('ניקיון טקסט'),
    pattern: /[ \t]+$/m,
    message: 'רווחים מיותרים בסוף השורה.',
    suggestion: 'להסיר',
    replacement: '',
  }),

  regexRule({
    id: 'typo/space-inside-parentheses',
    category: 'typography',
    severity: 'warning',
    title: 'רווח מיותר בתוך סוגריים',
    authority: convention('הסוגריים נצמדים לתוכן שביניהם'),
    pattern: /\([ \t]+|[ \t]+\)/,
    message: 'הסוגריים נצמדים לטקסט שבתוכם, בלי רווח פנימי.',
    suggestion: 'להסיר את הרווח הפנימי',
    replacement: (m) => (m[0].startsWith('(') ? '(' : ')'),
  }),

  regexRule({
    id: 'typo/nbsp',
    category: 'typography',
    severity: 'suggestion',
    title: 'רווח קשיח שאינו במקומו',
    authority: convention('ניקיון טקסט'),
    pattern: / /,
    message: 'יש כאן רווח קשיח (NBSP). לרוב זו תוצאה של הדבקה ולא כוונה.',
    suggestion: 'רווח רגיל',
    replacement: ' ',
    autoFixSafe: true,
  }),

  // ── סימנים חוזרים ────────────────────────────────────────────────────────
  regexRule({
    id: 'typo/ellipsis',
    category: 'typography',
    severity: 'suggestion',
    title: 'שלוש נקודות נכתבות בתו אחד',
    authority: academy('כללי הפיסוק — שלוש הנקודות'),
    pattern: /\.{3,}/,
    message: 'שלוש נקודות נכתבות בתו הייעודי … ולא בשלוש נקודות נפרדות.',
    suggestion: '…',
    replacement: '…',
  }),

  regexRule({
    id: 'typo/repeated-punctuation',
    category: 'typography',
    severity: 'warning',
    title: 'סימן קריאה או שאלה כפול',
    authority: academy('כללי הפיסוק — סימן שאלה וסימן קריאה'),
    pattern: /!{2,}|\?{2,}/,
    message: (m) =>
      `בכתיבה תקנית סימן ${m[0][0] === '!' ? 'הקריאה' : 'השאלה'} מופיע פעם אחת.`,
    suggestion: (m) => m[0][0],
    replacement: (m) => m[0][0],
  }),

  // ── תווים זרים ───────────────────────────────────────────────────────────
  regexRule({
    id: 'typo/latin-inside-hebrew',
    category: 'typography',
    severity: 'error',
    title: 'תו לטיני בתוך מילה עברית',
    authority: convention('אחידות מערכת הכתב במילה'),
    pattern: new RegExp(`(?<=[${HEB}])([A-Za-z])(?=[${HEB}])`),
    message: (m) =>
      `האות הלטינית «${m[1]}» נמצאת בתוך מילה עברית. לרוב זו תקלת מקלדת.`,
    suggestion: 'להחליף לאות העברית המתאימה',
    autoFixSafe: false,
  }),

  regexRule({
    id: 'typo/bidi-control',
    category: 'typography',
    severity: 'warning',
    title: 'תו בקרת כיווניות',
    authority: convention('ניקיון טקסט'),
    pattern: /[‎‏‪-‮⁦-⁩]/,
    message: 'תו בקרת כיווניות נסתר בטקסט. לרוב הוא מיותר ומשבש עריכה.',
    suggestion: 'להסיר',
    replacement: '',
    autoFixSafe: true,
  }),

  // ── אותיות סופיות ────────────────────────────────────────────────────────
  finalLettersRule(),
];

/**
 * אות סופית באמצע מילה, או אות רגילה במקום סופית בסוף מילה.
 * נבדק על טוקנים ולא בביטוי רגולרי, כי צריך לפצל צירופים מוקפים
 * (עם־הארץ) שבהם ם היא בכל זאת סוף מילה.
 */
function finalLettersRule(): Rule {
  const spec = {
    id: 'typo/final-letters',
    category: 'typography' as const,
    severity: 'error' as const,
  };
  return {
    ...spec,
    title: 'שימוש באות סופית',
    run(ctx: RuleContext): Finding[] {
      const findings: Finding[] = [];
      for (const tok of ctx.doc.tokens) {
        if (tok.kind !== 'hebrew') continue;
        // ראשי תיבות אינם כפופים לכלל: מנכ״ל, ח״כ
        if (tok.text.includes(GERSHAYIM) || tok.text.includes('"')) continue;

        /*
         * מפצלים על מקף וגרש. מקטע שמסתיים במקף הוא מילה שלמה וכפוף
         * לכלל האותיות הסופיות, אבל מקטע שמסתיים בגרש הוא מילה מקוצרת:
         * ״פרופ׳״ הוא ״פרופסור״, והפ״א שלו אינה בסוף המילה. לכן הגרש
         * מסומן, והבדיקה של האות האחרונה מדולגת אחריו.
         */
        const separators = new Set([MAQAF, '-', GERESH, "'"]);
        const abbreviating = new Set([GERESH, "'"]);
        let segStart = 0;
        const segments: Array<{ text: string; offset: number; abbreviated: boolean }> = [];
        for (let i = 0; i <= tok.text.length; i++) {
          if (i === tok.text.length || separators.has(tok.text[i])) {
            if (i > segStart) {
              segments.push({
                text: tok.text.slice(segStart, i),
                offset: segStart,
                abbreviated: i < tok.text.length && abbreviating.has(tok.text[i]),
              });
            }
            segStart = i + 1;
          }
        }

        for (const seg of segments) {
          if (seg.text.length < 2) continue;
          for (let i = 0; i < seg.text.length; i++) {
            const ch = seg.text[i];
            const atEnd = i === seg.text.length - 1;
            const absolute = tok.start + seg.offset + i;

            if (!atEnd && isFinalForm(ch)) {
              findings.push(
                makeFinding(ctx, spec, {
                  start: absolute,
                  end: absolute + 1,
                  message: `האות הסופית «${ch}» מופיעה באמצע המילה «${seg.text}».`,
                  suggestion: `«${toRegularForm(ch)}»`,
                  replacement: toRegularForm(ch),
                  authority: academy('כללי הכתיב — האותיות הסופיות'),
                }),
              );
            } else if (atEnd && !seg.abbreviated && hasFinalForm(ch)) {
              findings.push(
                makeFinding(ctx, spec, {
                  start: absolute,
                  end: absolute + 1,
                  message: `בסוף המילה «${seg.text}» נדרשת האות הסופית «${toFinalForm(ch)}».`,
                  suggestion: `«${toFinalForm(ch)}»`,
                  replacement: toFinalForm(ch),
                  authority: academy('כללי הכתיב — האותיות הסופיות'),
                }),
              );
            }
          }
        }
      }
      return findings;
    },
  };
}

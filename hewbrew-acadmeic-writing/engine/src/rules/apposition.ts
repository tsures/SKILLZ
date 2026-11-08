/**
 * פסיק להפרדת תמורה — כלל 5 בכללי הפיסוק של האקדמיה ללשון העברית.
 *
 * לשון הכלל: ״תמורה תופרד משאר המשפט בפסיק (או בפסיקים)״, ולצידו חריג
 * מפורש: ״אם התמורה קצרה או צמודה במהודק אל שלפניה או כאשר בא שם תפקיד
 * ואחריו שם עצם פרטי – לא תופרד התמורה בפסיקים״.
 *
 * שתי הדוגמאות של האקדמיה מראות את שני הצדדים:
 *   ר׳ אברהם בן עזרא, המדקדק והפרשן הגדול, היה בקי גם בחוכמת התכונה.
 *   נשיא המדינה הראשון ד״ר חיים וייצמן היה מדען חשוב.   ← בלי פסיקים
 *
 * מה הכלל כאן מזהה
 * ─────────────────
 * זיהוי תמורה במלואו מחייב ניתוח תחבירי, ואין כאן כזה. במקומו נבחר חתך
 * צר שאפשר לזהות בוודאות גבוהה: תואר־כבוד ואחריו שם פרטי, ואחריהם שם
 * תפקיד שפותח צירוף, והצירוף נחתם בפועל נטוי שהוא הנשוא של המשפט.
 *
 *   ד״ר אמיר מרצה בפקולטה לתקשורת חזותית בשנקר פרסם דוח.
 *   └תואר┘└שם┘└──────────── התמורה ────────────┘└נשוא┘
 *
 * שלושת התנאים תלויים זה בזה והם שמונעים טעויות:
 *   • הדרישה לפועל נטוי אחרי הצירוף מבחינה בין תמורה ובין נשוא בהווה —
 *     ב״פרופ׳ כהן מנהל את המחלקה״ אין פועל נטוי אחרי ״מנהל״, ולכן ״מנהל״
 *     הוא הנשוא ולא תמורה, והכלל שותק.
 *   • הדרישה שהתמורה תמנה שלוש מילים לפחות מיישמת את חריג ״תמורה קצרה״.
 *   • הסדר תואר־שם־תפקיד מיישם את החריג ההפוך: כשהתפקיד קודם לשם הפרטי
 *     אין כאן התאמה מלכתחילה.
 */

import type { Finding, Rule, RuleContext } from '../text/diagnostics.js';
import type { Token } from '../text/tokenize.js';
import { makeFinding } from '../text/diagnostics.js';
import { academy } from './helpers.js';
import { isFinitePastOrFutureForm } from '../lexicon/commonWords.js';

/** תוארי כבוד שאחריהם בא שם פרטי */
const TITLES = new Set([
  'ד״ר', 'ד"ר', 'דר׳', "דר'", 'פרופ׳', "פרופ'", 'פרופסור', 'דוקטור',
  'עו״ד', 'עו"ד', 'רו״ח', 'רו"ח', 'ח״כ', 'ח"כ', 'מר', 'גב׳', "גב'",
  'הרב', 'השופט', 'השופטת', 'האלוף', 'הניצב', 'הרבנית', 'השר', 'השרה',
]);

/** שמות תפקיד ומקצוע שפותחים תמורה */
const ROLE_NOUNS = new Set([
  'מרצה', 'חוקר', 'חוקרת', 'מנהל', 'מנהלת', 'ראש', 'יו״ר', 'יו"ר',
  'עורך', 'עורכת', 'מומחה', 'מומחית', 'נשיא', 'נשיאת', 'סופר', 'סופרת',
  'עיתונאי', 'עיתונאית', 'רופא', 'רופאה', 'מייסד', 'מייסדת', 'שותף',
  'מנכ״ל', 'מנכ"ל', 'סמנכ״ל', 'סמנכ"ל', 'יועץ', 'יועצת', 'דובר', 'דוברת',
  'נציג', 'נציגה', 'חבר', 'חברת', 'איש', 'אשת', 'מדען', 'מדענית',
  'כלכלן', 'כלכלנית', 'משפטן', 'משפטנית', 'היסטוריון', 'היסטוריונית',
  'בלשן', 'בלשנית', 'פסיכולוג', 'פסיכולוגית', 'אדריכל', 'אדריכלית',
  'מהנדס', 'מהנדסת', 'מפקד', 'מפקדת', 'שגריר', 'שגרירה', 'מבקר', 'מבקרת',
  'בכיר', 'בכירה', 'עובד', 'עובדת', 'מורה', 'מפיק', 'מפיקה', 'במאי',
]);

/** התמורה קצרה מכך אינה מופרדת בפסיקים, לפי החריג בכלל */
const MIN_APPOSITION_WORDS = 3;

/** מרחק מרבי בין פתח התמורה לנשוא, במילים */
const MAX_SPAN = 12;

/** רק מילים: מערך הטוקנים כולל גם רווחים וסימני פיסוק */
function words(ctx: RuleContext): Token[] {
  return ctx.doc.tokens.filter((t) => t.kind === 'hebrew' || t.kind === 'number');
}

export function appositionRule(): Rule {
  const spec = {
    id: 'punct/apposition-commas',
    category: 'punctuation' as const,
    severity: 'error' as const,
  };

  return {
    ...spec,
    title: 'תמורה מופרדת בפסיקים',
    run(ctx: RuleContext): Finding[] {
      const findings: Finding[] = [];
      const list = words(ctx);

      for (let i = 0; i < list.length; i++) {
        const title = list[i];
        if (title.kind !== 'hebrew' || !TITLES.has(title.text)) continue;

        // אחרי התואר בא שם פרטי, ואפשר גם שם משפחה אחריו
        let roleIndex = -1;
        for (let j = i + 2; j <= i + 3 && j < list.length; j++) {
          const tok = list[j];
          if (tok.kind !== 'hebrew' || tok.sentence !== title.sentence) break;
          if (ROLE_NOUNS.has(tok.text)) {
            roleIndex = j;
            break;
          }
        }
        if (roleIndex < 0) continue;

        const name = list[roleIndex - 1];
        if (name.kind !== 'hebrew') continue;

        // הנשוא: הפועל הנטוי הראשון אחרי פתח התמורה
        let verbIndex = -1;
        for (let j = roleIndex + 1; j < list.length && j <= roleIndex + MAX_SPAN; j++) {
          const tok = list[j];
          if (tok.sentence !== title.sentence) break;
          if (tok.kind === 'hebrew' && isFinitePastOrFutureForm(tok.text)) {
            verbIndex = j;
            break;
          }
        }
        if (verbIndex < 0) continue;

        const apposition = list.slice(roleIndex, verbIndex);
        if (apposition.length < MIN_APPOSITION_WORDS) continue;

        const role = list[roleIndex];
        const verb = list[verbIndex];
        const last = apposition[apposition.length - 1];

        const hasOpening = ctx.text.slice(name.end, role.start).includes(',');
        const hasClosing = ctx.text.slice(last.end, verb.start).includes(',');
        if (hasOpening && hasClosing) continue;

        const appositionText = ctx.text.slice(role.start, last.end);
        const missing =
          !hasOpening && !hasClosing
            ? 'שני הפסיקים'
            : hasOpening
              ? 'הפסיק הסוגר'
              : 'הפסיק הפותח';

        findings.push(
          makeFinding(ctx, spec, {
            start: name.start,
            end: verb.start,
            message:
              `«${appositionText}» היא תמורה ל«${name.text}» — היא חוזרת ומזהה אותו ואינה ` +
              `הנשוא. תמורה מופרדת משאר המשפט בפסיקים, וכאן חסר ${missing}.`,
            suggestion: `${name.text}, ${appositionText}, ${verb.text}`,
            replacement: `${name.text}, ${appositionText}, `,
            autoFixSafe: true,
            authority: academy('כללי הפיסוק — פסיק להפרדת תמורה'),
          }),
        );
      }

      return findings;
    },
  };
}

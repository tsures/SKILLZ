/**
 * פסוקיות: זיקה ממשיכה, ופסוקית זמן שאיבדה את הכ״ף.
 *
 * שני הכללים כאן נשענים על אותה הבחנה — מה תפקידה של הפסוקית במשפט —
 * ולכן הם יושבים יחד.
 *
 * פסוקית זיקה (לוואי) מול פסוקית זיקה ממשיכה
 * ────────────────────────────────────────────
 * פסוקית זיקה תקינה היא לוואי של שם עצם, ולפי האקדמיה ״המידע הזה...
 * לא נועד לקדם את סיפור העלילה, אלא הוא מביא מידע הקודם מבחינת הזמן
 * או מבחינה לוגית למידע המסופר במשפט הראשי״:
 *
 *   עדיין לא קראתי את הספר שכולם מדברים עליו.
 *
 * פסוקית זיקה ממשיכה, לעומתה, ״מוסרת מידע חדש – פעולה או מעשה שזמנם
 * לאחר המידע המסופר במשפט הראשי, ולרוב הם אף תוצאה שלו״, ו״ניסוחים
 * מעין אלו אינם תקניים״. התיקון הוא מבנה איחוי:
 *
 *   ראש הממשלה עדכן את השרה שבירכה על ההחלטה.
 *   ← ראש הממשלה עדכן את השרה, והיא בירכה על ההחלטה.
 *
 * מה שאפשר לזהות: שלוש דוגמאות הפתיחה של האקדמיה חולקות מבנה אחד —
 * פועל שיוצר מגע עם מישהו (עדכן, פנה אל, פגע ב), מושא מיודע, ומייד
 * אחריו פסוקית שהפועל בה הוא תגובה בעבר (בירכה, הבטיחה). זה אינו כל
 * מרחב התופעה, אבל זה הגרעין שלה בלשון החדשות, והוא מזוהה בוודאות:
 * פסוקית לוואי אינה מצמצמת שם עצם שכבר מזוהה במלואו, ופועל תגובה
 * בעבר אחרי פועל מגע הוא בהכרח האירוע הבא בתור.
 *
 * מקרה שני שמזוהה בוודאות הוא תואר פועל של תוצאה או הפתעה בתוך
 * הפסוקית — ״שבנס יצא ללא פגע״ — שאין לו מה לחפש בלוואי מצמצם.
 *
 * כְּשֶׁ־ מול שֶׁ־
 * ───────────────
 * ״הרצף כְּשֶׁ־, בדיוק כמו כַּאֲשֶׁר, פותח פסוקית זמן ועונה על השאלה
 * ׳מתי׳. לעומת זאת המילית שֶׁ־ פותחת פסוקיות העשויות לענות על השאלה
 * ׳איזה׳ או ׳מה׳.״ מכאן שלושה תפקידים אפשריים לשֶׁ־, וכל אחד מהם
 * מזוהה לפי מה שעומד לפניו:
 *
 *   איזה  — פסוקית לוואי, ולכן לפניה שם עצם:      הסרט שראינו
 *   מה    — פסוקית תוכן, ולכן לפניה פועל אמירה:   הבטחתי לו שאבוא
 *   קבוע  — מילית שעבוד שנצמד לה שֶׁ־:            אחרי ש, כדי ש, עכשיו ש
 *
 * כשאין לפני שֶׁ־ אף אחד מן השלושה, לא נותר לה תפקיד אחר מלבד פסוקית
 * זמן — וזו צריכה כ״ף. הזיהוי מוגבל לשתי עמדות שבהן אין ספק: בראש
 * משפט, שם אין שם עצם קודם ואין פועל קודם, ואחרי תיאור זמן מפורש
 * (״אתמול שחזרנו הביתה״).
 */

import type { Finding, Rule, RuleContext } from '../text/diagnostics.js';
import type { Token } from '../text/tokenize.js';
import { makeFinding } from '../text/diagnostics.js';
import { academy } from './helpers.js';
import { analyzeVerb } from '../morph/analyze.js';
import { isFinitePastOrFutureForm } from '../lexicon/commonWords.js';
import { guessNounGender } from '../knowledge/nounGender.js';

const ZIKA_URL =
  'https://hebrew-academy.org.il/' +
  '%d7%a4%d7%a1%d7%95%d7%a7%d7%99%d7%aa-%d7%96%d7%99%d7%a7%d7%94-' +
  '%d7%9e%d7%9e%d7%a9%d7%99%d7%9b%d7%94/';

const KSHE_URL =
  'https://hebrew-academy.org.il/' +
  '%d7%9b%d6%b0%d6%bc%d7%a9%d6%b6%d7%81%d6%be-%d7%95%d7%9c%d7%90-%d7%a9%d6%b6%d7%81%d6%be/';

/** שורשים של פעלים שיוצרים מגע עם גורם, ומזמינים ממנו תגובה */
const CONTACT_ROOTS = new Set([
  'עדכנ', 'פנה', 'פגע', 'הודיע', 'ידע', 'שאל', 'בקש', 'בקשׁ', 'תבע',
  'כתב', 'שלח', 'הגיש', 'מסר', 'זמנ', 'קרא', 'התקשר', 'קשר', 'אשמ',
  'דוח', 'צלצל', 'טלפנ', 'הזהיר', 'זהר', 'הציג', 'יצג', 'עתר',
]);

/** שורשים של פעלים שמציינים תגובה — הם באים אחרי המגע, לא לפניו */
const REACTION_ROOTS = new Set([
  'ברכ', 'בטח', 'ידע', 'שוב', 'ענה', 'סרב', 'סכמ', 'נצל', 'גנה',
  'גוב', 'אשר', 'דחה', 'טענ', 'קבע', 'חלט', 'ירה', 'הבטיח', 'הגיב',
  'התנצל', 'סירב', 'אישר', 'הכחיש', 'כחש', 'התחייב', 'חיב', 'הודה', 'ידה',
]);

/** תוארי פועל של תוצאה או הפתעה — אין להם מקום בלוואי מצמצם */
const CONSEQUENCE_ADVERBS = new Set([
  'בנס', 'לבסוף', 'לימים', 'בהמשך', 'מיד', 'מייד', 'לאחר', 'בעקבות',
  'כתוצאה', 'למרבה', 'למזלו', 'למזלה', 'לצערו', 'לצערה', 'לשמחתו', 'לשמחתה',
]);

/** מיליות שעבוד ומילים שנצמד להן שֶׁ־ כדין */
const SHE_HOSTS = new Set([
  'אחרי', 'לפני', 'מפני', 'משום', 'כדי', 'למרות', 'בזמן', 'בשעה', 'ברגע',
  'כיוון', 'מכיוון', 'במידה', 'ככל', 'עד', 'מאז', 'בעוד', 'אף', 'אלא',
  'כמו', 'כפי', 'יותר', 'פחות', 'מבלי', 'בלי', 'תוך', 'בגלל', 'עכשיו',
  'כעת', 'היות', 'בהיות', 'חוץ', 'מלבד', 'זה', 'מה', 'מי', 'כל', 'רק',
  'גם', 'ככה', 'כך', 'כמה', 'מרגע', 'מתוך', 'למקרה', 'בתנאי', 'ובלבד',
  'אלמלא', 'כאילו', 'הרי', 'ייתכן', 'יתכן', 'ברור', 'ידוע', 'מסתבר',
  'נראה', 'חבל', 'כדאי', 'ראוי', 'חשוב', 'מוטב', 'צריך', 'אפשר', 'מותר',
]);

/** תיאורי זמן שאחריהם פסוקית ש־ היא בהכרח פסוקית זמן */
const TIME_ADVERBS = new Set([
  'אתמול', 'מחר', 'שלשום', 'מחרתיים', 'הבוקר', 'הערב', 'הלילה', 'היום',
  'בבוקר', 'בערב', 'בלילה', 'בצהריים', 'אמש', 'לפנות',
]);

/** שורש הניתוח הראשון והאמין ביותר של הצורה, אם יש כזה */
function verbRoots(word: string, tense?: 'past' | 'future'): Set<string> {
  const roots = new Set<string>();
  for (const analysis of analyzeVerb(word)) {
    if (analysis.accuracy === 'approx') continue;
    if (tense && analysis.tense !== tense) continue;
    roots.add(analysis.root.join(''));
  }
  return roots;
}

function hasRoot(word: string, set: Set<string>, tense?: 'past' | 'future'): boolean {
  for (const root of verbRoots(word, tense)) if (set.has(root)) return true;
  return false;
}

function words(ctx: RuleContext): Token[] {
  return ctx.doc.tokens.filter((t) => t.kind === 'hebrew' || t.kind === 'number');
}

/** כינוי הגוף שיחליף את שם העצם במבנה האיחוי */
function pronounFor(noun: string): string {
  const bare = noun.replace(/^ה/, '');
  const guess = guessNounGender(bare);
  if (guess.plural) return guess.gender === 'f' ? 'הן' : 'הם';
  return guess.gender === 'f' ? 'היא' : 'הוא';
}

/** ראש הממשלה עדכן את השרה שבירכה ← ..., והיא בירכה */
function continuativeRelativeRule(): Rule {
  const spec = {
    id: 'syntax/continuative-relative',
    category: 'syntax' as const,
    severity: 'error' as const,
  };

  return {
    ...spec,
    title: 'פסוקית זיקה ממשיכה',
    run(ctx: RuleContext): Finding[] {
      const findings: Finding[] = [];
      const list = words(ctx);

      for (let i = 2; i < list.length; i++) {
        const tok = list[i];
        if (tok.kind !== 'hebrew') continue;

        // הפסוקית נפתחת ב״ש־״ צמודה או במילה ״אשר״
        const isAsher = tok.text === 'אשר';
        const clauseHead = isAsher ? list[i + 1] : tok;
        if (!clauseHead || clauseHead.kind !== 'hebrew') continue;
        if (!isAsher && !tok.text.startsWith('ש')) continue;
        const inner = isAsher ? clauseHead.text : tok.text.slice(1);
        if (inner.length < 3) continue;

        const head = list[i - 1];
        if (head.kind !== 'hebrew' || head.sentence !== tok.sentence) continue;

        /*
         * שני מסלולי זיהוי. הראשון: תואר פועל של תוצאה בתוך הפסוקית.
         * השני: פועל מגע במשפט הראשי ופועל תגובה בעבר בפסוקית, ושם
         * העצם שביניהם מיודע — לוואי מצמצם אינו מצמצם מזוהה־כבר.
         */
        const byAdverb = CONSEQUENCE_ADVERBS.has(inner);

        let byReaction = false;
        if (!byAdverb && hasRoot(inner, REACTION_ROOTS, 'past')) {
          for (let j = i - 2; j >= 0 && list[j].sentence === tok.sentence; j--) {
            if (list[j].kind === 'hebrew' && hasRoot(list[j].text, CONTACT_ROOTS)) {
              byReaction = true;
              break;
            }
          }
        }
        if (!byAdverb && !byReaction) continue;

        // סוף הפסוקית: סוף המשפט או סימן פיסוק
        const clauseStart = isAsher ? tok.start : tok.start + 1;
        const sentence = ctx.doc.sentences[tok.sentence];
        const rest = ctx.text.slice(clauseStart, sentence.end).replace(/[.!?…\s]+$/, '');

        const connective = byAdverb ? 'אך' : 'ו';
        /*
         * במסלול תואר הפועל אין מוסיפים כינוי: הנושא נשמר מן המשפט
         * הראשון, כמו בתיקון של האקדמיה — ״אך בנס יצא ללא פגע״. הראש
         * שם הוא ״רוכב אופניים״ ולא ״אופניים״, ואי אפשר לגזור ממנו
         * כינוי בלי לזהות את צירוף הסמיכות.
         */
        const body = rest.replace(/^ש/, '');
        const fixed = byAdverb
          ? `${head.text}, ${connective} ${body}`
          : `${head.text}, ${connective}${pronounFor(head.text)} ${body}`;

        findings.push(
          makeFinding(ctx, spec, {
            start: head.start,
            end: sentence.end,
            message:
              `הפסוקית «${rest}» מוסרת אירוע שקרה אחרי המסופר במשפט הראשי, ולרוב כתוצאה ממנו. ` +
              'פסוקית לוואי מביאה מידע הקודם בזמן או בהיגיון, ולכן זו אינה לוואי אלא המשך — ' +
              'ויש לנסח אותה כמשפט מאוחה.',
            suggestion: fixed,
            replacement: byAdverb ? undefined : `${fixed}.`,
            autoFixSafe: false,
            authority: academy('תחביר וניסוח — פסוקית זיקה ממשיכה', ZIKA_URL),
          }),
        );
      }

      return findings;
    },
  };
}

/** שנגיע לגשר ← כשנגיע לגשר */
function timeClauseRule(): Rule {
  const spec = {
    id: 'syntax/time-clause-kshe',
    category: 'syntax' as const,
    severity: 'error' as const,
  };

  return {
    ...spec,
    title: 'פסוקית זמן נפתחת בכְּשֶׁ־',
    run(ctx: RuleContext): Finding[] {
      const findings: Finding[] = [];
      const list = words(ctx);

      for (let i = 0; i < list.length; i++) {
        const tok = list[i];
        if (tok.kind !== 'hebrew' || !tok.text.startsWith('ש')) continue;
        const inner = tok.text.slice(1);
        if (inner.length < 3) continue;

        /*
         * ״שימוש״, ״שאלה״, ״שונה״, ״שירותי״, ״שלושה״ אינן שֶׁ־ + פועל אלא
         * מילים גמורות שפותחות בשי״ן. הנתח המורפולוגי לבדו מזהה בהן פועל
         * (״ימוש״, ״לושה״, ״אלה״), ולכן נדרש שמה שאחרי השי״ן יהיה פועל
         * מוטה בעבר או בעתיד — מה שאינו נכון באף אחת מהן.
         */
        if (!isFinitePastOrFutureForm(inner)) continue;
        // הפסוקית חייבת להיפתח בפועל
        if (analyzeVerb(inner).every((a) => a.accuracy === 'approx')) continue;

        const prev = list[i - 1];
        const atSentenceStart = !prev || prev.sentence !== tok.sentence;

        /*
         * בראש משפט אין שם עצם קודם ואין פועל קודם, ולכן לשֶׁ־ לא נותר
         * תפקיד של לוואי או של פסוקית תוכן. התנאי הנוסף — שהמשפט ממשיך
         * אחרי הפסוקית — מבחין בין ״שנגיע לגשר, נעבור אותו״ ובין משאלה
         * עצמאית כמו ״שיהיה בהצלחה״.
         */
        let matches = false;
        if (atSentenceStart) {
          const sentence = ctx.doc.sentences[tok.sentence];
          matches = /[,–—-]/.test(ctx.text.slice(tok.end, sentence.end));
        } else if (prev.kind === 'hebrew' && TIME_ADVERBS.has(prev.text)) {
          matches = true;
        }
        if (!matches) continue;
        if (prev && prev.kind === 'hebrew' && SHE_HOSTS.has(prev.text)) continue;

        findings.push(
          makeFinding(ctx, spec, {
            start: tok.start,
            end: tok.end,
            message:
              `«${tok.text}» פותחת כאן פסוקית זמן — היא עונה על השאלה ״מתי״ — ולכן היא נפתחת ` +
              'בכְּשֶׁ־. המילית שֶׁ־ לבדה פותחת פסוקית לוואי (״איזה״) הנסמכת לשם עצם, ' +
              'או פסוקית תוכן (״מה״) אחרי פועל אמירה.',
            suggestion: `כ${tok.text}`,
            replacement: `כ${tok.text}`,
            autoFixSafe: true,
            authority: academy('תחביר וניסוח — כְּשֶׁ־ ולא שֶׁ־', KSHE_URL),
          }),
        );
      }

      return findings;
    },
  };
}

export const clauseRules: Rule[] = [continuativeRelativeRule(), timeClauseRule()];

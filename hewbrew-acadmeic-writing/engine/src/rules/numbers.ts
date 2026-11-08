/**
 * מספרים: התאם המין בין שם המספר לשם העצם, צורת הנסמך לפני שם מיודע,
 * וכתיב שנים עבריות ואחוזים.
 */

import type { Finding, Rule, RuleContext } from '../text/diagnostics.js';
import { makeFinding } from '../text/diagnostics.js';
import { academy, convention, regexRule } from './helpers.js';
import { NUMERAL_BY_WORD, counterpart } from '../knowledge/numerals.js';
import { guessNounGender } from '../knowledge/nounGender.js';
import { GERSHAYIM } from '../text/chars.js';
import { nextWord, prevWord } from '../text/tokenize.js';

const HEB = '\\u05D0-\\u05EA';
const HEB_ANY = '\\u05D0-\\u05EA\\u0591-\\u05C7';

/**
 * מזהה שם מספר גם כשנצמדה אליו אות שימוש: ״ושתי״, ״בשלושה״, ״מארבע״.
 * רשימת שמות המספר סגורה וקצרה, ולכן הסרת אות השימוש כאן בטוחה.
 */
function numeralOf(word: string): { numeral: ReturnType<typeof NUMERAL_BY_WORD.get>; prefix: string } | null {
  const direct = NUMERAL_BY_WORD.get(word);
  if (direct) return { numeral: direct, prefix: '' };

  const first = word[0];
  if (first && 'והבלכמש'.includes(first)) {
    const rest = word.slice(1);
    const stripped = NUMERAL_BY_WORD.get(rest);
    if (stripped) return { numeral: stripped, prefix: first };
  }
  return null;
}

/**
 * שלוש ילדים ← שלושה ילדים.
 *
 * הבדיקה מופעלת רק כששם העצם ברבים ומינו ידוע. שם יחיד אחרי שם מספר
 * הוא לרוב צירוף אחר לגמרי (״שלוש מאות״, ״ארבע שנים״ מול ״ארבע שנה״),
 * ולכן אינו נבדק.
 */
function numeralAgreementRule(): Rule {
  const spec = {
    id: 'num/gender-agreement',
    category: 'numbers' as const,
    severity: 'error' as const,
  };

  /**
   * האיבר הראשון בשם מספר מורכב (11–19). שתי צורות הכתיב נכללות, שהרי
   * ״שנים עשר״ בכתיב חסר שכיח בטקסטים, והכלל צריך לזהות גם אותו.
   */
  const TEEN_FIRST = new Set([
    'אחד', 'אחת', 'שניים', 'שנים', 'שתיים', 'שתים', 'שלוש', 'שלושה',
    'ארבע', 'ארבעה', 'חמש', 'חמישה', 'שש', 'שישה', 'שבע', 'שבעה',
    'שמונה', 'תשע', 'תשעה',
  ]);

  /** מילים שבאות אחרי שם מספר ואינן שם העצם הנמנה */
  const SKIP_NEXT = new Set([
    'מאות', 'אלפים', 'אלפי', 'מיליון', 'מיליוני', 'מיליארד', 'עשר', 'עשרה',
    'עשרות', 'רבעים', 'חמישיות', 'שלישים',
  ]);

  return {
    ...spec,
    title: 'התאם המין בין שם המספר לשם העצם',
    run(ctx: RuleContext): Finding[] {
      const findings: Finding[] = [];

      for (const tok of ctx.doc.tokens) {
        if (tok.kind !== 'hebrew') continue;
        const found = numeralOf(tok.text);
        if (!found?.numeral || found.numeral.gender === 'both') continue;
        const { numeral, prefix } = found as { numeral: NonNullable<typeof found.numeral>; prefix: string };

        /*
         * בשם מספר מורכב (11–19) ההתאם הפוך לכלל הפשוט: לזכר ״שנים עשר
         * עמודים״, לנקבה ״שש עשרה חתולות״. כאן נבדק האיבר השני, ועליו
         * הכלל הפשוט אינו חל — אחרת ״שנים עשר עמודים״ היה מתוקן ל״עשרה״.
         */
        if (tok.text === 'עשר' || tok.text === 'עשרה') {
          // גם ״שנים־עשר״ ו״שנים-עשר״, שבהם מקף מפריד ולא רווח
          const before = ctx.text.slice(0, tok.start).replace(/[\s־-]+$/, '');
          const prevText = /([א-ת]+)$/.exec(before)?.[1];
          if (prevText && TEEN_FIRST.has(prevText)) continue;
        }

        const noun = nextWord(ctx.doc, tok);
        if (!noun || noun.kind !== 'hebrew') continue;
        if (SKIP_NEXT.has(noun.text)) continue;

        const guess = guessNounGender(noun.text);
        if (guess.gender === 'unknown' || !guess.plural) continue;
        // סיומת בלבד אינה ראיה חזקה דייה כדי לקבוע שגיאה
        if (guess.confidence === 'morphology' && !/(ים|ות)$/.test(noun.text)) continue;
        if (guess.gender === numeral.gender) continue;

        const fixed = counterpart(numeral, guess.gender);
        if (!fixed) continue;

        /*
         * לפני שם מיודע בא שם המספר בנסמך. בלי הבדיקה הזאת התיקון של
         * ״בחמש העיתונים״ היה ״בחמישה העיתונים״ — מין נכון, מצב שגוי.
         */
        const definite = noun.text.startsWith('ה');
        const construct = definite ? findConstruct(fixed.value, guess.gender) : undefined;
        const word = construct ?? fixed.word;

        const genderName = guess.gender === 'm' ? 'זכר' : 'נקבה';
        const basis =
          guess.confidence === 'lexicon'
            ? 'לפי רשימת שמות העצם'
            : guess.confidence === 'pattern'
              ? 'לפי משקל הריבוי'
              : 'לפי סיומת הריבוי';

        findings.push(
          makeFinding(ctx, spec, {
            start: tok.start,
            end: tok.end,
            message:
              `«${noun.text}» הוא שם עצם ב${genderName} (${basis}), ולכן שם המספר שלפניו צריך להיות ` +
              `«${prefix}${word}» ולא «${tok.text}». בעברית שם המספר מתאים למין שם העצם, ` +
              'וצורת הזכר היא דווקא זו שסיומה ה״א.' +
              (construct ? ' לפני שם מיודע שם המספר בא בצורת הנסמך.' : ''),
            suggestion: prefix + word,
            replacement: prefix + word,
            autoFixSafe: true,
            authority: academy('כללי הדקדוק — התאם המין בשם המספר'),
          }),
        );
      }

      return findings;
    },
  };
}

/** שלושה הילדים ← שלושת הילדים */
function numeralConstructRule(): Rule {
  const spec = {
    id: 'num/construct-before-definite',
    category: 'numbers' as const,
    severity: 'warning' as const,
  };

  return {
    ...spec,
    title: 'צורת הנסמך של שם המספר לפני שם מיודע',
    run(ctx: RuleContext): Finding[] {
      const findings: Finding[] = [];

      for (const tok of ctx.doc.tokens) {
        if (tok.kind !== 'hebrew') continue;
        const found = numeralOf(tok.text);
        if (!found?.numeral) continue;
        const { numeral, prefix } = found as { numeral: NonNullable<typeof found.numeral>; prefix: string };
        if (numeral.state !== 'absolute' || numeral.gender !== 'm' || numeral.value < 2) continue;
        /*
         * שם מספר מיודע אינו נכנס לנסמך: ״השניים הראשונים״ תקין, ובלי
         * הבדיקה הזאת הוא היה מתוקן ל״השני הראשונים״ — ומשנה משמעות.
         */
        if (prefix.includes('ה')) continue;

        const noun = nextWord(ctx.doc, tok);
        if (!noun || noun.kind !== 'hebrew' || !noun.text.startsWith('ה')) continue;
        if (!/(ים|ות)$/.test(noun.text)) continue;

        const base = findConstruct(numeral.value, 'm');
        if (!base) continue;
        const construct = prefix + base;

        findings.push(
          makeFinding(ctx, spec, {
            start: tok.start,
            end: tok.end,
            message: `לפני שם מיודע בא שם המספר בצורת הנסמך: «${construct} ${noun.text}».`,
            suggestion: construct,
            replacement: construct,
            autoFixSafe: true,
            authority: academy('כללי הדקדוק — שם המספר בנסמך'),
          }),
        );
      }

      return findings;
    },
  };
}

/**
 * צורת הנסמך של שם המספר.
 *
 * בנקבה רק ״שתי״ נבדלת מן הצורה הנפרדת; ״שלוש״ ו״חמש״ זהות בכתיב חסר
 * הניקוד בשני המצבים, ולכן החיפוש מחזיר undefined ואין מה לתקן.
 */
function findConstruct(value: number, gender: 'm' | 'f'): string | undefined {
  for (const [word, numeral] of NUMERAL_BY_WORD) {
    if (numeral.value === value && numeral.state === 'construct' && numeral.gender === gender) {
      return word;
    }
  }
  return undefined;
}

/**
 * ״שמונה אחוז״ ← ״שמונה אחוזים״.
 *
 * שם המספר מ־2 עד 10 בא לפני שם עצם ברבים: שלושה ימים, חמישה שקלים,
 * שמונה אחוזים. הצורה ביחיד אחרי שם מספר קטן היא שגיאה שכיחה במיוחד
 * עם ״אחוז״, ומקורה בצירופים הגדולים שבהם היחיד אכן תקין — ״חמישה
 * עשר אחוז״, ״מאה קילומטר״ — ושם המספר בהם גדול מעשר.
 *
 * הבדיקה מוגבלת לשמות של יחידות מידה, זמן וכסף, שהם המקום שבו הטעות
 * מתרחשת בפועל. ״שלוש ילד״ אינו צירוף שנכתב.
 */
function countedNounPluralRule(): Rule {
  const spec = {
    id: 'num/counted-noun-plural',
    category: 'numbers' as const,
    severity: 'error' as const,
  };

  /** עשרות ומעלה — מופיעות רק כרכיב ראשון בצירוף, ואינן במפת שמות המספר */
  const LARGER_NUMERALS = new Set([
    'עשרים', 'שלושים', 'ארבעים', 'חמישים', 'שישים', 'ששים', 'שבעים',
    'שמונים', 'תשעים', 'מאה', 'מאתיים', 'מאות', 'אלף', 'אלפיים', 'אלפים',
    'מיליון', 'מיליארד',
  ]);

  const UNITS = new Map<string, string>([
    ['אחוז', 'אחוזים'],
    ['שקל', 'שקלים'],
    ['דולר', 'דולרים'],
    ['אירו', 'אירו'],
    ['קילומטר', 'קילומטרים'],
    ['מטר', 'מטרים'],
    ['סנטימטר', 'סנטימטרים'],
    ['מילימטר', 'מילימטרים'],
    ['קילוגרם', 'קילוגרמים'],
    ['גרם', 'גרמים'],
    ['ליטר', 'ליטרים'],
    ['טון', 'טונות'],
    ['יום', 'ימים'],
    ['שבוע', 'שבועות'],
    ['חודש', 'חודשים'],
    ['שנה', 'שנים'],
    ['שעה', 'שעות'],
    ['דקה', 'דקות'],
    ['עמוד', 'עמודים'],
    ['פרק', 'פרקים'],
    ['סעיף', 'סעיפים'],
    ['נקודה', 'נקודות'],
  ]);

  return {
    ...spec,
    title: 'שם נמנה ברבים אחרי שם מספר מ־2 עד 10',
    run(ctx: RuleContext): Finding[] {
      const findings: Finding[] = [];

      for (const tok of ctx.doc.tokens) {
        if (tok.kind !== 'hebrew') continue;
        const found = numeralOf(tok.text);
        if (!found?.numeral) continue;
        const { numeral } = found as { numeral: NonNullable<typeof found.numeral> };
        if (numeral.value < 2 || numeral.value > 10) continue;

        /*
         * בצירוף כמו ״חמישה עשר אחוז״ או ״עשרים ושלושה אחוז״ המספר כולו
         * גדול מעשר, והיחיד תקין. המילה שלפני שם המספר מסגירה את הצירוף.
         * העשרות אינן במפת שמות המספר, ולכן הן נבדקות ברשימה נפרדת.
         */
        const before = prevWord(ctx.doc, tok);
        if (
          before &&
          before.kind === 'hebrew' &&
          (numeralOf(before.text)?.numeral || LARGER_NUMERALS.has(before.text))
        ) {
          continue;
        }

        const noun = nextWord(ctx.doc, tok);
        if (!noun || noun.kind !== 'hebrew') continue;
        const plural = UNITS.get(noun.text);
        if (!plural || plural === noun.text) continue;

        // ״עשר״ ו״עשרה״ בונים את המספרים 11–19 ואינם שם נמנה
        if (numeralOf(noun.text)?.numeral) continue;

        findings.push(
          makeFinding(ctx, spec, {
            start: noun.start,
            end: noun.end,
            message:
              `שם המספר «${tok.text}» מונה בין שניים לעשרה, ולכן השם הנמנה אחריו בא ברבים: ` +
              `«${tok.text} ${plural}» ולא «${tok.text} ${noun.text}». היחיד תקין רק מאחד עשר ומעלה.`,
            suggestion: plural,
            replacement: plural,
            autoFixSafe: true,
            authority: academy('כללי הדקדוק — מניין השם אחרי שם המספר'),
          }),
        );
      }

      return findings;
    },
  };
}

export const numberRules: Rule[] = [
  numeralAgreementRule(),
  numeralConstructRule(),
  countedNounPluralRule(),

  regexRule({
    id: 'num/hebrew-year-gershayim',
    category: 'numbers',
    severity: 'warning',
    title: 'גרשיים בשנה עברית',
    authority: academy('כללי הפיסוק — גרשיים בציון שנים ומספרים באותיות'),
    // שנה עברית בת ארבע אותיות הפותחת בתי״ו, בלי גרשיים
    pattern: new RegExp(`(?<![${HEB_ANY}])(ת[${HEB}])([${HEB}])([${HEB}])(?![${HEB_ANY}])`),
    message: (m) => {
      const year = m[0];
      // רק צירופים שנראים כשנה עברית: תש..., תר..., תק...
      if (!/^ת[שרקפעס]/.test(year)) return null;
      /*
       * הצורה לבדה אינה מספיקה: ״תקין״, ״תשעה״, ״תקרה״, ״תקבל״ ו״תשלח״
       * נראות בדיוק כמו שנה עברית. בלי הקשר מפורש — ״בשנת תשפה״,
       * ״ה׳תשפה״ — הכלל היה מגרש אותן, ו־fix היה הופך אותן לראשי תיבות.
       */
      const before = m.input.slice(0, m.index).trimEnd();
      if (!/(?:שנת|שנה|ה[׳'])$/.test(before)) return null;
      return `בציון שנה עברית באים גרשיים לפני האות האחרונה: «${year.slice(0, -1)}${GERSHAYIM}${year.slice(-1)}».`;
    },
    suggestion: (m) => `${m[0].slice(0, -1)}${GERSHAYIM}${m[0].slice(-1)}`,
    replacement: (m) => `${m[0].slice(0, -1)}${GERSHAYIM}${m[0].slice(-1)}`,
    autoFixSafe: true,
  }),

  regexRule({
    id: 'num/percent-spacing',
    category: 'numbers',
    severity: 'suggestion',
    title: 'סימן האחוז נצמד למספר',
    authority: convention('כתיבת אחוזים'),
    pattern: /(\d)\s+%/,
    message: 'סימן האחוז נצמד למספר שלפניו, בלי רווח.',
    suggestion: (m) => `${m[1]}%`,
    replacement: (m) => `${m[1]}%`,
  }),

  regexRule({
    id: 'num/range-dash',
    category: 'numbers',
    severity: 'suggestion',
    title: 'טווח מספרים בקו מפריד',
    authority: academy('כללי הפיסוק — הקו המפריד בטווחים'),
    pattern: /(\d)\s*-\s*(\d)/,
    message: 'בטווח מספרים משמש קו מפריד – ולא מקף.',
    suggestion: (m) => `${m[1]}–${m[2]}`,
    replacement: (m) => `${m[1]}–${m[2]}`,
    autoFixSafe: true,
  }),

  regexRule({
    id: 'num/digits-in-academic-prose',
    category: 'numbers',
    severity: 'suggestion',
    title: 'מספרים קטנים במילים',
    authority: convention('מוסכמות כתיבה עיונית'),
    registers: ['academic', 'literary'],
    // ספרה בודדת בתוך משפט, לא בהקשר של אחוז, שנה, סעיף או יחידת מידה
    pattern: new RegExp(`(?<![\\d.,%־-])([1-9])(?![\\d.,%°])\\s+([${HEB}]{3,})`),
    message: (m) => {
      const unitLike = /^(אחוז|אחוזים|ק"מ|ס"מ|מ"ר|ש"ח|שקלים|דולר|מטר|קילו|שעות|דקות|ימים)/.test(m[2]);
      if (unitLike) return null;
      return `בפרוזה עיונית וספרותית נהוג לכתוב מספרים קטנים במילים: «${m[1]}» ← במילים.`;
    },
    suggestion: 'לכתוב את המספר במילים',
    autoFixSafe: false,
    optIn: true,
  }),
];

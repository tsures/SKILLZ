/**
 * כללים שמקורם בחומרי ההוראה של הקורס ״עברית בהוראה״.
 *
 * הופרדו למודול משלהם כדי שמקורו של כל ממצא יישאר גלוי: אלה כללים
 * שנלמדים בהוראת הלשון, ולא בהכרח החלטות אקדמיה פורמליות.
 */

import type { Finding, Rule, RuleContext } from '../text/diagnostics.js';
import { makeFinding } from '../text/diagnostics.js';
import { regexRule, termRule, type TermEntry } from './helpers.js';
import { IDIOM_CORRECTIONS } from '../knowledge/idioms.js';
import { findMisquotedIdiom, loadIdioms } from '../lexicon/idioms.js';
import { sentenceWords } from '../text/tokenize.js';

const HEB = '\\u05D0-\\u05EA';
const HEB_ANY = '\\u05D0-\\u05EA\\u0591-\\u05C7';

const COURSE = {
  source: 'חומרי הוראה — עברית בהוראה',
  clause: 'שיבושי לשון שכיחים בעברית',
};

const COURSE_IDIOMS = {
  source: 'חומרי הוראה — עברית בהוראה',
  clause: 'ניבים וביטויים — שיבושים נפוצים',
};


/** בינוני של פיעל, הפעיל והתפעל נפתח במם */
const PARTICIPLE_MEM = new RegExp(`^מ[${HEB}]{3,}$`);

const COMMON_PARTICIPLES = new Set([
  'רוצה', 'רוצים', 'רוצות', 'יכול', 'יכולה', 'יכולים', 'יכולות',
  'הולך', 'הולכת', 'הולכים', 'הולכות', 'אוהב', 'אוהבת', 'אוהבים',
  'חושב', 'חושבת', 'חושבים', 'יודע', 'יודעת', 'יודעים', 'מבין',
  'מבינה', 'מבינים', 'עושה', 'עושים', 'אומר', 'אומרת', 'אומרים',
  'נמצא', 'נמצאת', 'נמצאים', 'צריך', 'צריכה', 'צריכים', 'מסכים',
  'מסכימה', 'מאמין', 'מאמינה', 'זוכר', 'זוכרת', 'מתכוון', 'מתכוונת',
]);

/** כינויי הגוף שאפשר לשלול אחריהם בהווה */
const PRONOUN_TO_EIN: Record<string, string> = {
  אני: 'איני',
  אתה: 'אינך',
  את: 'אינך',
  הוא: 'אינו',
  היא: 'אינה',
  אנחנו: 'איננו',
  אנו: 'איננו',
  אתם: 'אינכם',
  אתן: 'אינכן',
  הם: 'אינם',
  הן: 'אינן',
};

/**
 * סיומות הגוף של העבר. שם תואר אינו מקבל אותן, ולכן מילה שמסתיימת
 * באחת מהן אחרי צורת ״אין״ היא פועל כמעט תמיד.
 */
const PAST_SUFFIX = /(תי|נו|תם|תן|ו)$/;

/** מילים תפקודיות שסיומתן ו״ו ואינן פועל */
const PAST_PRONOUNS = new Set(['אלו', 'זהו', 'הוא', 'אותו', 'כולו', 'עצמו', 'מהו', 'מיהו']);

/** צורות ״אין״ שאין להשתמש בהן לשלילת עבר ועתיד */
const EIN_FORMS = ['איני', 'אינני', 'אינך', 'אינו', 'איננו', 'אינה', 'איננה', 'אינם', 'אינן', 'אינכם', 'אינכן'];

const FORM_ERRORS: TermEntry[] = [
  { avoid: 'בעקב', prefer: 'עקב', note: 'הצירוף ״בעקב״ אינו תקין' },
  { avoid: 'ברת', prefer: 'בת', note: '״ברת״ אינה תקינה; צורת הנקבה היא ״בת״' },
  { avoid: 'במקרה ו', prefer: 'במקרה ש', note: 'מילית השעבוד היא שי״ן ולא ו״ו' },
];

/** ראשי סמיכות ברבים שנוטים ליידע בטעות */
const CONSTRUCT_PLURAL_HEADS = [
  'בתי', 'אנשי', 'ראשי', 'בעלי', 'עורכי', 'חברי', 'ילדי', 'כלי',
  'דברי', 'גני', 'ספרי', 'דפי', 'מורי', 'תלמידי', 'שערי', 'סדרי',
];

/**
 * שיבוש ניב שאינו ברשימה הידנית.
 *
 * לכל רצף של שתיים עד שש מילים בטקסט נבדק אם קיים ניב תקני שקרוב
 * אליו מאוד אך אינו זהה לו. כך נתפסים גם שיבושים שלא נרשמו מראש —
 * וזה הרוב, שכן כל ניב אפשר לשבש בעשרות דרכים.
 */
function idiomMisquoteRule(): Rule {
  const spec = {
    id: 'idiom/misquote',
    category: 'common-errors' as const,
    severity: 'warning' as const,
  };

  return {
    ...spec,
    title: 'ניב שנראה משובש',
    run(ctx: RuleContext): Finding[] {
      if (loadIdioms().idioms.length === 0) return [];

      const findings: Finding[] = [];
      const reported = new Set<number>();
      // שיבושים שכבר יש להם ערך ידני מטופלים בכלל course/idioms, עם הסבר מלא
      const handledManually = new Set(IDIOM_CORRECTIONS.map((e) => e.wrong));

      for (const sentence of ctx.doc.sentences) {
        const words = sentenceWords(ctx.doc, sentence).filter((t) => t.kind === 'hebrew');

        // הצירופים הארוכים נבדקים ראשונים, כדי שלא נדווח על חלק מצירוף שכבר דווח
        for (let size = 6; size >= 2; size--) {
          for (let i = 0; i + size <= words.length; i++) {
            if (reported.has(words[i].start)) continue;

            const span = words.slice(i, i + size);
            const phrase = span.map((t) => t.text).join(' ');
            if (handledManually.has(phrase)) continue;
            const match = findMisquotedIdiom(phrase);
            if (!match) continue;

            for (const t of span) reported.add(t.start);
            findings.push(
              makeFinding(ctx, spec, {
                start: span[0].start,
                end: span[span.length - 1].end,
                message:
                  `«${phrase}» קרוב מאוד לניב «${match.canonical}» אך אינו זהה לו. ` +
                  'שיבוש ניב הוא לרוב שינוי של אות אחת, ובודק איות אינו תופס אותו.',
                suggestion: match.canonical,
                replacement: match.canonical,
                // ההכרעה אם זו טעות או ניסוח מכוון היא של הכותב
                autoFixSafe: false,
                authority: match.url
                  ? {
                      source: 'האקדמיה ללשון העברית',
                      clause: `מטבעות לשון — ${match.canonical}`,
                      url: match.url,
                    }
                  : {
                      source: 'מאגר צורות ניב',
                      clause: 'זיהוי לפי מרחק עריכה מן הצורה התקנית',
                    },
              }),
            );
            break;
          }
        }
      }

      return findings;
    },
  };
}

export const courseRules: Rule[] = [
  idiomMisquoteRule(),

  termRule({
    id: 'course/idioms',
    category: 'common-errors',
    severity: 'error',
    title: 'שיבוש בניב או בביטוי',
    authority: COURSE_IDIOMS,
    entries: IDIOM_CORRECTIONS.map((e) => ({
      avoid: e.wrong,
      prefer: e.correct,
      note: e.meaning,
    })),
    message: (entry, matched) =>
      `«${matched}» הוא שיבוש של הניב «${entry.prefer}» (${entry.note}).`,
  }),

  termRule({
    id: 'course/forms',
    category: 'common-errors',
    severity: 'error',
    title: 'צורות שאינן תקינות',
    authority: COURSE,
    entries: FORM_ERRORS,
  }),

  // ── שלילה ─────────────────────────────────────────────────────────────
  regexRule({
    id: 'course/negation-present',
    category: 'syntax',
    severity: 'suggestion',
    title: 'שלילת ההווה ב״אין״ על הטיותיו',
    authority: { ...COURSE, clause: 'שלילת ההווה רק על ידי ״אין״ ונטיותיו' },
    registers: ['academic'],
    pattern: new RegExp(
      `(?<![${HEB_ANY}])(${Object.keys(PRONOUN_TO_EIN).join('|')})\\s+לא\\s+([${HEB}]{3,})(?![${HEB_ANY}])`,
    ),
    message: (m) => {
      // רק כשברור שהפועל בהווה; בעבר ובעתיד השלילה ב״לא״ היא הנכונה
      if (!COMMON_PARTICIPLES.has(m[2]) && !PARTICIPLE_MEM.test(m[2])) return null;
      return `בעברית תקנית שוללים את ההווה בצורות ״אין״: «${PRONOUN_TO_EIN[m[1]]} ${m[2]}» ולא «${m[1]} לא ${m[2]}».`;
    },
    suggestion: (m) => `${PRONOUN_TO_EIN[m[1]]} ${m[2]}`,
    replacement: (m) => `${PRONOUN_TO_EIN[m[1]]} ${m[2]}`,
    autoFixSafe: false,
  }),

  regexRule({
    id: 'course/negation-past-future',
    category: 'syntax',
    severity: 'error',
    title: 'שלילת עבר ועתיד ב״לא״ בלבד',
    authority: { ...COURSE, clause: 'שלילת העבר והעתיד רק על ידי ״לא״' },
    // צורת ״אין״ ואחריה פועל בעבר או בעתיד
    pattern: new RegExp(
      `(?<![${HEB_ANY}])(${EIN_FORMS.join('|')})\\s+([${HEB}]{3,})(?![${HEB_ANY}])`,
    ),
    message: (m) => {
      /*
       * ההכרעה כאן מורפולוגית ולא לקסיקלית, בכוונה.
       *
       * ניתוח מורפולוגי אינו עוזר: ״נכון״ ו״יציב״ הן צורות פועל תקפות
       * לחלוטין (נָכוֹן בנפעל, יַצִּיב בהפעיל), ובכל זאת בהקשר ״אינו
       * נכון״ הן שמות תואר — וזו עברית יומיומית תקינה. בלי מילון של
       * מה משמש בפועל כפועל אין דרך להבחין.
       *
       * לעומת זאת סיומות הגוף של העבר אינן יכולות להופיע בשם תואר,
       * ולכן הן סימן בטוח. הכלל מוותר על ״אינו כתב״ — שאין בו סיומת —
       * ותופס את ״אינם הביאו״ ואת ״איננו ידענו״.
       */
      const verb = m[2];
      if (PAST_PRONOUNS.has(verb)) return null;
      if (!PAST_SUFFIX.test(verb)) return null;

      return `את העבר ואת העתיד שוללים במילה ״לא״ בלבד; ״${m[1]}״ משמש לשלילת ההווה.`;
    },
    suggestion: 'להחליף לצורת ״לא״ עם כינוי הגוף המתאים',
    autoFixSafe: false,
  }),

  // ── פיסוק לפני קשרי ביאור ─────────────────────────────────────────────
  regexRule({
    id: 'course/comma-before-explainer',
    category: 'punctuation',
    severity: 'error',
    title: 'הפסיק בא לפני קשר הביאור, לא אחריו',
    authority: { ...COURSE, clause: 'סימן הפיסוק יגיע לפני קשרי פירוט, הסבר או תיאור' },
    pattern: new RegExp(
      `([${HEB}])\\s+(כלומר|דהיינו|היינו|קרי|משמע|זאת אומרת|הווה אומר|רוצה לומר)\\s*,`,
    ),
    message: (m) =>
      `הפסיק בא לפני קשר הביאור ולא אחריו: «${m[1]}, ${m[2]}» ולא «${m[1]} ${m[2]},».`,
    suggestion: (m) => `${m[1]}, ${m[2]}`,
    replacement: (m) => `${m[1]}, ${m[2]}`,
  }),

  // ── סמיכות ────────────────────────────────────────────────────────────
  regexRule({
    id: 'course/definite-construct-plural',
    category: 'syntax',
    severity: 'error',
    title: 'יידוע הסומך ולא הנסמך',
    authority: { ...COURSE, clause: 'יש לידע רק את הסומך ולא את הנסמך' },
    pattern: new RegExp(
      `(?<![${HEB_ANY}])ה(${CONSTRUCT_PLURAL_HEADS.join('|')})\\s+([${HEB}]{2,})(?![${HEB_ANY}])`,
    ),
    message: (m) => {
      if (m[2].startsWith('ה')) return null;
      return `בצירוף סמיכות ה״א הידיעה באה על הסומך: «${m[1]} ה${m[2]}» ולא «ה${m[1]} ${m[2]}».`;
    },
    suggestion: (m) => `${m[1]} ה${m[2]}`,
    /*
     * ההבחנה בין סמיכות ובין נושא ונשוא אינה אפשרית כאן: ״הכלי מסווג״
     * הוא משפט, ו״הכלי עבודה״ הוא סמיכות, ושתיהן נראות זהות. לכן דיווח
     * בלבד — תיקון אוטומטי היה הופך ״הכלי מסווג״ ל״כלי המסווג״.
     */
    autoFixSafe: false,
  }),

  regexRule({
    id: 'course/two-nismachim',
    category: 'syntax',
    severity: 'warning',
    title: 'שני נסמכים לסומך אחד',
    authority: { ...COURSE, clause: 'לא יהיו שני נסמכים לסומך אחד' },
    // שתי צורות נסמך מחוברות בו״ו, ואחריהן הסומך המשותף
    pattern: new RegExp(
      `(?<![${HEB_ANY}])([${HEB}]{3,}י)\\s+ו([${HEB}]{3,}י)\\s+(ה?[${HEB}]{3,})(?![${HEB_ANY}])`,
    ),
    message: (m) =>
      `«${m[1]} ו${m[2]} ${m[3]}» מצרף שני נסמכים לסומך אחד. יש לפרק: «${m[1]} ${m[3]} ו${m[2]}הם».`,
    suggestion: (m) => `${m[1]} ${m[3]} ו${m[2]}...`,
    autoFixSafe: false,
  }),

  // ── כ״ף הזמן ──────────────────────────────────────────────────────────
  regexRule({
    id: 'course/kshe-omitted',
    category: 'syntax',
    severity: 'suggestion',
    title: 'השמטת הכ״ף מן המילית ״כש״',
    authority: { ...COURSE, clause: 'הרצף ״כש־״ הוא תיאור זמן הזהה למילה ״כאשר״' },
    optIn: true,
    pattern: new RegExp(`(?<![${HEB_ANY}])ש(אלך|נלך|אבוא|נבוא|הייתי|היינו|אחזור|נחזור|אגיע|נגיע)(?![${HEB_ANY}])`),
    message: (m) =>
      `אם הכוונה לתיאור זמן, המילית היא ״כש״: «כש${m[1]}». ״ש${m[1]}״ פותחת פסוקית זיקה או מושא.`,
    suggestion: (m) => `כש${m[1]}`,
    autoFixSafe: false,
  }),
];

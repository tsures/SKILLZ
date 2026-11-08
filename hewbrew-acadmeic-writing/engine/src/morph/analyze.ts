/**
 * ניתוח מורפולוגי של צורת פועל.
 *
 * הרעיון: מנוע הנטייה כבר יודע לייצר כל צורה מתוך שורש ובניין.
 * הניתוח הוא ההיפך — נתונה הצורה, ומבקשים את השורש והבניין.
 *
 * במקום להחזיק מילון של מיליוני צורות, כל תבנית נטייה מומרת לביטוי
 * רגולרי שבו אותיות השורש הן קבוצות לכידה. צורה שמתאימה לתבנית
 * מניבה שורש מועמד, והמועמד נבדק בייצור חוזר: אם הנטייה של אותו שורש
 * באותו בניין מחזירה בדיוק את הצורה שהתחלנו ממנה — הניתוח נכון.
 *
 * כך הניתוח מדויק בדיוק כמו הייצור, ומשתפר יחד איתו.
 */

import {
  conjugate,
  BINYANIM,
  PERSON_LABELS,
  PRESENT_LABELS,
  IMPERATIVE_LABELS,
  type Binyan,
  type Conjugation,
} from './binyanim.js';
import { detectGizra, type Gizra } from './roots.js';
import { normalizeForLookup } from '../text/chars.js';

export type Tense =
  | 'past'
  | 'present'
  | 'future'
  | 'imperative'
  | 'infinitive'
  | 'passiveParticiple'
  | 'gerund';

export const TENSE_LABELS: Record<Tense, string> = {
  past: 'עבר',
  present: 'הווה',
  future: 'עתיד',
  imperative: 'ציווי',
  infinitive: 'שם הפועל',
  passiveParticiple: 'בינוני פעול',
  gerund: 'שם הפעולה',
};

export interface VerbAnalysis {
  /** אותיות השורש */
  root: string[];
  binyan: Binyan;
  gizra: Gizra;
  tense: Tense;
  /** מפתח הגוף, כשיש */
  person?: string;
  /** תווית הגוף בעברית */
  personLabel?: string;
  /** הצורה בכתיב מלא, כפי שהמנוע מייצר אותה */
  plain: string;
  /** הצורה המנוקדת */
  nikud: string;
  /** רמת הדיוק של הגזרה במנוע */
  accuracy: Conjugation['accuracy'];
}

// ── בניית מפתח החיפוש ────────────────────────────────────────────────────────

/**
 * שורשים מייצגים לכל גזרה. הם משמשים רק כדי לגלות אילו אותיות שורש
 * מופיעות בפועל בתבניות של אותה גזרה, ומה השלד הקבוע סביבן.
 */
/**
 * שורשים מייצגים לכל גזרה. הם משמשים רק כדי לגלות אילו אותיות שורש
 * מופיעות בפועל בתבניות של אותה גזרה, ומה השלד הקבוע סביבן.
 *
 * בחירת האותיות אינה שרירותית. הביטוי הרגולרי נבנה מן הצורה המוגמרת,
 * ולכן אות שורש שמופיעה גם בשלד — היו״ד של ״ישב״ מול היו״ד של תחילית
 * העתיד — נלכדת בעמדה הלא נכונה והתבנית יוצאת שגויה. לכן שתי אותיות
 * השורש שאינן מגדירות את הגזרה נבחרו מתוך האותיות שאינן מופיעות
 * בשום שלד: ב ג ד ז ח ט כ ס ע פ צ ק ר שׁ. האות החלשה עצמה (א, ה, ו,
 * י, נ) היא הכרח הגזרה ואי אפשר להימנע ממנה.
 */
const GIZRA_PROBES: Array<{
  gizra: Gizra;
  root: string[];
  /** אות שורש שנבלעת בצורה ואינה ניתנת ללכידה — מפתח הוא מספר האות פחות אחת */
  fill?: Record<number, string>;
}> = [
  { gizra: 'שלמים', root: ['פ', 'ק', 'ד'] },
  /*
   * בהתפעל התי״ו של התחילית מתחלפת במקומה עם פ״א הפועל כשזו שורקת,
   * והתי״ו עצמה מתחלפת בטי״ת אחרי צד״י ובדל״ת אחרי זי״ן: הִסְתַּדֵּר,
   * הִצְטָרֵף, הִזְדַּמֵּן. כל אחד מן השלושה הוא שלד אחר.
   */
  { gizra: 'שלמים', root: ['ס', 'ק', 'ד'] },
  { gizra: 'שלמים', root: ['צ', 'ק', 'ד'] },
  // בזי״ן התי״ו מתחלפת בדל״ת, ולכן דל״ת בשורש הבדיקה הייתה מתנגשת בשלד
  { gizra: 'שלמים', root: ['ז', 'ק', 'ב'] },
  /*
   * הרי״ש נמנית עם הגרוניות, ולכן שורשים שכיחים כמו ס־ד־ר ו־צ־ר־ף אינם
   * שלמים אלא גרוניים — ובגזרה הזאת שתי משפחות תבניות: ל״ה גרונית
   * (ח, ע) נוטה בתבנית משלה, וכל השאר נוטים כשלמים. שתיהן דרושות,
   * ולצידן שלוש וריאציות המטתזה.
   */
  { gizra: 'גרוניים', root: ['פ', 'ק', 'ר'] },
  { gizra: 'גרוניים', root: ['ס', 'ק', 'ר'] },
  { gizra: 'גרוניים', root: ['צ', 'ק', 'ר'] },
  { gizra: 'גרוניים', root: ['ז', 'ק', 'ר'] },
  { gizra: 'ל"ה', root: ['פ', 'ק', 'ה'] },
  { gizra: 'ל"א', root: ['פ', 'ק', 'א'] },
  { gizra: 'ע"ו', root: ['ק', 'ו', 'ד'] },
  { gizra: 'ע"י', root: ['ש', 'י', 'ר'] },
  { gizra: 'ע"ע', root: ['ס', 'ב', 'ב'] },
  { gizra: 'פ"נ', root: ['נ', 'פ', 'ק'] },
  { gizra: 'פ"י', root: ['י', 'ש', 'ב'] },
  { gizra: 'פ"א', root: ['א', 'ב', 'ד'] },
  { gizra: 'גרוניים', root: ['פ', 'ק', 'ח'] },
  /*
   * פ״י שמקורה פ״ו נוטה בבניינים הכבדים בתבנית משלה (הוֹדִיעַ, הוֹצִיא),
   * ולכן היא זקוקה לשורש בדיקה נפרד. ״יצא״ נחשב ל״א ומקבל את אותה
   * תבנית, ולכן הוא נבדק תחת הגזרה שלו.
   */
  { gizra: 'פ"י', root: ['י', 'ד', 'ע'], fill: { 0: 'י' } },
  { gizra: 'ל"א', root: ['י', 'צ', 'א'], fill: { 0: 'י' } },
  /*
   * מרובעים: שני שורשי בדיקה. בהתפעל חלה מטתזה כשפ״א הפועל שורקת
   * (הִסְתַּדֵּר), ולכן שורש עם שורקת ושורש בלעדיה מניבים שני שלדים
   * שונים, ושניהם דרושים.
   */
  { gizra: 'מרובעים', root: ['פ', 'ק', 'ד', 'ג'] },
  { gizra: 'מרובעים', root: ['ס', 'ק', 'ד', 'ג'] },
];

/**
 * שורשים מרובעים מוכרים.
 *
 * בשלושת הבניינים הכבדים השלד של המרובעים כמעט ריק — ״1ִ2ְ3ֵ4״ הוא
 * ארבע אותיות ותו לא — ולכן התבנית מתאימה לכל מילה בת ארבע אותיות,
 * וגם האימות בייצור חוזר מאשר אותה. ״מחשב״ היה נקרא כך כעבר של שורש
 * מ־ח־ש־ב. אצל שורש בן שלוש אותיות השלד עצמו מגביל דיו; כאן צריך
 * רשימה. היא סגורה במתכוון, וקל להוסיף לה.
 */
const KNOWN_QUAD_ROOTS = new Set(
  (
    'פרסם תרגם טלפן ארגן תכנת שכנע גלגל בלבל כרסם קשקש שעמם חשמל אבחן ' +
    'אתגר דגדג זמזם טרטר פטפט צחצח קרצף רשרש שכפל תדלק תמרן סנוור שחזר ' +
    'שדרג תחזק אכזב אבטח אחסן סרבל תדרך תרגל תפעל תקצב שכתב שעתק תזמן ' +
    'תכנן סבסד שפצר פרנס קטלג סרגל מזמז חרבן צנזר פרסם סכסך שרבט תיעד ' +
    'דרדר חלחל כרבל מסמס נדנד סלסל עצבן פרפר צלצל קרקר רפרף שכשך תפקד ' +
    'עדכן ראיין אלתר פענח תמלל סנכרן אפיין תחקר תעדף מסגר שערך תקצב אבחן'
  )
    .split(' ')
    // המפתחות מנורמלים כמו הקלט: אות סופית הופכת לרגילה («פרסם» ← «פרסמ»)
    .map((root) => normalizeForLookup(root)),
);

interface Pattern {
  regex: RegExp;
  /** לאיזו אות שורש מתאימה כל קבוצת לכידה */
  slots: number[];
  binyan: Binyan;
  gizra: Gizra;
  tense: Tense;
  person?: string;
  /** אות שורש שנבלעה בצורה: בהוֹדִיעַ היו״ד אינה נכתבת כלל */
  fill?: Record<number, string>;
}

/**
 * ממיר צורה שנוצרה משורש בדיקה לביטוי רגולרי, על ידי החלפת אותיות
 * השורש בקבוצות לכידה. אות שורש שמופיעה יותר מפעם אחת בצורה — כמו
 * הבי״ת ב״סבב״ — נלכדת פעם אחת ומסונכרנת בהפניה לאחור.
 */
function toPattern(form: string, root: string[]): { source: string; slots: number[] } | null {
  const normalized = normalizeForLookup(form);
  let source = '^';
  const slots: number[] = [];
  const seen = new Map<number, number>();

  for (const ch of normalized) {
    const index = root.findIndex((r) => normalizeForLookup(r) === ch);
    if (index >= 0) {
      const already = seen.get(index);
      if (already !== undefined) {
        source += `\\${already}`;
      } else {
        slots.push(index);
        seen.set(index, slots.length);
        source += '([\\u05D0-\\u05EA])';
      }
    } else {
      source += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }

  if (slots.length === 0) return null;
  return { source: source + '$', slots };
}

let patterns: Pattern[] | null = null;

function buildPatterns(): Pattern[] {
  if (patterns) return patterns;
  const built: Pattern[] = [];
  const seenSources = new Set<string>();

  for (const { gizra, root, fill } of GIZRA_PROBES) {
    for (const binyan of BINYANIM) {
      let table: Conjugation;
      try {
        table = conjugate(root.join(''), binyan);
      } catch {
        continue;
      }
      // הגזרה שהמנוע בחר חייבת להיות זו שהתכוונו לה
      if (table.gizra !== gizra) continue;

      const sections: Array<[Tense, Array<{ key: string; plain: string }>]> = [
        ['past', table.past],
        ['present', table.present],
        ['future', table.future],
        ['imperative', table.imperative],
      ];
      const singles: Array<[Tense, { plain: string } | undefined]> = [
        ['infinitive', table.infinitive],
        ['passiveParticiple', table.passiveParticiple],
        ['gerund', table.gerund],
      ];

      const add = (tense: Tense, plain: string, person?: string) => {
        const pattern = toPattern(plain, root);
        if (!pattern) return;
        /*
         * זהות התבנית כוללת את הזמן, את הגוף ואת מיפוי הקבוצות, ולא רק
         * את הביטוי עצמו. אותו שלד בדיוק משמש שתי צורות שונות — ״פקור״
         * הוא גם ציווי וגם בינוני פעול, ו״הסתדרת״ הוא גם נוכח וגם נוכחת
         * — ומפתח שמתעלם מכך בולע את השנייה בשקט, והצורה שהיא מייצגת
         * מפסיקה להיות ניתנת לניתוח.
         */
        const key = [binyan, gizra, tense, person ?? '', pattern.source, pattern.slots.join(',')].join('|');
        if (seenSources.has(key)) return;
        seenSources.add(key);
        built.push({
          regex: new RegExp(pattern.source),
          slots: pattern.slots,
          binyan,
          gizra,
          tense,
          person,
          fill,
        });
      };

      for (const [tense, forms] of sections) {
        for (const f of forms) add(tense, f.plain, f.key);
      }
      for (const [tense, form] of singles) {
        if (form) add(tense, form.plain);
      }
    }
  }

  patterns = built;
  return built;
}

// ── ניתוח ────────────────────────────────────────────────────────────────────

function personLabel(tense: Tense, key: string | undefined): string | undefined {
  if (!key) return undefined;
  if (tense === 'present') return PRESENT_LABELS[key as keyof typeof PRESENT_LABELS];
  if (tense === 'imperative') return IMPERATIVE_LABELS[key as keyof typeof IMPERATIVE_LABELS];
  return PERSON_LABELS[key as keyof typeof PERSON_LABELS];
}

/**
 * מנתח צורת פועל ומחזיר את כל הניתוחים האפשריים.
 *
 * צורה עברית חסרת ניקוד היא לעיתים קרובות דו־משמעית — ״נשלח״ יכול
 * להיות עבר נפעל או עתיד קל של גוף מדבר־רבים — ולכן מוחזרת רשימה
 * ולא ניתוח יחיד.
 */
export function analyzeVerb(surface: string): VerbAnalysis[] {
  const word = normalizeForLookup(surface);
  if (word.length < 2) return [];

  const results: VerbAnalysis[] = [];
  const seen = new Set<string>();

  for (const pattern of buildPatterns()) {
    const match = pattern.regex.exec(word);
    if (!match) continue;

    // הרכבת השורש מן הקבוצות שנלכדו
    const size = pattern.gizra === 'מרובעים' ? 4 : 3;
    const root: string[] = Array.from({ length: size }, () => '');
    for (const [i, slot] of pattern.slots.entries()) {
      root[slot] = match[i + 1];
    }
    // אותיות שורש שאינן מופיעות בצורה נלקחות מהגדרת הגזרה
    for (const [index, letter] of Object.entries(pattern.fill ?? {})) {
      if (!root[Number(index)]) root[Number(index)] = letter;
    }
    if (pattern.gizra === 'ל"ה' && !root[2]) root[2] = 'ה';
    if (pattern.gizra === 'ע"ו' && !root[1]) root[1] = 'ו';
    if (pattern.gizra === 'ע"י' && !root[1]) root[1] = 'י';
    if (pattern.gizra === 'ע"ע' && !root[2]) root[2] = root[1];
    if (pattern.gizra === 'פ"נ' && !root[0]) root[0] = 'נ';
    if (pattern.gizra === 'פ"י' && !root[0]) root[0] = 'י';
    if (root.some((r) => !r)) continue;

    // הגזרה שנגזרת מן השורש חייבת להיות זו שהתבנית באה ממנה
    if (detectGizra(root) !== pattern.gizra) continue;
    // שורש מרובע חייב להיות מוכר: השלד לבדו אינו מסנן דבר
    if (pattern.gizra === 'מרובעים' && !KNOWN_QUAD_ROOTS.has(root.join(''))) continue;

    /*
     * אימות: מייצרים מחדש את הנטייה ובודקים שהצורה אכן מופיעה בה.
     * בלי הצעד הזה תבנית רחבה הייתה מנתחת גם מילים שאינן פעלים.
     */
    let table: Conjugation;
    try {
      table = conjugate(root.join(''), pattern.binyan);
    } catch {
      continue;
    }

    const forms =
      pattern.tense === 'past' ? table.past
      : pattern.tense === 'present' ? table.present
      : pattern.tense === 'future' ? table.future
      : pattern.tense === 'imperative' ? table.imperative
      : [];

    let plain: string | undefined;
    let nikud: string | undefined;
    let person = pattern.person;

    if (forms.length > 0) {
      const found = forms.find((f) => normalizeForLookup(f.plain) === word);
      if (!found) continue;
      plain = found.plain;
      nikud = found.nikud;
      person = found.key;
    } else {
      const single =
        pattern.tense === 'infinitive' ? table.infinitive
        : pattern.tense === 'passiveParticiple' ? table.passiveParticiple
        : table.gerund;
      if (!single || normalizeForLookup(single.plain) !== word) continue;
      plain = single.plain;
      nikud = single.nikud;
      person = undefined;
    }

    const key = `${root.join('')}|${pattern.binyan}|${pattern.tense}|${person ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      root,
      binyan: pattern.binyan,
      gizra: table.gizra,
      tense: pattern.tense,
      person,
      personLabel: personLabel(pattern.tense, person),
      plain: plain!,
      nikud: nikud!,
      accuracy: table.accuracy,
    });
  }

  // הניתוחים מגזרות מדויקות קודמים
  const rank = { full: 0, partial: 1, approx: 2 } as const;
  return results.sort((a, b) => rank[a.accuracy] - rank[b.accuracy]);
}

/** כמה תבניות נבנו — לצורכי אבחון */
export function patternCount(): number {
  return buildPatterns().length;
}

/** מספר התבניות שנבנו — לצורכי אבחון ותיעוד */
export function analyzerPatternCount(): number {
  return buildPatterns().length;
}

/**
 * ניקוד אותיות השימוש וסיווג שוואים.
 *
 * מקור הכללים: חומרי הקורס ״עברית בהוראה רמה ג׳״ — טבלת חוקי הניקוד,
 * פרק השוואים והדגש הקל, ופרק אותיות השימוש מש״ה וכל״ב.
 *
 * שני החישובים כאן דטרמיניסטיים לחלוטין: הם פועלים על מילה מנוקדת
 * ומחזירים תוצאה יחידה עם נימוק, ולא הערכה הסתברותית.
 */

import {
  SHVA, HIRIQ, TSERE, SEGOL, PATAH, QAMATS, HOLAM, QUBUTS, DAGESH,
  HATAF_PATAH, HATAF_SEGOL, HATAF_QAMATS, QAMATS_QATAN,
  NIQQUD_RE, GUTTURALS, SHIN_DOT,
} from '../text/chars.js';

// ── פירוק מילה מנוקדת לאותיות ולניקודן ──────────────────────────────────────

export interface VocalizedLetter {
  letter: string;
  /** סימני הניקוד שעל האות, לפי סדר הופעתם */
  marks: string[];
  /** מיקום האות במחרוזת המקורית */
  index: number;
}

export function splitVocalized(word: string): VocalizedLetter[] {
  const out: VocalizedLetter[] = [];
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    if (NIQQUD_RE.test(ch)) {
      if (out.length > 0) out[out.length - 1].marks.push(ch);
      continue;
    }
    out.push({ letter: ch, marks: [], index: i });
  }
  return out;
}

const HATAFS = new Set([HATAF_PATAH, HATAF_SEGOL, HATAF_QAMATS]);
const LONG_VOWELS = new Set([QAMATS, TSERE, HOLAM]);

function vowelOf(l: VocalizedLetter | undefined): string | undefined {
  return l?.marks.find((m) => m !== DAGESH && m !== 'ׁ' && m !== 'ׂ');
}

function hasDagesh(l: VocalizedLetter | undefined): boolean {
  return Boolean(l?.marks.includes(DAGESH));
}

// ── סיווג שוואים ────────────────────────────────────────────────────────────

export type ShvaKind = 'נע' | 'נח';

export interface ShvaClassification {
  /** מיקום האות במחרוזת */
  index: number;
  letter: string;
  kind: ShvaKind;
  /** הכלל שהכריע */
  reason: string;
}

export interface ShvaAnalysis {
  word: string;
  shvas: ShvaClassification[];
  /** מקומות שבהם יש דגש קל, עם נימוק */
  dageshQal: Array<{ index: number; letter: string; reason: string }>;
}

/**
 * מסווג כל שווא במילה מנוקדת כנע או כנח.
 *
 * סדר הבדיקות הוא סדר הקדימות שנלמד: הכללים החד־משמעיים
 * (ראש מילה, כ״ף סופית, סוף מילה) קודמים לכלל הכללי של אורך התנועה.
 */
export function classifyShva(word: string, options: { isInfinitive?: boolean } = {}): ShvaAnalysis {
  const letters = splitVocalized(word);
  const shvas: ShvaClassification[] = [];

  for (let i = 0; i < letters.length; i++) {
    const cur = letters[i];
    if (!cur.marks.includes(SHVA)) continue;

    const isLast = i === letters.length - 1;
    const prev = letters[i - 1];
    const next = letters[i + 1];

    let kind: ShvaKind;
    let reason: string;

    if (i === 0) {
      kind = 'נע';
      reason = 'שווא בראש מילה הוא תמיד נע';
    } else if (cur.letter === 'ך') {
      kind = 'נח';
      reason = 'שווא בכ״ף סופית הוא תמיד נח';
    } else if (isLast) {
      kind = 'נח';
      reason = 'שווא בסוף מילה הוא נח';
    } else if (next && next.marks.includes(SHVA) && i + 1 === letters.length - 1) {
      // רצף שוואים בסוף מילה — שניהם נחים
      kind = 'נח';
      reason = 'ברצף שוואים בסוף מילה שני השוואים נחים';
    } else if (prev && prev.marks.includes(SHVA)) {
      kind = 'נע';
      reason = 'בשני שוואים ברצף באמצע מילה הראשון נח והשני נע';
    } else if (hasDagesh(cur)) {
      kind = 'נע';
      reason = 'שווא תחת אות בעלת דגש חזק הוא נע';
    } else if (options.isInfinitive) {
      kind = 'נח';
      reason = 'בשם הפועל, שווא שאינו בראש המילה הוא נח';
    } else {
      const prevVowel = vowelOf(prev);
      if (prevVowel && LONG_VOWELS.has(prevVowel)) {
        kind = 'נע';
        reason = 'השווא בא אחרי תנועה גדולה, ולכן הוא נע';
      } else {
        kind = 'נח';
        reason = 'השווא בא אחרי תנועה קטנה וסוגר הברה, ולכן הוא נח';
      }
    }

    shvas.push({ index: cur.index, letter: cur.letter, kind, reason });
  }

  // דגש קל: באותיות בג״ד כפ״ת, בראש מילה או אחרי שווא נח
  const BEGED = new Set(['ב', 'ג', 'ד', 'כ', 'פ', 'ת']);
  const dageshQal: ShvaAnalysis['dageshQal'] = [];
  for (let i = 0; i < letters.length; i++) {
    const cur = letters[i];
    if (!BEGED.has(cur.letter) || !hasDagesh(cur)) continue;
    if (i === 0) {
      dageshQal.push({ index: cur.index, letter: cur.letter, reason: 'דגש קל בראש מילה' });
      continue;
    }
    const prevShva = shvas.find((s) => s.index === letters[i - 1].index);
    if (prevShva?.kind === 'נח') {
      dageshQal.push({ index: cur.index, letter: cur.letter, reason: 'דגש קל אחרי שווא נח' });
    }
  }

  return { word, shvas, dageshQal };
}

// ── ניקוד אותיות השימוש ─────────────────────────────────────────────────────

export type PrefixLetter = 'ו' | 'כ' | 'ל' | 'ב' | 'מ' | 'ש' | 'ה';

export const PREFIX_NAMES: Record<PrefixLetter, string> = {
  ו: 'ו״ו החיבור',
  כ: 'כ״ף הדימוי',
  ל: 'למ״ד היחס',
  ב: 'בי״ת היחס',
  מ: 'מ״ם היחס',
  ש: 'שי״ן הזיקה',
  ה: 'ה״א הידיעה',
};

export interface PrefixResult {
  prefix: PrefixLetter;
  prefixName: string;
  /** המילה המנוקדת אחרי הצטרפות אות השימוש */
  vocalized: string;
  /** אותה מילה בכתיב חסר ניקוד */
  plain: string;
  /** הכלל שהופעל */
  rule: string;
  /** האם ניתן דגש משלים באות הראשונה של המילה */
  compensatoryDagesh: boolean;
}

const BUMAF = new Set(['ב', 'ו', 'מ', 'פ']);
const ALEF_RESH_AYIN = new Set(['א', 'ר', 'ע']);
const HEY_HET = new Set(['ה', 'ח']);

/** מוסיף דגש לאות הראשונה, אם היא מסוגלת לקבלו */
function addDagesh(letters: VocalizedLetter[]): boolean {
  const first = letters[0];
  if (!first) return false;
  // אותיות גרוניות ורי״ש אינן מקבלות דגש
  if (GUTTURALS.has(first.letter) || first.letter === 'ר') return false;
  if (first.marks.includes(DAGESH)) return true;
  first.marks.unshift(DAGESH);
  return true;
}

/**
 * מרכיב את אות השימוש עם ניקודה.
 *
 * אות מבג"ד כפ"ת נמצאת עכשיו בראש המילה ולכן מקבלת דגש קל: בְּ, כְּ.
 * שי"ן הזיקה היא שׁי"ן ימנית, וחובה לסמן את נקודתה — בלעדיה הצורה
 * אינה מנוקדת כהלכה.
 */
function prefixWithDagesh(prefix: PrefixLetter, vowel: string): string {
  if (prefix === 'ש') return prefix + SHIN_DOT + vowel;
  return 'בכ'.includes(prefix) ? prefix + DAGESH + vowel : prefix + vowel;
}

function join(letters: VocalizedLetter[]): string {
  return letters.map((l) => l.letter + l.marks.join('')).join('').normalize('NFC');
}

function stripNiqqud(s: string): string {
  return s.replace(new RegExp(NIQQUD_RE.source, 'g'), '');
}

/**
 * מצרף אות שימוש למילה מנוקדת ומנקד אותה לפי הכללים.
 *
 * הפונקציה מצפה למילה מנוקדת. בלי ניקוד אין דרך לדעת אם האות
 * הראשונה נושאת שווא, חטף או תנועה, וזה בדיוק מה שקובע את הכלל.
 */
export function attachPrefix(word: string, prefix: PrefixLetter): PrefixResult {
  const letters = splitVocalized(word.normalize('NFC'));
  if (letters.length === 0) throw new Error('לא התקבלה מילה');

  const first = letters[0];
  const firstVowel = vowelOf(first);
  const firstLetter = first.letter;
  let compensatoryDagesh = false;
  let vowel: string;
  let rule: string;

  // מילה מיודעת: כל״ב בולעות את ה״א הידיעה ויורשות את ניקודה.
  // ו״ו החיבור אינה בולעת אותה — ״וְהַחֲלוֹם״ ולא ״וַחֲלוֹם״.
  const startsWithDefiniteHey =
    firstLetter === 'ה' && letters.length > 1 && (firstVowel === PATAH || firstVowel === QAMATS || firstVowel === SEGOL);

  if ((prefix === 'כ' || prefix === 'ל' || prefix === 'ב') && startsWithDefiniteHey) {
    const inherited = firstVowel!;
    const rest = letters.slice(1);
    const gotDagesh = addDagesh(rest);
    return {
      prefix,
      prefixName: PREFIX_NAMES[prefix],
      vocalized: prefixWithDagesh(prefix, inherited) + join(rest),
      plain: prefix + stripNiqqud(join(rest)),
      rule: 'כשאותיות וכל״ב פוגשות את ה״א הידיעה — הן יורשות את ניקודה, הה״א נבלעת, והאות שאחריה מקבלת דגש משלים',
      compensatoryDagesh: gotDagesh,
    };
  }

  switch (prefix) {
    case 'ה': {
      const copy = letters.map((l) => ({ ...l, marks: [...l.marks] }));
      if (ALEF_RESH_AYIN.has(firstLetter)) {
        vowel = QAMATS;
        rule = 'ה״א הידיעה מנוקדת בקמץ לפני אותיות אר״ע, שאינן מקבלות דגש';
      } else if (HEY_HET.has(firstLetter)) {
        // לפני ה או ח מנוקדות בקמץ בהברה לא מוטעמת — סגול
        if (firstVowel === QAMATS || firstVowel === HATAF_QAMATS) {
          vowel = SEGOL;
          rule = 'ה״א הידיעה מנוקדת בסגול לפני ה, ח, ע המנוקדות בקמץ בהברה שאינה מוטעמת';
        } else {
          vowel = PATAH;
          rule = 'ה״א הידיעה מנוקדת בפתח לפני ה ו־ח, בלי דגש משלים';
        }
      } else if (firstLetter === 'ע') {
        if (firstVowel === QAMATS || firstVowel === HATAF_QAMATS) {
          vowel = SEGOL;
          rule = 'ה״א הידיעה מנוקדת בסגול לפני ע המנוקדת בקמץ בהברה שאינה מוטעמת';
        } else {
          vowel = QAMATS;
          rule = 'ה״א הידיעה מנוקדת בקמץ לפני אותיות אר״ע';
        }
      } else {
        vowel = PATAH;
        compensatoryDagesh = addDagesh(copy);
        rule = 'ה״א הידיעה מנוקדת בפתח, והאות שאחריה מקבלת דגש משלים';
      }
      return {
        prefix,
        prefixName: PREFIX_NAMES[prefix],
        vocalized: prefixWithDagesh(prefix, vowel) + join(copy),
        plain: prefix + stripNiqqud(join(copy)),
        rule,
        compensatoryDagesh,
      };
    }

    case 'מ': {
      const copy = letters.map((l) => ({ ...l, marks: [...l.marks] }));
      if (GUTTURALS.has(firstLetter) || firstLetter === 'ר') {
        vowel = TSERE;
        rule = 'מ״ם היחס מנוקדת בצירי לפני אות גרונית — תשלום דגש';
      } else {
        vowel = HIRIQ;
        compensatoryDagesh = addDagesh(copy);
        rule = 'מ״ם היחס מנוקדת בחיריק, והאות שאחריה מקבלת דגש משלים';
      }
      return {
        prefix,
        prefixName: PREFIX_NAMES[prefix],
        vocalized: prefixWithDagesh(prefix, vowel) + join(copy),
        plain: prefix + stripNiqqud(join(copy)),
        rule,
        compensatoryDagesh,
      };
    }

    case 'ש': {
      const copy = letters.map((l) => ({ ...l, marks: [...l.marks] }));
      vowel = SEGOL;
      if (!GUTTURALS.has(firstLetter) && firstLetter !== 'ר') {
        compensatoryDagesh = addDagesh(copy);
        rule = 'שי״ן הזיקה מנוקדת בסגול, והאות שאחריה מקבלת דגש משלים';
      } else {
        rule = 'שי״ן הזיקה מנוקדת בסגול; אות גרונית אינה מקבלת דגש משלים';
      }
      return {
        prefix,
        prefixName: PREFIX_NAMES[prefix],
        vocalized: prefixWithDagesh(prefix, vowel) + join(copy),
        plain: prefix + stripNiqqud(join(copy)),
        rule,
        compensatoryDagesh,
      };
    }

    // ── וכל״ב ──────────────────────────────────────────────────────────
    default: {
      const copy = letters.map((l) => ({ ...l, marks: [...l.marks] }));
      /*
       * הדגש שבאות בג״ד כפ״ת פותחת הוא דגש קל שנובע ממקומה בראש המילה.
       * משנוספה אות שימוש היא כבר אינה בראש המילה, והדגש נופל:
       * בְּכָל ← וּבְכָל.
       */
      if ('בגדכפת'.includes(copy[0].letter)) {
        copy[0].marks = copy[0].marks.filter((m) => m !== DAGESH);
      }

      // יו״ד שוואית: האות מאבדת את ניקודה ואות השימוש מנוקדת בחיריק מלא
      if (firstLetter === 'י' && firstVowel === SHVA) {
        copy[0].marks = copy[0].marks.filter((m) => m !== SHVA);
        return {
          prefix,
          prefixName: PREFIX_NAMES[prefix],
          vocalized: prefixWithDagesh(prefix, HIRIQ) + join(copy),
          plain: prefix + 'י' + stripNiqqud(join(copy.slice(1))),
          rule: 'לפני יו״ד שוואית אות השימוש מנוקדת בחיריק מלא, והיו״ד מאבדת את ניקודה',
          compensatoryDagesh: false,
        };
      }

      // לפני חטף — אות השימוש מקבלת את תנועת החטף
      if (firstVowel && HATAFS.has(firstVowel)) {
        const matching =
          firstVowel === HATAF_PATAH ? PATAH : firstVowel === HATAF_SEGOL ? SEGOL : QAMATS_QATAN;
        return {
          prefix,
          prefixName: PREFIX_NAMES[prefix],
          vocalized: prefixWithDagesh(prefix, matching) + join(copy),
          plain: prefix + stripNiqqud(join(copy)),
          rule: 'לפני חטף אות השימוש מנוקדת בתנועה המקבילה לחטף — פירוק צרור שוואים',
          compensatoryDagesh: false,
        };
      }

      // לפני שווא — פירוק צרור שוואים
      if (firstVowel === SHVA) {
        if (prefix === 'ו') {
          return {
            prefix,
            prefixName: PREFIX_NAMES[prefix],
            vocalized: 'וּ' + join(copy),
            plain: 'ו' + stripNiqqud(join(copy)),
            rule: 'ו״ו החיבור מנוקדת בשורוק לפני שווא — פירוק צרור שוואים',
            compensatoryDagesh: false,
          };
        }
        return {
          prefix,
          prefixName: PREFIX_NAMES[prefix],
          vocalized: prefixWithDagesh(prefix, HIRIQ) + join(copy),
          plain: prefix + stripNiqqud(join(copy)),
          rule: 'אותיות כל״ב מנוקדות בחיריק לפני שווא — פירוק צרור שוואים',
          compensatoryDagesh: false,
        };
      }

      // ו״ו החיבור לפני אותיות בומ״פ
      if (prefix === 'ו' && BUMAF.has(firstLetter)) {
        return {
          prefix,
          prefixName: PREFIX_NAMES[prefix],
          vocalized: 'וּ' + join(copy),
          plain: 'ו' + stripNiqqud(join(copy)),
          rule: 'ו״ו החיבור מנוקדת בשורוק לפני אותיות בומ״פ',
          compensatoryDagesh: false,
        };
      }

      return {
        prefix,
        prefixName: PREFIX_NAMES[prefix],
        vocalized: prefixWithDagesh(prefix, SHVA) + join(copy),
        plain: prefix + stripNiqqud(join(copy)),
        rule: 'ברירת המחדל: אותיות וכל״ב מנוקדות בשווא נע',
        compensatoryDagesh: false,
      };
    }
  }
}

/** מצרף את כל אותיות השימוש למילה אחת, לצורכי הוראה והשוואה */
export function attachAllPrefixes(word: string): PrefixResult[] {
  const order: PrefixLetter[] = ['ה', 'ו', 'ב', 'כ', 'ל', 'מ', 'ש'];
  return order.map((p) => attachPrefix(word, p));
}

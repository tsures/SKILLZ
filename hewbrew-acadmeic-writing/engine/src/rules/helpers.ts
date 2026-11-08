/** עזרים לבניית כללים, כדי שכלל פשוט יהיה שורה אחת ולא עשרים. */

import type {
  Authority,
  Category,
  Finding,
  Rule,
  RuleContext,
  Severity,
  Register,
} from '../text/diagnostics.js';
import { makeFinding } from '../text/diagnostics.js';
import { resolveTopicUrl, resolveDecision } from '../lexicon/topics.js';

const ACADEMY_SITE = 'https://hebrew-academy.org.il/';

/**
 * מקור: האקדמיה ללשון העברית.
 *
 * אם מפתח הנושאים הלשוניים נקצר, הכתובת מפנה לעמוד הנושא עצמו —
 * ״כתיב מלא״, ״ה׳ הידיעה״, ״צורות נסמך״ — לפי שם הנושא הארוך ביותר
 * שמופיע בתיאור הכלל. בלי המפתח נשארת ההפניה לאתר, כדי שלא להמציא
 * קישור עמוק שלא נראה.
 */
export function academy(clause: string, url?: string): Authority {
  if (url) return { source: 'האקדמיה ללשון העברית', clause, url };

  /*
   * סדר העדיפות: ההחלטה עצמה, אחריה עמוד הנושא, ולבסוף שורש האתר.
   * ההחלטה היא ההפניה הטובה ביותר — היא מצביעה על הכלל המקורי ולא
   * על הקטגוריה שהוא שייך אליה.
   */
  const decision = resolveDecision(clause);
  if (decision) {
    return {
      source: 'האקדמיה ללשון העברית',
      clause: `${clause} · החלטה: ${decision.title}`,
      url: decision.link,
    };
  }

  const topic = resolveTopicUrl(clause);
  return topic
    ? { source: 'האקדמיה ללשון העברית', clause: `${clause} · נושא: ${topic.topic}`, url: topic.url }
    : { source: 'האקדמיה ללשון העברית', clause, url: ACADEMY_SITE };
}

/** מקור: מוסכמות עריכה מקובלות שאינן החלטת אקדמיה מפורשת. */
export function convention(clause: string): Authority {
  return { source: 'מוסכמות עריכה', clause };
}

export function houseStyle(clause: string): Authority {
  return { source: 'סגנון בית', clause };
}

export interface RegexRuleSpec {
  id: string;
  category: Category;
  severity: Severity;
  title: string;
  authority: Authority;
  registers?: Register[];
  optIn?: boolean;
  /** דגל g מתווסף אוטומטית */
  pattern: RegExp;
  /** הודעה קבועה, או פונקציה שמקבלת את ההתאמה */
  message: string | ((m: RegExpExecArray, ctx: RuleContext) => string | null);
  suggestion?: string | ((m: RegExpExecArray, ctx: RuleContext) => string | undefined);
  /** מחרוזת החלפה; $1 וכו׳ נתמכים. פונקציה שמחזירה undefined = בלי תיקון אוטומטי */
  replacement?: string | ((m: RegExpExecArray, ctx: RuleContext) => string | undefined);
  autoFixSafe?: boolean;
  /** איזו קבוצת לכידה תסומן; ברירת מחדל 0 = כל ההתאמה */
  group?: number;
}

function expandTemplate(template: string, m: RegExpExecArray): string {
  return template.replace(/\$(\d)/g, (_, d: string) => m[Number(d)] ?? '');
}

/** בונה כלל שמבוסס על ביטוי רגולרי אחד. */
export function regexRule(spec: RegexRuleSpec): Rule {
  const flags = spec.pattern.flags.includes('g') ? spec.pattern.flags : spec.pattern.flags + 'g';
  return {
    id: spec.id,
    category: spec.category,
    severity: spec.severity,
    title: spec.title,
    registers: spec.registers,
    optIn: spec.optIn,
    run(ctx: RuleContext): Finding[] {
      const re = new RegExp(spec.pattern.source, flags);
      const findings: Finding[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(ctx.text)) !== null) {
        if (m[0].length === 0) {
          re.lastIndex++;
          continue;
        }
        const message = typeof spec.message === 'function' ? spec.message(m, ctx) : spec.message;
        if (message === null) continue; // הכלל בחר לוותר על ההתאמה הזו

        const group = spec.group ?? 0;
        let start = m.index;
        let end = m.index + m[0].length;
        if (group > 0 && m[group] !== undefined) {
          const offsetInMatch = m[0].indexOf(m[group]);
          if (offsetInMatch >= 0) {
            start = m.index + offsetInMatch;
            end = start + m[group].length;
          }
        }

        const replacement =
          typeof spec.replacement === 'function'
            ? spec.replacement(m, ctx)
            : spec.replacement !== undefined
              ? expandTemplate(spec.replacement, m)
              : undefined;

        const suggestion =
          typeof spec.suggestion === 'function' ? spec.suggestion(m, ctx) : spec.suggestion;

        findings.push(
          makeFinding(ctx, spec, {
            start,
            end,
            message,
            suggestion,
            replacement,
            autoFixSafe: spec.autoFixSafe,
            authority: spec.authority,
          }),
        );
      }
      return findings;
    },
  };
}

export interface TermEntry {
  /** הצורה השגויה או הפחות מומלצת */
  avoid: string;
  /** הצורה המומלצת */
  prefer: string;
  /** הסבר קצר */
  note?: string;
  /** חומרה חורגת מברירת המחדל של הכלל */
  severity?: Severity;
  /** אין להחליף אוטומטית — ההקשר קובע */
  manual?: boolean;
  /**
   * אין להתיר תחילית לפני הצירוף, גם כשהכלל מתיר אותה. נחוץ כשהצורה
   * עם התחילית היא מילה תקנית אחרת: ״שכנגד״ (תביעה שכנגד), ״שדיי״.
   */
  noPrefix?: boolean;
  /**
   * מילה שאם היא קודמת לצירוף, הצירוף תקין ואין לדווח עליו.
   * ״אודות״ שגוי לבדו, אך ״על אודות״ הוא הצורה התקנית.
   */
  okAfter?: string;
}

const HEBREW_WORD_BOUNDARY_BEFORE = '(?<![\\u05D0-\\u05EA\\u0591-\\u05C7])';
const HEBREW_LETTER = /[א-ת]/;
const HEBREW_WORD_BOUNDARY_AFTER = '(?![\\u05D0-\\u05EA\\u0591-\\u05C7])';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** האות האחרונה בצירוף היא אות שימוש בודדת, הדבוקה למילה שאחריה */
function endsWithAttachedAffix(term: string): boolean {
  const last = term.trim().split(/\s+/).pop() ?? '';
  return last.length === 1 && 'ושהכלבמ'.includes(last);
}

/** האם המילה שקדמה למיקום היא word */
function precededByWord(text: string, start: number, word: string): boolean {
  const before = text.slice(0, start).trimEnd();
  if (!before.endsWith(word)) return false;
  const charBefore = before[before.length - word.length - 1];
  return charBefore === undefined || !HEBREW_LETTER.test(charBefore);
}

/**
 * בונה תבנית שמתאימה לצירוף שלם בלבד — לא כחלק ממילה ארוכה יותר.
 * גבול המילה של JavaScript אינו מתאים לעברית, ולכן משתמשים בלוקאהד/לוקביהיינד.
 */
export function wholeWordPattern(term: string): string {
  return HEBREW_WORD_BOUNDARY_BEFORE + escapeRegExp(term).replace(/ /g, '\\s+') + HEBREW_WORD_BOUNDARY_AFTER;
}

export interface TermRuleSpec {
  id: string;
  category: Category;
  severity: Severity;
  title: string;
  authority: Authority | ((entry: TermEntry) => Authority);
  registers?: Register[];
  optIn?: boolean;
  entries: TermEntry[];
  /** תבנית ההודעה; ברירת מחדל מנוסחת אוטומטית */
  message?: (entry: TermEntry, matched: string) => string;
  /** האם להתיר תחיליות מש"ה וכל"ב לפני הצירוף */
  allowPrefixes?: boolean;
}

/**
 * בונה כלל אחד מרשימת מונחים. כל הערכים מאוחדים לביטוי רגולרי אחד
 * כדי לעבור על הטקסט פעם אחת במקום פעם לכל מונח.
 */
export function termRule(spec: TermRuleSpec): Rule {
  const byMatch = new Map<string, TermEntry>();
  for (const e of spec.entries) byMatch.set(e.avoid, e);

  // הארוכים קודם, כדי ש"בנוסף לכך" יתפוס לפני "בנוסף"
  const sorted = [...spec.entries].sort((a, b) => b.avoid.length - a.avoid.length);
  const prefix = spec.allowPrefixes ? '(?:[\\u05D5\\u05E9\\u05DB\\u05DC\\u05D1\\u05DE\\u05D4])?' : '';

  /*
   * גבול המילה נבדק לכל חלופה בנפרד. צירוף שמסתיים באות שימוש —
   * ״היות ו״, ״בגלל ש״ — נצמד למילה שאחריו, ולכן דווקא עליו אסור
   * לדרוש שלא תבוא אחריו אות עברית.
   */
  const alternatives = sorted.map((e) => {
    const body = escapeRegExp(e.avoid).replace(/ /g, '\\s+');
    const lastWord = e.avoid.trim().split(/\s+/).pop() ?? '';
    const endsWithAffix = lastWord.length === 1 && 'ושהכלבמ'.includes(lastWord);
    return endsWithAffix ? body : body + HEBREW_WORD_BOUNDARY_AFTER;
  });

  const source = HEBREW_WORD_BOUNDARY_BEFORE + prefix + '(' + alternatives.join('|') + ')';

  return {
    id: spec.id,
    category: spec.category,
    severity: spec.severity,
    title: spec.title,
    registers: spec.registers,
    optIn: spec.optIn,
    run(ctx: RuleContext): Finding[] {
      const re = new RegExp(source, 'g');
      const findings: Finding[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(ctx.text)) !== null) {
        const matched = m[1];
        // רווחים מרובים בטקסט המקורי אינם משנים את זהות הערך
        const key = matched.replace(/\s+/g, ' ');
        const entry = byMatch.get(key) ?? byMatch.get(matched);
        if (!entry) continue;
        const start = m.index + m[0].indexOf(matched);
        // ״שכנגד״ ו״שדיי״ תקינות, אף ש״כנגד״ ו״דיי״ אינן
        if (entry.noPrefix && HEBREW_LETTER.test(m[0].slice(0, m[0].indexOf(matched)))) continue;
        // ״על אודות״ תקין, אף ש״אודות״ לבדו אינו
        if (entry.okAfter && precededByWord(ctx.text, start, entry.okAfter)) continue;
        const message =
          spec.message?.(entry, matched) ??
          `במקום «${entry.avoid}» עדיף «${entry.prefer}»${entry.note ? ` — ${entry.note}` : ''}.`;
        findings.push(
          makeFinding(ctx, spec, {
            start,
            end: start + matched.length,
            severity: entry.severity ?? spec.severity,
            message,
            suggestion: entry.prefer,
            /*
           * ״בטרם ו״ ← ״בטרם״ מוחק ו״ו שדבוקה למילה הבאה, ובלי רווח
           * התיקון מדביק שתי מילים: ״בטרםשבה״. נוסף רווח במקום האות.
           */
          replacement: entry.manual
            ? undefined
            : endsWithAttachedAffix(entry.avoid) && !endsWithAttachedAffix(entry.prefer)
              ? entry.prefer + ' '
              : entry.prefer,
            autoFixSafe: !entry.manual,
            authority: typeof spec.authority === 'function' ? spec.authority(entry) : spec.authority,
          }),
        );
      }
      return findings;
    },
  };
}

/** טיפוסי הליבה: ממצא, חומרה, קטגוריה, וכלל. */

export type Severity = 'error' | 'warning' | 'suggestion' | 'style';

export const SEVERITY_ORDER: Record<Severity, number> = {
  error: 3,
  warning: 2,
  suggestion: 1,
  style: 0,
};

export const SEVERITY_LABEL_HE: Record<Severity, string> = {
  error: 'שגיאה',
  warning: 'אזהרה',
  suggestion: 'הצעה',
  style: 'סגנון',
};

export type Category =
  | 'typography'
  | 'punctuation'
  | 'ktiv-male'
  | 'syntax'
  | 'morphology'
  | 'common-errors'
  | 'foreign-terms'
  | 'academic'
  | 'literary'
  | 'numbers'
  | 'spelling'
  | 'house-style';

export const CATEGORY_LABEL_HE: Record<Category, string> = {
  typography: 'טיפוגרפיה',
  punctuation: 'פיסוק',
  'ktiv-male': 'כתיב מלא',
  syntax: 'תחביר',
  morphology: 'צורות ונטיות',
  'common-errors': 'שגיאות נפוצות',
  'foreign-terms': 'מילים לועזיות',
  academic: 'כתיבה אקדמית',
  literary: 'עריכה ספרותית',
  numbers: 'מספרים ותאריכים',
  spelling: 'איות',
  'house-style': 'סגנון בית',
};

/** מרשם הכתיבה — משפיע אילו כללים פעילים ובאיזו חומרה */
export type Register = 'academic' | 'literary' | 'neutral';

export interface Authority {
  /** מקור הכלל */
  source: string;
  /** הפניה מדויקת: שם הכלל או סעיף */
  clause?: string;
  url?: string;
}

export interface Finding {
  ruleId: string;
  category: Category;
  severity: Severity;
  /** היסט תחילת הקטע בטקסט המקורי (כולל) */
  start: number;
  /** היסט סוף הקטע (לא כולל) */
  end: number;
  /** הקטע עצמו — חייב להיות זהה ל־text.slice(start, end) */
  excerpt: string;
  /** הסבר בעברית מה לא תקין */
  message: string;
  /** מה לכתוב במקום, בניסוח חופשי */
  suggestion?: string;
  /** מחרוזת מדויקת להחלפת הקטע. קיומה מאפשר תיקון אוטומטי. */
  replacement?: string;
  /** האם התיקון בטוח דיו כדי להחילו בלי אישור פרטני */
  autoFixSafe: boolean;
  authority: Authority;
}

export interface RuleContext {
  /** הטקסט המקורי, כפי שנמסר */
  text: string;
  register: Register;
  /** טוקנים ומשפטים מחושבים מראש, משותפים לכל הכללים */
  doc: import('./tokenize.js').Document;
  /** הגדרות סגנון בית */
  config: import('../config.js').ResolvedConfig;
}

export interface Rule {
  id: string;
  category: Category;
  /** חומרת ברירת המחדל; ניתנת לדריסה בהגדרות */
  severity: Severity;
  /** תיאור קצר לקטלוג */
  title: string;
  /** באילו מרשמים הכלל פעיל כברירת מחדל */
  registers?: Register[];
  /** כבוי כברירת מחדל — נדרשת הפעלה מפורשת */
  optIn?: boolean;
  run(ctx: RuleContext): Finding[];
}

/** בונה ממצא ומוודא שההיסטים והקטע עקביים. */
export function makeFinding(
  ctx: Pick<RuleContext, 'text'>,
  rule: Pick<Rule, 'id' | 'category' | 'severity'>,
  init: {
    start: number;
    end: number;
    message: string;
    suggestion?: string;
    replacement?: string;
    autoFixSafe?: boolean;
    authority: Authority;
    severity?: Severity;
  },
): Finding {
  const start = Math.max(0, Math.min(init.start, ctx.text.length));
  const end = Math.max(start, Math.min(init.end, ctx.text.length));
  return {
    ruleId: rule.id,
    category: rule.category,
    severity: init.severity ?? rule.severity,
    start,
    end,
    excerpt: ctx.text.slice(start, end),
    message: init.message,
    suggestion: init.suggestion,
    replacement: init.replacement,
    autoFixSafe: init.autoFixSafe ?? init.replacement !== undefined,
    authority: init.authority,
  };
}

/** מיון ממצאים: לפי מיקום, ואז לפי חומרה יורדת. */
export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) =>
      a.start - b.start ||
      SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity] ||
      a.ruleId.localeCompare(b.ruleId),
  );
}

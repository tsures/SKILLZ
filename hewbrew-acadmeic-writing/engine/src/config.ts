/**
 * כללי בית — הגדרות שהמשתמש יכול לספק כדי לדרוס את ברירות המחדל.
 *
 * הקובץ נטען אוטומטית מ־hebrew-editor.config.json בתיקיית העבודה,
 * או מהנתיב שב־HEBREW_EDITOR_CONFIG. היעדר קובץ אינו שגיאה.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import type { Register, Severity, Category } from './text/diagnostics.js';

export interface TermPreference {
  /** הצורה שאין להשתמש בה */
  avoid: string;
  /** מה לכתוב במקומה */
  prefer: string;
  /** נימוק שיוצג למשתמש */
  reason?: string;
  severity?: Severity;
  /** האם avoid הוא ביטוי רגולרי במקום מחרוזת */
  regex?: boolean;
}

export interface HouseStyleConfig {
  /** מרשם ברירת מחדל כשלא נמסר בקריאה */
  register?: Register;
  /** כללים לכיבוי לפי מזהה */
  disabledRules?: string[];
  /** כללים להפעלה, כולל כאלה שכבויים כברירת מחדל */
  enabledRules?: string[];
  /** קטגוריות לכיבוי מלא */
  disabledCategories?: Category[];
  /** דריסת חומרה לכלל מסוים */
  severityOverrides?: Record<string, Severity>;
  /** מונחים אסורים ומועדפים — נבדקים ככלל house-style/terms */
  terms?: TermPreference[];
  /** תוספות לרשימת הכתיב המלא: חסר → מלא */
  ktivMale?: Record<string, string>;
  /** מילים שלא יסומנו כשגיאת איות (שמות, מונחי תחום) */
  allowWords?: string[];
  /** אורך משפט מרבי לפני אזהרה במרשם אקדמי */
  maxSentenceWords?: number;
}

export interface ResolvedConfig extends Required<Omit<HouseStyleConfig, 'terms' | 'ktivMale' | 'allowWords' | 'severityOverrides'>> {
  terms: TermPreference[];
  ktivMale: Record<string, string>;
  allowWords: Set<string>;
  severityOverrides: Record<string, Severity>;
  /** מאיפה נטענו ההגדרות, לצורכי דיווח */
  sourcePath: string | null;
}

export const DEFAULT_CONFIG: ResolvedConfig = {
  register: 'neutral',
  disabledRules: [],
  enabledRules: [],
  disabledCategories: [],
  severityOverrides: {},
  terms: [],
  ktivMale: {},
  allowWords: new Set<string>(),
  maxSentenceWords: 40,
  sourcePath: null,
};

const CONFIG_FILENAMES = ['hebrew-editor.config.json', '.hebrew-editor.json'];

function findConfigPath(cwd: string): string | null {
  const fromEnv = process.env.HEBREW_EDITOR_CONFIG;
  if (fromEnv && existsSync(fromEnv)) return resolve(fromEnv);
  for (const name of CONFIG_FILENAMES) {
    const candidate = join(cwd, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function resolveConfig(raw: HouseStyleConfig, sourcePath: string | null = null): ResolvedConfig {
  return {
    register: raw.register ?? DEFAULT_CONFIG.register,
    disabledRules: raw.disabledRules ?? [],
    enabledRules: raw.enabledRules ?? [],
    disabledCategories: raw.disabledCategories ?? [],
    severityOverrides: raw.severityOverrides ?? {},
    terms: raw.terms ?? [],
    ktivMale: raw.ktivMale ?? {},
    allowWords: new Set(raw.allowWords ?? []),
    maxSentenceWords: raw.maxSentenceWords ?? DEFAULT_CONFIG.maxSentenceWords,
    sourcePath,
  };
}

let cached: ResolvedConfig | null = null;

/**
 * טוען את הגדרות סגנון הבית. קובץ פגום מדווח ל־stderr ואינו מפיל את השרת —
 * עדיף להמשיך עם ברירות המחדל מאשר לאבד את כל הבדיקות בגלל פסיק מיותר.
 */
export function loadConfig(cwd: string = process.cwd(), force = false): ResolvedConfig {
  if (cached && !force) return cached;
  const path = findConfigPath(cwd);
  if (!path) {
    cached = { ...DEFAULT_CONFIG, allowWords: new Set() };
    return cached;
  }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as HouseStyleConfig;
    cached = resolveConfig(raw, path);
  } catch (err) {
    process.stderr.write(
      `[hebrew-editor] שגיאה בקריאת קובץ ההגדרות ${path}: ${(err as Error).message}\n` +
        '[hebrew-editor] ממשיך עם הגדרות ברירת המחדל.\n',
    );
    cached = { ...DEFAULT_CONFIG, allowWords: new Set() };
  }
  return cached;
}

export function clearConfigCache(): void {
  cached = null;
}

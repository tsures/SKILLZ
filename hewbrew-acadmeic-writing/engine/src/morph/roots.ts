/** זיהוי גזרת השורש. */

import { GUTTURALS } from '../text/chars.js';

export type Gizra =
  | 'שלמים'
  | 'פ"נ'
  | 'פ"י'
  | 'פ"א'
  | 'ע"ו'
  | 'ע"י'
  | 'ע"ע'
  | 'ל"ה'
  | 'ל"א'
  | 'מרובעים'
  | 'גרוניים';

export const GIZRA_DESCRIPTIONS: Record<Gizra, string> = {
  שלמים: 'כל אותיות השורש נשמרות בכל הנטייה',
  'פ"נ': 'פ״א הפועל נו״ן — נבלעת בעתיד ובבניין הפעיל ומותירה דגש',
  'פ"י': 'פ״א הפועל יו״ד — מתגלגלת לו״ו או נופלת',
  'פ"א': 'פ״א הפועל אל״ף — משפיעה על תנועת התחילית',
  'ע"ו': 'עי״ן הפועל ו״ו — נחי העי״ן, האות האמצעית אינה נשמעת כעיצור',
  'ע"י': 'עי״ן הפועל יו״ד — נחי העי״ן',
  'ע"ע': 'כפולים — עי״ן ולמ״ד הפועל זהות',
  'ל"ה': 'למ״ד הפועל ה״א — הנפוצה שבגזרות, הסיומת משתנה בכל הזמנים',
  'ל"א': 'למ״ד הפועל אל״ף — האל״ף נחה ואינה נשמעת',
  מרובעים: 'שורש בן ארבע אותיות',
  גרוניים: 'אחת מאותיות השורש גרונית — חטפים במקום שווא נע ואי־קבלת דגש',
};

/**
 * מזהה את הגזרה. הסדר חשוב: גזרה שמשנה את השלד הרבה יותר —
 * ל״ה, נחי העי״ן — גוברת על סיווג ״גרוניים״ שהוא בעיקר עניין של ניקוד.
 */
export function detectGizra(radicals: string[]): Gizra {
  if (radicals.length === 4) return 'מרובעים';
  const [p, a, l] = radicals;

  if (l === 'ה') return 'ל"ה';
  if (l === 'א') return 'ל"א';
  if (a === 'ו') return 'ע"ו';
  if (a === 'י') return 'ע"י';
  if (a === l) return 'ע"ע';
  if (p === 'נ') return 'פ"נ';
  if (p === 'י') return 'פ"י';
  if (p === 'א') return 'פ"א';
  if (radicals.some((r) => GUTTURALS.has(r) || r === 'ר')) return 'גרוניים';

  return 'שלמים';
}

/**
 * שורש חלש ביותר ממקום אחד — ח־י־ה הוא גם ע״י וגם ל״ה, נ־ט־ה הוא גם
 * פ״נ וגם ל״ה. detectGizra מחזיר גזרה אחת בלבד, ולכן הנטייה של שורש
 * כזה נגזרת מתבנית שמכסה רק חלק מן החולשה שלו.
 */
export function isDoublyWeak(radicals: string[]): boolean {
  if (radicals.length !== 3) return false;
  const [p, a, l] = radicals;
  const weak = [
    p === 'נ' || p === 'י' || p === 'א',
    a === 'ו' || a === 'י' || a === l,
    l === 'ה' || l === 'א',
  ];
  return weak.filter(Boolean).length >= 2;
}

/** מנקה קלט של שורש: מסיר ניקוד, גרשיים, נקודות ורווחים */
export function normalizeRoot(input: string): string[] {
  const letters = [...input.replace(/[^א-ת]/g, '')];
  // אות סופית בשורש נכתבת בצורתה הרגילה
  const FINALS: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
  return letters.map((ch) => FINALS[ch] ?? ch);
}

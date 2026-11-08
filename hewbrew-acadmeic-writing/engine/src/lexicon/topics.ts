/**
 * מפתח הנושאים הלשוניים של האקדמיה — הפניות אמיתיות לכללים.
 *
 * עד שנקצר המפתח, כל ממצא הפנה לשורש האתר, משום שאין להמציא קישורים
 * עמוקים שלא נראו. עכשיו אפשר להפנות לעמוד הנושא עצמו: כלל שעוסק
 * בכתיב מלא מפנה לעמוד ״כתיב מלא״, וכלל שעוסק בה״א הידיעה לעמוד שלה.
 *
 * ההתאמה נעשית לפי שם הנושא הארוך ביותר שמופיע בתיאור הכלל. שם ארוך
 * מנצח כדי ש״אותיות סופיות״ ייבחר על פני ״אותיות״.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface AcademyTopic {
  topic: string;
  url: string;
}

export interface AcademyIdiom {
  idiom: string;
  vocalized: string;
  url: string;
}

interface TopicStore {
  topics: AcademyTopic[];
  idioms: AcademyIdiom[];
  /** שמות הנושאים ממוינים מהארוך לקצר, לחיפוש ההתאמה הטובה ביותר */
  ordered: AcademyTopic[];
}

const EMPTY: TopicStore = { topics: [], idioms: [], ordered: [] };

function dataPath(): string {
  const fromEnv = process.env.HEBREW_EDITOR_TOPICS_DATA;
  if (fromEnv) return resolve(fromEnv);
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, '..', '..', 'data', 'academy-topics.json');
}

let cached: TopicStore | null = null;

export function loadTopics(force = false): TopicStore {
  if (cached && !force) return cached;

  const path = dataPath();
  if (!existsSync(path)) {
    cached = EMPTY;
    return cached;
  }

  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as {
      topics?: AcademyTopic[];
      idioms?: AcademyIdiom[];
    };
    const topics = (raw.topics ?? []).filter((t) => t.topic && t.url);
    cached = {
      topics,
      idioms: raw.idioms ?? [],
      ordered: [...topics].sort((a, b) => b.topic.length - a.topic.length),
    };
  } catch (err) {
    process.stderr.write(
      `[hebrew-editor] מפתח הנושאים ב־${path} אינו קריא: ${(err as Error).message}\n`,
    );
    cached = EMPTY;
  }
  return cached;
}

/** מנרמל לצורך השוואה: מסיר ניקוד, גרשיים ומירכאות */
function normalize(text: string): string {
  return text
    .replace(/[֑-ׇ]/g, '')
    .replace(/["'׳״]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── התאמת החלטה ──────────────────────────────────────────────────────────────

/** מילים תפקודיות שאין להן ערך מבחין בהתאמה */
const STOPWORDS = new Set([
  'של', 'את', 'עם', 'על', 'אל', 'מן', 'או', 'גם', 'לפני', 'אחרי', 'בין',
  'כללי', 'כלל', 'הכללים', 'לשון', 'העברית', 'האקדמיה', 'החלטות',
]);

/**
 * מפרק טקסט למילים, וכל מילה מיוצגת בשתי צורותיה האפשריות:
 * כפי שהיא, ובלי אות שימוש פותחת.
 *
 * חשוב לשמור את שתיהן ולא להחליט מראש. הסרה עיוורת של האות הראשונה
 * הורסת מילים שהאות הזאת שייכת לשורשן: ״שאלה״ הופכת ל״אלה״ ו״מילת״
 * ל״ילת״, ואז שום התאמה אינה נמצאת.
 *
 * כל מילה נספרת פעם אחת, ולכן שמירת שתי הצורות אינה מנפחת את הציון.
 */
function wordUnits(text: string): string[][] {
  const units: string[][] = [];
  for (const raw of normalize(text).split(/[^א-ת]+/)) {
    if (raw.length < 3 || STOPWORDS.has(raw)) continue;
    const bare = raw.replace(/^[הובכלמש]/, '');
    units.push(bare.length >= 3 && bare !== raw ? [raw, bare] : [raw]);
  }
  return units;
}

/** כל הצורות של כל המילים, לבדיקת שייכות מהירה */
function flatten(units: string[][]): Set<string> {
  const out = new Set<string>();
  for (const unit of units) for (const form of unit) out.add(form);
  return out;
}

export interface AcademyDecision {
  id: number;
  title: string;
  link: string;
  topics: string[];
}

let decisionsCache: { decisions: AcademyDecision[]; units: string[][][] } | null = null;

function loadDecisions(): { decisions: AcademyDecision[]; units: string[][][] } {
  if (decisionsCache) return decisionsCache;

  const here = dirname(fileURLToPath(import.meta.url));
  const path =
    process.env.HEBREW_EDITOR_DECISIONS_DATA ??
    join(here, '..', '..', 'data', 'academy-decisions.json');

  if (!existsSync(path)) {
    decisionsCache = { decisions: [], units: [] };
    return decisionsCache;
  }

  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as { decisions?: AcademyDecision[] };
    const decisions = (raw.decisions ?? []).filter((d) => d.title && d.link);
    decisionsCache = {
      decisions,
      units: decisions.map((d) => wordUnits(d.title)),
    };
  } catch {
    decisionsCache = { decisions: [], units: [] };
  }
  return decisionsCache;
}

export interface ResolvedAuthority {
  clause: string;
  url: string;
}

/**
 * מוצא את ההחלטה שהכי מתאימה לתיאור הכלל.
 *
 * הציון הוא מספר מילות התוכן המשותפות, מנורמל לאורך כותרת ההחלטה
 * כדי שכותרת קצרה וממוקדת — ״יב. מקף״ — תנצח כותרת ארוכה שבמקרה
 * מכילה את אותה מילה. נדרשות שתי מילים משותפות לפחות, או מילה אחת
 * ארוכה ומבחינה, כדי שלא תיווצר הפניה מקרית.
 */
export function resolveDecision(clause: string): AcademyDecision | undefined {
  const { decisions, units } = loadDecisions();
  if (decisions.length === 0) return undefined;

  /*
   * תיאורי הכללים בנויים ״כללי X — הפרט הספציפי״. ההתאמה נעשית קודם
   * מול הפרט, שאם לא כן כל כלל פיסוק היה מופנה להחלטה הכללית ״כללי
   * הפיסוק״ במקום להחלטה על המקף או על הגרשיים.
   */
  const parts = clause.split(/\s+[—–-]\s+/);
  const specific = parts.length > 1 ? parts[parts.length - 1] : clause;
  const context = flatten(wordUnits(clause));

  return (
    matchDecision(specific, decisions, units, context) ??
    matchDecision(clause, decisions, units, context)
  );
}

function matchDecision(
  text: string,
  decisions: AcademyDecision[],
  units: string[][][],
  context: Set<string>,
): AcademyDecision | undefined {
  const needle = flatten(wordUnits(text));
  if (needle.size === 0) return undefined;

  let best:
    | { decision: AcademyDecision; coverage: number; inTopic: boolean; shared: number }
    | undefined;

  for (const [i, titleUnits] of units.entries()) {
    if (titleUnits.length === 0) continue;

    // מילה נחשבת משותפת אם אחת מצורותיה מופיעה בתיאור הכלל
    let shared = 0;
    for (const unit of titleUnits) {
      if (unit.some((form) => needle.has(form))) shared++;
    }
    if (shared === 0) continue;

    const coverage = shared / titleUnits.length;
    /*
     * מילה משותפת אחת מספיקה רק אם היא כל תוכן הכותרת — ״יב. מקף״
     * מול תיאור שמדבר על המקף. מעבר לכך נדרשות שתי מילים משותפות
     * שהן לפחות מחצית הכותרת, כדי שלא תיווצר הפניה על סמך מילה מקרית.
     */
    if (shared < 2 && coverage < 1) continue;
    if (coverage < 0.5) continue;

    /*
     * שובר שוויון: החלטה שהפרק שלה מוזכר בתיאור הכלל עדיפה.
     * ״מקף״ מופיע גם בהחלטת פיסוק וגם בהחלטת ניקוד על המילה עצמה;
     * כלל שמדבר על פיסוק מתכוון לראשונה.
     */
    const inTopic = decisions[i].topics.some((t) =>
      wordUnits(t).some((unit) => unit.some((form) => context.has(form))),
    );

    const better =
      !best ||
      coverage > best.coverage ||
      (coverage === best.coverage && inTopic && !best.inTopic) ||
      (coverage === best.coverage && inTopic === best.inTopic && shared > best.shared);
    if (better) best = { decision: decisions[i], coverage, inTopic, shared };
  }

  return best?.decision;
}

/**
 * מוצא את עמוד הנושא המתאים ביותר לתיאור כלל.
 * מחזיר undefined כשאין התאמה — ואז נשארת ההפניה הכללית.
 */
export function resolveTopicUrl(clause: string): AcademyTopic | undefined {
  const store = loadTopics();
  if (store.ordered.length === 0) return undefined;
  const haystack = normalize(clause);

  for (const entry of store.ordered) {
    const needle = normalize(entry.topic);
    // נושא בן מילה אחת קצרה מדי מייצר התאמות מקריות
    if (needle.length < 4) continue;
    if (haystack.includes(needle)) return entry;
  }
  return undefined;
}

export function academyIdioms(): AcademyIdiom[] {
  return loadTopics().idioms;
}

export function topicsSummary(): string {
  const store = loadTopics();
  if (store.topics.length === 0) {
    return 'מפתח הנושאים אינו טעון. אפשר לייצר אותו בפקודה: npm run harvest:topics';
  }
  return `${store.topics.length} נושאים לשוניים · ${store.idioms.length} מטבעות לשון · מקור: האקדמיה ללשון העברית`;
}

export function clearTopicsCache(): void {
  cached = null;
}

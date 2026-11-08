/** מבחני זהב: לכל כלל לפחות משפט אחד שהוא אמור לתפוס. */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { analyze } from '../engine.js';
import { applyFixes } from '../text/fixer.js';
import { ALL_RULES, findDuplicateRuleIds } from '../rules/index.js';
import { DEFAULT_CONFIG, type ResolvedConfig } from '../config.js';
import type { Register } from '../text/diagnostics.js';

const config: ResolvedConfig = { ...DEFAULT_CONFIG, allowWords: new Set() };

function check(text: string, register: Register = 'neutral') {
  return analyze(text, { config, register });
}

function ruleIds(text: string, register: Register = 'neutral'): string[] {
  return check(text, register).findings.map((f) => f.ruleId);
}

function assertCatches(text: string, ruleId: string, register: Register = 'neutral') {
  const ids = ruleIds(text, register);
  assert.ok(
    ids.includes(ruleId),
    `«${text}» היה אמור להפעיל את ${ruleId}, אך הופעלו: ${ids.join(', ') || 'כלום'}`,
  );
}

function assertClean(text: string, ruleId: string, register: Register = 'neutral') {
  const ids = ruleIds(text, register);
  assert.ok(!ids.includes(ruleId), `«${text}» לא היה אמור להפעיל את ${ruleId}`);
}

/** מוודא שהתיקון האוטומטי מפיק את הצורה הצפויה, ולא רק מדווח עליה */
function assertFixes(text: string, expected: string, register: Register = 'neutral') {
  const fixed = applyFixes(text, check(text, register).findings, { onlySafe: true }).text;
  assert.ok(
    fixed.includes(expected),
    `«${text}» היה אמור להיות מתוקן ל־«${expected}», והתקבל: «${fixed}»`,
  );
}

// ── שלמות הקטלוג ────────────────────────────────────────────────────────────

test('מזהי הכללים ייחודיים', () => {
  assert.deepEqual(findDuplicateRuleIds(), []);
});

test('לכל כלל יש כותרת וקטגוריה', () => {
  for (const rule of ALL_RULES) {
    assert.ok(rule.title.length > 0, `לכלל ${rule.id} אין כותרת`);
    assert.ok(rule.category.length > 0, `לכלל ${rule.id} אין קטגוריה`);
  }
});

// ── שלמות ההיסטים ───────────────────────────────────────────────────────────

test('כל ממצא מצביע על הקטע שהוא מדווח עליו', () => {
  const text = [
    'בכדי לבדוק את התוכנית , כתבתי שלוש מסמכים בשנת תשפה.',
    'היות ואין לי נסיון, אני יבדוק שוב את הבית ספר.',
    'הוא רקם עור וגידים ואינם רצו להשתתף בכך.',
  ].join('\n');

  for (const f of check(text).findings) {
    assert.equal(
      text.slice(f.start, f.end),
      f.excerpt,
      `ההיסטים של ${f.ruleId} אינם תואמים לקטע שדווח`,
    );
    assert.ok(f.start <= f.end, `${f.ruleId}: היסט התחלה גדול מהיסט הסיום`);
    assert.ok(f.message.length > 0, `${f.ruleId}: אין הודעה`);
    assert.ok(f.authority.source.length > 0, `${f.ruleId}: אין מקור`);
  }
});

// ── טיפוגרפיה ופיסוק ────────────────────────────────────────────────────────

test('טיפוגרפיה', () => {
  assertCatches('הגענו לבית , ואז יצאנו.', 'typo/space-before-punctuation');
  assertCatches('הגענו לבית,ואז יצאנו.', 'typo/space-after-punctuation');
  assertCatches('זה  רווח כפול.', 'typo/double-space');
  assertCatches('הוא אמר צה"ל.', 'typo/gershayim-acronym');
  assertCatches('כתוב עמ\' 15 בספר.', 'typo/geresh-abbreviation');
  assertCatches('הסכם בין-לאומי נחתם.', 'typo/maqaf-compound');
  assertCatches('חשבתי על זה...', 'typo/ellipsis');
  assertCatches('זה נהדר!!', 'typo/repeated-punctuation');
  assertCatches('הוא הלך לשלומ.', 'typo/final-letters');
  assertCatches('כתבתי םילים רבות.', 'typo/final-letters');
});

test('פסוקית זיקה ממשיכה', () => {
  // שלוש הדוגמאות שהאקדמיה פותחת בהן, עם התיקון שהיא עצמה מציעה
  assertCatches('ראש הממשלה עדכן את השרה שבירכה על ההחלטה.', 'syntax/continuative-relative');
  assertCatches('נציגי השכונות פנו אל העירייה שהבטיחה לטפל בבעיה.', 'syntax/continuative-relative');
  assertCatches('המכונית פגעה ברוכב אופניים שבנס יצא ללא פגע.', 'syntax/continuative-relative');

  /*
   * פסוקית לוואי תקינה מוסרת מידע הקודם בזמן או בהיגיון, ולכן היא
   * אינה נפגעת. שלוש הראשונות הן הדוגמאות התקינות של האקדמיה.
   */
  for (const ok of [
    'עדיין לא קראתי את הספר שכולם מדברים עליו.',
    'שלחנו אליך את רשימת הספרים שיצאו לאור בשנה האחרונה.',
    'הסופרים שספריהם הם הנמכרים ביותר השכילו לשלב דרמה.',
    'פנינו אל החברה שהוקמה בשנת 1990.',
    'עדכנתי את הצוות שעובד על הפרויקט.',
    'חיפשנו חברה שהבטיחה אחריות מלאה.',
  ]) {
    assertClean(ok, 'syntax/continuative-relative');
  }
});

test('פסוקית זמן נפתחת בכְּשֶׁ־', () => {
  assertFixes('שנגיע לגשר - נעבור אותו.', 'כשנגיע לגשר');
  assertFixes('אתמול שחזרנו הביתה היה חושך.', 'אתמול כשחזרנו');

  /*
   * שֶׁ־ בשלושת תפקידיה האחרים: לוואי אחרי שם עצם, פסוקית תוכן אחרי
   * פועל אמירה, ומילית שעבוד קבועה. וכן משאלה עצמאית, שאינה פסוקית.
   */
  for (const ok of [
    'הסרט שראינו היה מצוין.',
    'הבטחתי לו שאבוא לבקר.',
    'אחרי שהגענו התיישבנו.',
    'כדי שנצליח צריך להתאמץ.',
    'עכשיו שאבא פסק מה אפשר לעשות.',
    'שיהיה בהצלחה.',
  ]) {
    assertClean(ok, 'syntax/time-clause-kshe');
  }
});

test('כללי תחביר וניסוח של האקדמיה', () => {
  assertFixes('בבית הספר יש בערך כאלף תלמידים.', 'יש כאלף תלמידים');
  assertFixes('שנית כול נבחן את החלופות.', 'שנית נבחן');
  assertClean('ראשית כול נבדוק את הנתונים.', 'academy/shenit-kol');

  assertFixes('את איננה מבינה אותי.', 'את אינך מבינה');
  assertFixes('אתה איננו יודע.', 'אתה אינך יודע');
  assertClean('אני אינני מסכים.', 'academy/ein-person-agreement');
  assertClean('היא איננה מבינה.', 'academy/ein-person-agreement');

  assertCatches('בואי ניפגש שבוע הבא.', 'academy/time-adverbial-preposition');
  // הצירוף כנושא המשפט אינו זקוק למילת יחס
  assertClean('השבוע הבא יהיה עמוס.', 'academy/time-adverbial-preposition');
  assertClean('בשנה שעברה טיילנו בצפון.', 'academy/time-adverbial-preposition');

  /*
   * ברוב המדור האקדמיה מצהירה שאינה פוסקת. עורך שמתקן את הצורות האלה
   * מתקן דבר שאינו שגוי, ולכן הן נבדקות כאן במפורש.
   */
  for (const ok of [
    'הוא הגיע בתור נציג הארגון.',
    'החל מיום שלישי נפתחה ההרשמה.',
    'הרבה אנשים הגיעו לכנס.',
    'ישנם מחקרים שהוכיחו זאת.',
    'מצד אחד הוא צודק ומצד שני הוא טועה.',
    'קראנו את אותו הספר.',
    'אין אדם כמותך בעולם.',
    'הגעתי הביתה מאוחר.',
    'יש בעיר שני בתי כנסיות.',
    'מדובר על תופעה חדשה.',
    'מכללה לעיצוב ואומנות נפתחה.',
  ]) {
    assert.deepEqual(ruleIds(ok, 'academic'), [], `«${ok}» אינו שגיאה לפי האקדמיה`);
  }
});

test('פיסוק', () => {
  assertCatches('קניתי תפוחים, אגסים, וענבים.', 'punct/comma-before-vav-list');
  /*
   * תמורה: כלל 5 בכללי הפיסוק. החריג ״שם תפקיד ואחריו שם עצם פרטי״
   * ו״תמורה קצרה״ נבדקים לצידו.
   */
  assertFixes(
    'ד"ר אמיר מרצה בפקולטה לתקשורת חזותית בשנקר פרסם דוח.',
    'אמיר, מרצה בפקולטה לתקשורת חזותית בשנקר, פרסם',
  );
  assertClean('ד"ר חיים וייצמן היה מדען חשוב.', 'punct/apposition-commas');
  assertClean("פרופ' כהן מנהל את המחלקה בבית החולים.", 'punct/apposition-commas');
  assertClean('ד"ר לוי מרצה בכיר פרסם מאמר.', 'punct/apposition-commas');
  assertClean('מר כהן, מנהל אגף החינוך בעירייה, הודיע על סגירה.', 'punct/apposition-commas');
  // אות סופית אינה נדרשת לפני גרש: «פרופ׳» הוא קיצור של «פרופסור»
  assertClean("פרופ' כהן הגיע.", 'typo/final-letters');
  // ו״ו שמחברת פסוקיות אינה ו״ו של סוף רשימה, והפסיק לפניה תקין
  assertClean('ביום הוא ליטש עדשות, ובלילה כתב את הרעיונות.', 'punct/comma-before-vav-list');
  assertClean('המודל מבין תהליך שלם, ולא רק מקבל פרומפט בודד.', 'punct/comma-before-vav-list');
  assertCatches('הוא אמר כי, הדבר נכון.', 'punct/comma-after-subordinator');
  assertCatches('הבעיה הזאת - כך התרשמתי - נמשכת.', 'punct/hyphen-as-dash');
  assertCatches('הוא פתח (סוגריים ולא סגר.', 'punct/unbalanced-delimiters');
  assertCatches('מדוע אנשים רבים נוטים לחשוב כך.', 'punct/question-mark');
  assertCatches('שמונים אחוז מהאנשים טיפשים כלומר, רק עשרים חכמים.', 'course/comma-before-explainer');
});

// ── כתיב מלא ────────────────────────────────────────────────────────────────

test('כתיב חסר מזוהה ומתוקן', () => {
  assertCatches('הגשתי את התכנית אתמול.', 'ktiv/deficient-spelling');
  assertCatches('אין לי נסיון בתחום.', 'ktiv/deficient-spelling');
  assertFixes('העובד קרא בספריה הגדולה.', 'בספרייה');
  assertFixes('תעברו על התקיה שיצרתם.', 'התיקייה');
  assertFixes('יש שתיה חמה וחניה חופשית.', 'שתייה חמה וחנייה');
  // ו״ו עיצורית נכפלת רק אחרי אות שימוש, ולא בראש מילה
  assertFixes('הועדה התכנסה בועדה.', 'הוועדה התכנסה בוועדה');
  assertFixes('העובד הותיק הגיע.', 'הוותיק');
  assertClean('ותיק וועדה נכתבים כך.', 'ktiv/vav-not-doubled-after-prefix');
  assertClean('המועד האחרון להגשה.', 'ktiv/vav-not-doubled-after-prefix');
  assertClean('איזה מותק של ילד.', 'ktiv/vav-not-doubled-after-prefix');
  /*
   * צורה עברית רגילה אינה כתיב חסר, גם כשהמאגר גוזר ממנה זוג לכאורה:
   * ״כתוב ← כיתוב״, ״ממנה ← ממונה״, ״זקוק ← זיקוק״, ״חשוב ← חישוב״.
   */
  assertClean('מה כתוב כאן על הלוח.', 'ktiv/deficient-spelling');
  assertClean('קראתי חלק ממנה בלבד.', 'ktiv/deficient-spelling');
  assertClean('הוא זקוק לעזרה מיידית.', 'ktiv/deficient-spelling');
  assertClean('זה נושא חשוב מאוד.', 'ktiv/deficient-spelling');
  assertClean('הוא הגיע בתור נציג הארגון.', 'ktiv/deficient-spelling');
  assertCatches('הבטחון הלאומי חשוב.', 'ktiv/deficient-spelling');
  assertCatches('התקוה שלנו גדולה.', 'ktiv/deficient-spelling');
  assertCatches('הוא עסק ביצוא סחורות.', 'ktiv/deficient-spelling');
});

test('מילים תקינות אינן מסומנות ככתיב חסר', () => {
  // כל אלה מילים תקינות שהכתיב ״החסר״ שלהן הוא מילה אחרת
  for (const word of ['עשר', 'ארך', 'רחב', 'עמק', 'יסוד', 'יבוא', 'חרף', 'עצמה']) {
    assertClean(`המשפט מכיל ${word} כאן.`, 'ktiv/deficient-spelling');
  }
});

test('שיבוש ניב מזוהה לפי מרחק עריכה', () => {
  // הכלל פעיל רק כשמאגר הניבים נקצר; בלעדיו אין מה לבדוק
  const available = check('הרעיון רקם עור וגידים.').findings.some(
    (f) => f.ruleId === 'idiom/misquote' || f.ruleId === 'course/idioms',
  );
  if (!available) return;

  for (const wrong of [
    'הוא זרע מלח על פצעיו.',
    'הכול עומד על קרעי תרנגולת.',
    'ניסינו ליישב את ההדורים.',
  ]) {
    const ids = ruleIds(wrong);
    assert.ok(
      ids.includes('idiom/misquote') || ids.includes('course/idioms'),
      `«${wrong}» היה אמור להיתפס כשיבוש ניב`,
    );
  }
});

test('נטיית ניב תקינה אינה נתפסת כשיבוש', () => {
  /*
   * הניבים נשמרים בצורת הנסתר. הופעתם בגוף או במין אחר היא נטייה
   * תקינה, ולא שיבוש — ובלי ההבחנה הזאת כל שימוש בניב היה מסומן.
   */
  for (const fine of [
    'הם עשו לילות כימים.',
    'היא קרמה עור וגידים.',
    'הם קרמו עור וגידים.',
  ]) {
    assertClean(fine, 'idiom/misquote');
  }
});

test('ההפניה מצביעה על החלטה או על נושא כשהמאגרים טעונים', () => {
  const findings = check('הגשתי את התכנית אתמול.').findings;
  const ktiv = findings.find((f) => f.ruleId === 'ktiv/deficient-spelling');
  assert.ok(ktiv, 'לא נמצא ממצא כתיב');
  assert.match(ktiv!.authority.url ?? '', /^https:\/\/hebrew-academy\.org\.il\//);

  // בלי המאגרים ההפניה נשארת לשורש האתר, וזה תקין; איתם היא עמוקה יותר
  const deep = ktiv!.authority.url !== 'https://hebrew-academy.org.il/';
  if (deep) assert.match(ktiv!.authority.clause ?? '', /(החלטה|נושא): /);
});

test('הפניות הפיסוק מצביעות על ההחלטה הנכונה', () => {
  const cases: Array<[string, string, RegExp]> = [
    ['הסכם בין-לאומי נחתם.', 'typo/maqaf-compound', /מקף/],
    ['מדוע זה קרה.', 'punct/question-mark', /סימן שאלה/],
    ['קניתי תפוחים, אגסים, וענבים.', 'punct/comma-before-vav-list', /פסיק/],
    ['הוא אמר צה"ל.', 'typo/gershayim-acronym', /ראשי תיבות/],
  ];
  for (const [text, ruleId, expected] of cases) {
    const finding = check(text).findings.find((f) => f.ruleId === ruleId);
    assert.ok(finding, `«${text}» לא הפעיל את ${ruleId}`);
    // בלי מאגר ההחלטות אין מה לבדוק
    if (!finding!.authority.clause?.includes('החלטה: ')) continue;
    assert.match(finding!.authority.clause, expected, ruleId);
  }
});

test('ניב של האקדמיה מזוהה ומצוטט', () => {
  const findings = check('הדבר אומר דורשני.').findings;
  const idiom = findings.find((f) => f.ruleId === 'idiom/misquote');
  if (!idiom) return; // המאגר לא נקצר
  assert.equal(idiom.suggestion, 'אומר דרשני');
  assert.equal(idiom.authority.source, 'האקדמיה ללשון העברית');
  assert.match(idiom.authority.url ?? '', /^https:\/\/hebrew-academy\.org\.il\//);
});

test('שלילה ב״אין״ מבחינה בין פועל לשם תואר', () => {
  /*
   * ״אינו נכון״ ו״אינו יציב״ הם עברית תקינה, אף ש״נכון״ ו״יציב״ הן
   * צורות פועל תקפות. ההבחנה נעשית לפי סיומת הגוף, שאינה מופיעה
   * בשם תואר — ולא לפי ניתוח מורפולוגי, שאינו יכול להכריע כאן.
   */
  for (const fine of [
    'הנחש אינו אובייקט פולחני.',
    'הדבר אינו נכון.',
    'הוא אינו יציב.',
    'זה אינו ברור.',
    'הטענה אינה מבוססת.',
  ]) {
    assertClean(fine, 'course/negation-past-future');
  }
  for (const wrong of ['אינם הביאו ראיות.', 'איננו ידענו על כך.', 'אינם רצו להשתתף.']) {
    assertCatches(wrong, 'course/negation-past-future');
  }
});

test('התאם בין כינוי הגוף לפועל', () => {
  for (const wrong of ['היא כתבו מכתב.', 'הוא כתבה מכתב.', 'אנחנו כתבתי הביתה.']) {
    assertCatches(wrong, 'syntax/subject-verb-agreement');
  }
  /*
   * פועל בן שלוש אותיות בלי תוספת נטייה אינו נבדק, משום שמילה כזאת
   * היא לרוב שם עצם: ״הם אמת מוחלטת״ הוא משפט שמני תקין. המחיר הוא
   * ויתור על ״הם הלך״, והוא שווה את מניעת ההתרעה על משפט שמני.
   */
  assertClean('הם אמת מוחלטת.', 'syntax/subject-verb-agreement');
  for (const fine of [
    'הם הלכו לבית.', 'היא כתבה מכתב.', 'אני כותב מכתב.',
    'היא מורה בבית הספר.', 'הוא יכתוב מחר.', 'את כותבת יפה.', 'אני אלך מחר.',
  ]) {
    assertClean(fine, 'syntax/subject-verb-agreement');
  }
});

test('צורות פועל שכיחות אינן נתפסות ככתיב חסר', () => {
  /*
   * לקסיקון שנקצר אוטומטית עלול לכלול צורה נטויה של שם — ״רְאִיָּתִי״ —
   * שהכתיב החסר שלה מתנגש בצורת פועל. אלה הצורות שנפגעו בפועל.
   */
  const verbForms = [
    'ראיתי', 'הייתי', 'עשיתי', 'קניתי', 'בניתי', 'עניתי', 'פניתי',
    'ראינו', 'עשינו', 'הבנתי', 'ידעתי', 'רציתי', 'שאלתי', 'כתבתי',
  ];
  for (const form of verbForms) {
    assertClean(`אתמול ${form} את הדבר.`, 'ktiv/deficient-spelling');
  }
});

test('החלה יתרה של כללי הכתיב', () => {
  assertCatches('הצבע וורוד מאוד.', 'ktiv/vav-doubled-at-start');
});

// ── שגיאות נפוצות ───────────────────────────────────────────────────────────

test('מיליות שעבוד', () => {
  assertCatches('היות ואין ברירה, נמשיך.', 'common/conjunctions');
  assertCatches('מאחר ולא הגיע, ביטלנו.', 'common/conjunctions');
  assertCatches('באם ירד גשם, לא נצא.', 'common/conjunctions');
  assertCatches('במידה ותלמדו, תצליחו.', 'common/conjunctions');
  assertCatches('במקרה ותהיה אזעקה, נתפנה.', 'course/forms');
});

test('״הואיל ו״ ו״אי לכך״ תקינים ואינם מסומנים', () => {
  // שתי הצורות מופיעות בחומרי ההוראה כמילות קישור תקינות
  assertClean('הואיל ולא הגיע, ביטלנו את המפגש.', 'common/conjunctions');
  assertClean('אי לכך החלטנו לשנות את המדיניות.', 'common/connectives');
});

test('שימושי לשון', () => {
  assertCatches('בכדי להצליח יש להתאמץ.', 'common/connectives');
  assertCatches('הפתרון הינו פשוט מאוד.', 'common/copula');
  assertCatches('היא אינה מציגה את האמת אלה את הדעות.', 'common/ela-ele');
  assertFixes('היא אינה מציגה את האמת אלה את הדעות.', 'אלא את הדעות');
  // כינוי רמז אחרי מילת שאלה תקין גם כשקדמה לו שלילה
  assertClean('לא הבנתי מה אלה הדברים שקרו.', 'common/ela-ele');
  assertCatches('היו שם אחד עשרה אנשים.', 'common/teen-gender-mix');
  assertCatches('הוא אחראי על הפרויקט.', 'common/government');
  assertCatches('בסך הכל זה הצליח.', 'common/forms');
  assertCatches('יש לי את הספר הזה.', 'common/yesh-et');
  assertCatches('אני יבדוק את זה מחר.', 'common/first-person-future');
  assertClean('אני יודע את התשובה.', 'common/first-person-future');
});

test('ניבים משובשים', () => {
  assertCatches('הרעיון רקם עור וגידים.', 'course/idioms');
  assertCatches('הוא שוקד על שמריו.', 'course/idioms');
  assertCatches('עשה ימים כלילות בעבודה.', 'course/idioms');
});

// ── תחביר ───────────────────────────────────────────────────────────────────

test('תחביר והתאם', () => {
  assertCatches('ראיתי שלוש ילדים בגן.', 'num/gender-agreement');
  assertCatches('קראתי שלושה ספריות.', 'num/gender-agreement');
  // לפני שם מיודע התיקון חייב להיות בנסמך: לא ״חמישה העיתונים״ אלא ״חמשת״
  assertFixes('קראתי בחמש העיתונים המובילים.', 'בחמשת העיתונים');
  // שם המספר מ־2 עד 10 גורר שם נמנה ברבים; מאחד עשר ומעלה היחיד תקין
  assertFixes('שמונה אחוז מהממצאים הם פייק ניוז.', 'שמונה אחוזים');
  assertClean('אחד עשר אחוז מהתלמידים הצליחו.', 'num/counted-noun-plural');
  assertClean('עשרים ושלושה אחוז מהציבור תמכו.', 'num/counted-noun-plural');
  assertClean('מאה אחוז מהתלמידים הגיעו.', 'num/counted-noun-plural');
  assertCatches('הלכתי אל הבית ספר.', 'syntax/construct-definiteness');
  assertCatches('ביקרתי אצל הבתי כנסת.', 'course/definite-construct-plural');
  assertCatches('אינם רצו להשתתף.', 'course/negation-past-future');
  assertCatches('זה של של הילד.', 'syntax/duplicate-preposition');
});

test('התאם המין מתוקן אוטומטית', () => {
  const cases: Array<[string, string]> = [
    ['ראיתי שלוש מסמכים.', 'ראיתי שלושה מסמכים.'],
    ['ראיתי שלושה בנות.', 'ראיתי שלוש בנות.'],
    ['הגישו ארבע דוחות.', 'הגישו ארבעה דוחות.'],
    ['קראתי חמישה שאלות.', 'קראתי חמש שאלות.'],
    // אות שימוש נצמדת לשם המספר ונשמרת בתיקון
    ['ראיתי שתי שולחנות ושלוש מסמכים.', 'ראיתי שני שולחנות ושלושה מסמכים.'],
    ['בשלוש מסמכים נמצאה טעות.', 'בשלושה מסמכים נמצאה טעות.'],
  ];
  for (const [before, after] of cases) {
    const fixed = applyFixes(before, analyze(before, { config }).findings, { onlySafe: true });
    assert.equal(fixed.text, after, before);
  }
});

test('התאם המין מכיר חריגים ואינו מתקן אותם לרעה', () => {
  // צורות רבים שהסיומת שלהן מטעה — כאן דווקא אין שגיאה
  for (const ok of ['שלושה שולחנות', 'שלוש נשים', 'שלושה רעיונות', 'שתי עיניים', 'שלוש שנים']) {
    assertClean(`ראיתי ${ok} כאן.`, 'num/gender-agreement');
  }
  // וכאן יש שגיאה, בכיוון ההפוך למה שהסיומת מרמזת
  assertCatches('ראיתי שלוש שולחנות כאן.', 'num/gender-agreement');
  assertCatches('ראיתי שלושה נשים כאן.', 'num/gender-agreement');
});

test('התאם המין אינו מדווח כשמין השם אינו ידוע', () => {
  // צורת זוגי שאינה ברשימות — אין די מידע, ולכן אין ממצא
  assertClean('קניתי שני מלקחיים חדשים.', 'num/gender-agreement');
});

// ── מרשם ────────────────────────────────────────────────────────────────────

test('כללי מרשם פעילים רק במרשם שלהם', () => {
  assertClean('זה בעצם פשוט נהדר.', 'academic/colloquial', 'neutral');
  assertCatches('זה בעצם פשוט נהדר.', 'academic/colloquial', 'academic');
});

test('משפט ארוך מדי מזוהה', () => {
  const long = 'מילה '.repeat(45) + 'סוף.';
  assertCatches(long, 'academic/long-sentence', 'academic');
});

// ── תיקון אוטומטי ───────────────────────────────────────────────────────────

test('התיקון הבטוח משנה רק מה שצריך', () => {
  const text = 'בכדי לבדוק את התכנית , כתבתי.';
  const result = analyze(text, { config });
  const fixed = applyFixes(text, result.findings, { onlySafe: true });
  assert.ok(fixed.text.includes('כדי'), 'הצירוף ״בכדי״ לא תוקן');
  assert.ok(fixed.text.includes('תוכנית'), 'הכתיב החסר לא תוקן');
  assert.ok(!fixed.text.includes(' ,'), 'הרווח לפני הפסיק לא הוסר');
});

test('החלת התיקונים אידמפוטנטית', () => {
  const text = 'בכדי לבדוק את התכנית , כתבתי שלוש מסמכים.';
  const once = applyFixes(text, analyze(text, { config }).findings, { onlySafe: true }).text;
  const twice = applyFixes(once, analyze(once, { config }).findings, { onlySafe: true }).text;
  assert.equal(twice, once, 'הרצה שנייה של התיקונים שינתה את התוצאה');
});

test('תיקונים חופפים אינם מוחלים יחד', () => {
  const text = 'התכנית , בכדי.';
  const fixed = applyFixes(text, analyze(text, { config }).findings, { onlySafe: true });
  const ranges = fixed.applied.map((a) => [a.start, a.end] as const);
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const [aStart, aEnd] = ranges[i];
      const [bStart, bEnd] = ranges[j];
      assert.ok(aEnd <= bStart || bEnd <= aStart, 'הוחלו תיקונים חופפים');
    }
  }
});

test('טקסט תקין אינו מייצר שגיאות', () => {
  const clean = 'הוועדה אישרה את התוכנית החדשה, ובעקבות זאת החל היישום.';
  const errors = check(clean).findings.filter((f) => f.severity === 'error');
  assert.deepEqual(errors.map((f) => f.ruleId), [], 'נמצאו שגיאות בטקסט תקין');
});

// ── תחיליות, הקשר ואות שימוש דבוקה ──────────────────────────────────────────

test('צורה עם תחילית ו׳ או ש׳ נתפסת כמו הצורה הבסיסית', () => {
  assertCatches('ובכדי לבדוק את זה', 'common/connectives');
  assertCatches('שבכדי לבדוק את זה', 'common/connectives');
  assertCatches('ולמרות שאין זמן', 'common/connectives');
  assertCatches('ומאחר ואין זמן', 'common/conjunctions');
  assertCatches('והכל היה מוכן', 'common/forms');
});

test('צורה תקנית שנראית כשיבוש עם תחילית אינה מסומנת', () => {
  assertClean('התביעה שכנגד נדחתה.', 'common/connectives');
  assertClean('ידו על שדיי התמר.', 'common/forms');
  assertClean('האירוע שהיה ונשכח חזר לכותרות.', 'common/conjunctions');
});

test('«אודות» מסומן לבדו ולא אחרי «על»', () => {
  assertCatches('אודות הספר נכתב רבות.', 'common/connectives');
  assertClean('על אודות הספר נכתב רבות.', 'common/connectives');
});

test('תיקון שמוחק אות שימוש דבוקה אינו מדביק את המילה הבאה', () => {
  assertFixes('בטרם ושבה הרוח, הכול נרגע.', 'בטרם שבה');
  assertFixes('במידה ואין זמן, נדחה את הדיון.', 'אם אין זמן');
  assertFixes('היות ואין לי זמן, נדחה.', 'היות שאין');
});

test('צירוף דו־משמעי מדווח ואינו מתקן אוטומטית', () => {
  const text = 'האירוע היה ולא נרשם.';
  const fixed = applyFixes(text, check(text).findings, { onlySafe: true }).text;
  assert.equal(fixed, text, '«היה ו» תוקן אוטומטית אף שהוא דו־משמעי');
});

test('שנה עברית מזוהה רק בהקשר של שנה', () => {
  assertCatches('בשנת תשפה פורסם המאמר.', 'num/hebrew-year-gershayim');
  for (const ok of ['הטקסט תקין.', 'הגיעו תשעה אנשים.', 'אם תקבל, תשלח לי.', 'תקרה גבוהה.']) {
    assertClean(ok, 'num/hebrew-year-gershayim');
  }
});

test('פסוקית זמן מזוהה רק בשי״ן ואחריה פועל מוטה', () => {
  assertCatches('שנגיע לגשר - נעבור אותו.', 'syntax/time-clause-kshe');
  for (const ok of [
    'שירותי לשון חינמיים — תיעוד',
    'שימוש עיקרי: לוודא, ולראות',
    'שלושה רישומים לגיטימיים, ואין לערבב',
    'שיטת המחקר, כפי שתוארה',
    'שנה טובה, ומבורכת',
  ]) {
    assertClean(ok, 'syntax/time-clause-kshe');
  }
});

// ── התרעות שקר שנמדדו מול אוצר המילים של האקדמיה ────────────────────────────

test('מילה תקנית שנראית כמו כתיב חסר עם אות שימוש אינה מסומנת', () => {
  for (const ok of ['מספור', 'מיפוי', 'כיבוש', 'ביקור', 'שיבוש', 'ויתור',
                    'מאזניים', 'משווק', 'מיקור', 'מתווך', 'דבורים', 'שותק']) {
    assertClean(ok + ' בטקסט.', 'ktiv/deficient-spelling');
    assertClean(ok + ' בטקסט.', 'ktiv/vav-not-doubled-after-prefix');
  }
});

test('כתיב חסר אמיתי ממשיך להיות מתוקן, גם עם אות שימוש', () => {
  assertFixes('בתכנית החדשה', 'בתוכנית');
  assertFixes('התכנית אושרה', 'התוכנית');
  assertFixes('בטחון המדינה', 'ביטחון');
  assertFixes('אין לי נסיון', 'ניסיון');
  assertFixes('חסרון גדול', 'חיסרון');
});

test('הקו המפריד: רווחים בין מילים, בלי רווחים בטווח מספרים', () => {
  assertFixes('הטיעון—וזה העיקר—מתקיים.', 'הטיעון — וזה העיקר');
  assertClean('ראו עמ׳ 20–15 בספר.', 'punct/dash-spacing');
  assertClean('פסקה של 8–15 שורות.', 'punct/dash-spacing');
});

test('שם מספר מורכב ושם מספר מיודע אינם מתוקנים לפי הכלל הפשוט', () => {
  assertClean('פרק באורך שנים עשר עמודים.', 'num/gender-agreement');
  assertClean('שש עשרה חתולות ישנו.', 'num/gender-agreement');
  assertClean('השניים הראשונים נבדקו.', 'num/construct-before-definite');
  assertFixes('חמש העיתונים נבדקו.', 'חמשת העיתונים');
  assertFixes('חמש עיתונים נבדקו.', 'חמישה עיתונים');
});

test('שם מספר מורכב מזוהה גם כשמקף מפריד', () => {
  assertClean('פרק באורך שנים-עשר עמודים.', 'num/gender-agreement');
  assertClean('פרק באורך שנים־עשר עמודים.', 'num/gender-agreement');
});

test('הקו המפריד אינו מרווח בסוגריים ובטווחים', () => {
  assertClean('קו מפריד (–) בין חלקי משפט.', 'punct/dash-spacing');
  assertClean('ראו עמ׳ 20–15.', 'punct/dash-spacing');
  assertCatches('הטיעון—וזה העיקר—מתקיים.', 'punct/dash-spacing');
});

test('יידוע בסמיכות מדווח ואינו מתקן אוטומטית', () => {
  const text = 'הכלי מסווג כל ממצא.';
  assertCatches(text, 'course/definite-construct-plural');
  const fixed = applyFixes(text, check(text).findings, { onlySafe: true }).text;
  assert.equal(fixed, text, 'צירוף דו־משמעי תוקן אוטומטית');
});

test('מונחים לשוניים אינם מסומנים כלשון דיבור או כראשי תיבות לפרישה', () => {
  assertClean('הכתיב המלא של המילה.', 'academic/colloquial', 'academic');
  assertCatches('יש מלא אנשים בכיתה.', 'academic/colloquial', 'academic');
  for (const ok of ['ו״ו החיבור באה כאן.', 'אותיות מש״ה וכל״ב.', 'ראו שמ״א ג, 4.']) {
    assertClean(ok, 'academic/undefined-acronym', 'academic');
  }
  assertCatches('הוגש דוח ממ״ד לוועדה.', 'academic/undefined-acronym', 'academic');
});

test('יו״ד לפני אל״ף במילה לועזית — כלל הכתיב המלא בתנועת e', () => {
  assertFixes('המסגרת התאורטית', 'התיאורטית');
  assertFixes('תאוריה חדשה', 'תיאוריה');
  assertFixes('הצגה בתאטרון', 'בתיאטרון');
  assertFixes('הסיבות האידאולוגיות', 'האידיאולוגיות');
  assertFixes('אידאל היופי', 'אידיאל');
});

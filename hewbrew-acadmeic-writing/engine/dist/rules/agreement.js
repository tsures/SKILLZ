/**
 * התאם בין הנושא לנשוא.
 *
 * הכלל נשען על המנתח המורפולוגי: הפועל מנותח לגוף, לזמן, למין ולמספר,
 * ואלה מושווים לכינוי הגוף שלפניו. עד שהיה מנתח לא היה אפשר לבדוק זאת
 * בכלל, שהרי ״הלך״ ו״הלכו״ נבדלות רק בצורת הפועל.
 *
 * הבדיקה מוגבלת לכינויי גוף מפורשים, שהם חד־משמעיים. שם עצם כנושא
 * מחייב הכרעה מה בדיוק הנושא במשפט, וזו הכרעה תחבירית שאין למנוע
 * הזה דרך לעשות בביטחון.
 */
import { makeFinding } from '../text/diagnostics.js';
import { academy } from './helpers.js';
import { analyzeVerb } from '../morph/analyze.js';
import { nextWord } from '../text/tokenize.js';
const PRONOUNS = {
    אני: { person: 'p1s', plural: false, label: 'מדבר' },
    אתה: { person: 'p2ms', plural: false, label: 'נוכח' },
    את: { person: 'p2fs', plural: false, label: 'נוכחת' },
    הוא: { person: 'p3ms', plural: false, label: 'נסתר' },
    היא: { person: 'p3fs', plural: false, label: 'נסתרת' },
    אנחנו: { person: 'p1p', plural: true, label: 'מדברים' },
    אנו: { person: 'p1p', plural: true, label: 'מדברים' },
    אתם: { person: 'p2mp', plural: true, label: 'נוכחים' },
    אתן: { person: 'p2fp', plural: true, label: 'נוכחות' },
    הם: { person: 'p3mp', plural: true, label: 'נסתרים' },
    הן: { person: 'p3fp', plural: true, label: 'נסתרות' },
};
/** צורות הבינוני שהן ברבים */
const PLURAL_PRESENT = new Set(['mp', 'fp']);
/**
 * ״את״ היא גם כינוי גוף וגם מילית מושא, ולכן היא נבדקת רק כשהפועל
 * שאחריה הוא ממש פועל בגוף שני נקבה.
 */
const AMBIGUOUS_PRONOUNS = new Set(['את']);
function describePerson(analysis) {
    const parts = [analysis.binyan];
    if (analysis.personLabel)
        parts.push(analysis.personLabel);
    return parts.join(', ');
}
export const agreementRules = [
    {
        id: 'syntax/subject-verb-agreement',
        category: 'syntax',
        severity: 'error',
        title: 'התאם בין כינוי הגוף לפועל',
        run(ctx) {
            const findings = [];
            for (const tok of ctx.doc.tokens) {
                if (tok.kind !== 'hebrew')
                    continue;
                const pronoun = PRONOUNS[tok.text];
                if (!pronoun)
                    continue;
                const verbToken = nextWord(ctx.doc, tok);
                if (!verbToken || verbToken.kind !== 'hebrew')
                    continue;
                /*
                 * ״אני יבדוק״ מדווח כבר בכלל common/first-person-future, עם
                 * הצעת תיקון מפורשת. דיווח כפול על אותו קטע רק מרעיש.
                 */
                if (tok.text === 'אני' && verbToken.text.startsWith('י'))
                    continue;
                /*
                 * מילה בת שלוש אותיות בלי תוספת נטייה היא לרוב שם עצם ולא פועל:
                 * ״הם אמת מוחלטת״ הוא משפט שמני תקין, אף ש״אמת״ היא גם צורת פועל
                 * אפשרית. הוויתור על ״הם הלך״ שווה את מניעת ההתרעה על ״הם אמת״.
                 */
                if (verbToken.text.length < 4)
                    continue;
                const analyses = analyzeVerb(verbToken.text);
                if (analyses.length === 0)
                    continue;
                /*
                 * גזרה שסומנה approx נגזרה מתבנית שאינה שלה, ואין להסתמך עליה.
                 * partial לעומת זאת מספיק כאן: אי־הוודאות שם היא בתנועות,
                 * ואילו הגוף והמספר נקבעים מן הסופית ומן התחילית.
                 */
                const reliable = analyses.filter((a) => a.accuracy !== 'approx');
                if (reliable.length === 0)
                    continue;
                const finite = reliable.filter((a) => a.tense === 'past' || a.tense === 'future');
                const present = reliable.filter((a) => a.tense === 'present');
                /*
                 * די בניתוח מתאים אחד כדי שהצירוף יהיה תקין. צורה עברית חסרת
                 * ניקוד היא לרוב דו־משמעית, ואין לקבוע שגיאה על סמך קריאה אחת.
                 */
                if (finite.length > 0) {
                    if (finite.some((a) => a.person === pronoun.person))
                        continue;
                    // אם יש גם קריאה בהווה שמתאימה במספר, הצירוף תקין
                    if (present.some((a) => PLURAL_PRESENT.has(a.person ?? '') === pronoun.plural))
                        continue;
                    if (AMBIGUOUS_PRONOUNS.has(tok.text))
                        continue;
                    const example = finite[0];
                    findings.push(makeFinding(ctx, spec, {
                        start: tok.start,
                        end: verbToken.end,
                        message: `«${tok.text}» הוא גוף ${pronoun.label}, ואילו «${verbToken.text}» הוא ` +
                            `${describePerson(example)}. הנושא והנשוא חייבים להתאים בגוף, במין ובמספר.`,
                        suggestion: `להתאים את הפועל לגוף ${pronoun.label}`,
                        autoFixSafe: false,
                        authority: academy('התחביר — התאם בין הנושא לנשוא'),
                    }));
                    continue;
                }
                /*
                 * בבינוני אין ציון גוף, ולכן נבדק המספר בלבד. המין אינו נבדק
                 * משום שצורת הבינוני משמשת גם שם עצם — ״היא מורה״ תקין.
                 */
                if (present.length > 0) {
                    if (present.some((a) => PLURAL_PRESENT.has(a.person ?? '') === pronoun.plural))
                        continue;
                    if (AMBIGUOUS_PRONOUNS.has(tok.text))
                        continue;
                    findings.push(makeFinding(ctx, spec, {
                        start: tok.start,
                        end: verbToken.end,
                        message: `«${tok.text}» ב${pronoun.plural ? 'רבים' : 'יחיד'}, ואילו «${verbToken.text}» ` +
                            `ב${pronoun.plural ? 'יחיד' : 'רבים'}. הנושא והנשוא חייבים להתאים במספר.`,
                        suggestion: `להתאים את הפועל ל${pronoun.plural ? 'רבים' : 'יחיד'}`,
                        autoFixSafe: false,
                        authority: academy('התחביר — התאם בין הנושא לנשוא'),
                    }));
                }
            }
            return findings;
        },
    },
];
const spec = {
    id: 'syntax/subject-verb-agreement',
    category: 'syntax',
    severity: 'error',
};
//# sourceMappingURL=agreement.js.map
/**
 * מרשם הכתיבה האקדמית: מה שמתאים לשיחה אינו מתאים לעבודה עיונית.
 * רוב הכללים כאן פעילים רק כשה־register הוא academic.
 */
import { makeFinding } from '../text/diagnostics.js';
import { convention, regexRule, termRule } from './helpers.js';
import { GERSHAYIM } from '../text/chars.js';
import { sentenceWords } from '../text/tokenize.js';
const HEB = '\\u05D0-\\u05EA';
const HEB_ANY = '\\u05D0-\\u05EA\\u0591-\\u05C7';
const COLLOQUIAL = [
    { avoid: 'בעצם', prefer: 'למעשה', manual: true },
    { avoid: 'פשוט', prefer: 'להשמיט, או ״באופן פשוט״', manual: true },
    { avoid: 'ממש', prefer: 'להשמיט, או ״ממש כך״ במשמעות מדויקת', manual: true },
    { avoid: 'כאילו', prefer: 'כביכול / כמו', manual: true },
    { avoid: 'לגמרי', prefer: 'לחלוטין', manual: true },
    { avoid: 'בטח', prefer: 'ודאי / מן הסתם', manual: true },
    { avoid: 'סתם', prefer: 'ללא סיבה / שלא לצורך', manual: true },
    { avoid: 'המון', prefer: 'רבים / הרבה', manual: true },
    { avoid: 'מלא', prefer: 'רבים', manual: true, okAfter: 'כתיב' },
    { avoid: 'קצת', prefer: 'במידת מה / מעט', manual: true },
    { avoid: 'סוג של', prefer: 'מעין', manual: true },
    { avoid: 'ברמה של', prefer: 'במידה של / מבחינת', manual: true },
    { avoid: 'בקטע של', prefer: 'בתחום / בעניין', manual: true },
    { avoid: 'משהו כמו', prefer: 'כ־ / בערך', manual: true },
    { avoid: 'בכל מקרה', prefer: 'מכל מקום / בכל אופן', manual: true },
    { avoid: 'דבר כזה', prefer: 'דבר מעין זה', manual: true },
];
const HEDGING = [
    { avoid: 'נדמה לי', prefer: 'נראה כי', manual: true },
    { avoid: 'אני חושב ש', prefer: 'לטענתי / מסקנתי היא ש', manual: true },
    { avoid: 'אני מרגיש ש', prefer: 'מן הממצאים עולה ש', manual: true },
    { avoid: 'לדעתי האישית', prefer: 'לדעתי', manual: true },
    { avoid: 'כמובן ש', prefer: 'ברי ש / אין צורך לומר ש', manual: true },
    { avoid: 'מיותר לציין', prefer: 'להשמיט — אם מיותר, אין לציין', manual: true },
];
/** קיצורים שבכתיבה עיונית נהוג לפרוש במלואם */
const ABBREVIATIONS = [
    { avoid: `ע${GERSHAYIM}י`, prefer: 'על ידי', manual: true },
    { avoid: 'ע"י', prefer: 'על ידי', manual: true },
    { avoid: `ע${GERSHAYIM}פ`, prefer: 'על פי', manual: true },
    { avoid: 'ע"פ', prefer: 'על פי', manual: true },
    { avoid: `בד${GERSHAYIM}כ`, prefer: 'בדרך כלל', manual: true },
    { avoid: 'בד"כ', prefer: 'בדרך כלל', manual: true },
    { avoid: `אח${GERSHAYIM}כ`, prefer: 'אחר כך', manual: true },
    { avoid: 'אח"כ', prefer: 'אחר כך', manual: true },
    { avoid: `כנ${GERSHAYIM}ל`, prefer: 'כנזכר לעיל', manual: true },
    { avoid: `וכו׳`, prefer: 'וכולי, או לסיים את הרשימה במפורש', manual: true },
    { avoid: `וכד׳`, prefer: 'וכדומה', manual: true },
];
export const academicRules = [
    termRule({
        id: 'academic/colloquial',
        category: 'academic',
        severity: 'suggestion',
        title: 'לשון דיבור בכתיבה עיונית',
        authority: convention('מרשם הכתיבה העיונית'),
        registers: ['academic'],
        entries: COLLOQUIAL,
        message: (entry, matched) => `«${matched}» שייכת ללשון הדיבור. בכתיבה עיונית: ${entry.prefer}.`,
    }),
    termRule({
        id: 'academic/hedging',
        category: 'academic',
        severity: 'suggestion',
        title: 'ניסוח מסויג או אישי מדי',
        authority: convention('מרשם הכתיבה העיונית'),
        registers: ['academic'],
        entries: HEDGING,
        message: (entry, matched) => `«${matched}» מנסח עמדה אישית. בכתיבה עיונית עדיף: ${entry.prefer}.`,
    }),
    termRule({
        id: 'academic/abbreviations',
        category: 'academic',
        severity: 'suggestion',
        title: 'קיצורים בכתיבה עיונית',
        authority: convention('מוסכמות כתיבה אקדמית'),
        registers: ['academic'],
        entries: ABBREVIATIONS,
        message: (entry, matched) => `בכתיבה עיונית נהוג לפרוש את הקיצור «${matched}»: ${entry.prefer}.`,
    }),
    regexRule({
        id: 'academic/exclamation',
        category: 'academic',
        severity: 'warning',
        title: 'סימן קריאה בטקסט עיוני',
        authority: convention('מרשם הכתיבה העיונית'),
        registers: ['academic'],
        pattern: /!/,
        message: 'סימן קריאה נדיר בכתיבה עיונית; הטיעון נושא את עצמו בלי הדגשה רגשית.',
        suggestion: 'נקודה',
        replacement: '.',
        autoFixSafe: false,
    }),
    regexRule({
        id: 'academic/second-person',
        category: 'academic',
        severity: 'suggestion',
        title: 'פנייה ישירה לקורא',
        authority: convention('מרשם הכתיבה העיונית'),
        registers: ['academic'],
        pattern: new RegExp(`(?<![${HEB_ANY}])(אתם רואים|אתה רואה|כפי שאתם|תשימו לב|שימו לב|תחשבו על)(?![${HEB_ANY}])`),
        message: (m) => `«${m[1]}» פונה ישירות לקורא. בכתיבה עיונית מקובל ניסוח בלתי אישי.`,
        suggestion: 'ניסוח בלתי אישי: ״יש לשים לב כי...״',
        autoFixSafe: false,
    }),
    regexRule({
        id: 'academic/intensifier',
        category: 'academic',
        severity: 'style',
        title: 'מילת הגברה',
        authority: convention('כלכליות הלשון'),
        registers: ['academic'],
        pattern: new RegExp(`(?<![${HEB_ANY}])(מאוד|מאד|ביותר|לחלוטין|לגמרי|בהחלט)(?![${HEB_ANY}])`),
        message: (m) => `«${m[1]}» מגבירה בלי להוסיף מידע. אם הטענה נכונה, היא עומדת בלעדיה.`,
        suggestion: 'לשקול השמטה',
        autoFixSafe: false,
        optIn: true,
    }),
    longSentenceRule(),
    undefinedAcronymRule(),
];
/** משפט ארוך מדי — סף ניתן לשינוי בהגדרות הבית */
function longSentenceRule() {
    const spec = {
        id: 'academic/long-sentence',
        category: 'academic',
        severity: 'suggestion',
    };
    return {
        ...spec,
        title: 'משפט ארוך מדי',
        registers: ['academic', 'literary'],
        run(ctx) {
            const limit = ctx.config.maxSentenceWords;
            const findings = [];
            for (const sentence of ctx.doc.sentences) {
                const count = sentenceWords(ctx.doc, sentence).length;
                if (count <= limit)
                    continue;
                findings.push(makeFinding(ctx, spec, {
                    start: sentence.start,
                    end: Math.min(sentence.end, sentence.start + 60),
                    message: `המשפט מונה ${count} מילים (הסף בהגדרות: ${limit}). משפט ארוך כזה קשה למעקב — כדאי לפצל אותו.`,
                    suggestion: 'לפצל לשני משפטים או יותר',
                    authority: convention('בהירות התחביר'),
                }));
            }
            return findings;
        },
    };
}
/**
 * ראשי תיבות שלא נפרשו בהופעה הראשונה.
 * מזהה ראשי תיבות לפי גרשיים, ומחפש סוגריים מסבירים בסביבתם.
 */
function undefinedAcronymRule() {
    const spec = {
        id: 'academic/undefined-acronym',
        category: 'academic',
        severity: 'suggestion',
    };
    /** ראשי תיבות מוכרים דיים שאינם טעונים פרישה */
    const WELL_KNOWN = new Set([
        `צה${GERSHAYIM}ל`, `תנ${GERSHAYIM}ך`, `ארה${GERSHAYIM}ב`, `בע${GERSHAYIM}מ`,
        `ד${GERSHAYIM}ר`, `עו${GERSHAYIM}ד`, `ח${GERSHAYIM}כ`, `ש${GERSHAYIM}ח`,
        `ק${GERSHAYIM}מ`, `ס${GERSHAYIM}מ`, `מ${GERSHAYIM}ר`, `כ${GERSHAYIM}א`,
        `וכו${GERSHAYIM}`, `רו${GERSHAYIM}ח`, `יו${GERSHAYIM}ר`,
    ]);
    /*
     * שמות אותיות (ו״ו, יו״ד), נוטריקונים של קבוצות אותיות (מש״ה, וכל״ב,
     * בג״ד כפ״ת) וקיצורי ספרי מקרא וחז״ל אינם ראשי תיבות שיש לפרוש:
     * בכתיבה לשונית ובמדעי היהדות הם המונח עצמו.
     */
    const withGershayim = (w) => w.slice(0, -1) + GERSHAYIM + w.slice(-1);
    const DOMAIN_TERMS = new Set([
        'וו', 'יוד', 'הא', 'אלף', 'בית', 'גימל', 'דלת', 'זין', 'חית', 'טית',
        'כף', 'למד', 'מם', 'נון', 'סמך', 'עין', 'פא', 'צדי', 'קוף', 'ריש',
        'שין', 'תיו',
        'משה', 'וכלב', 'בגד', 'כפת', 'בומפ', 'אהחע', 'ארע', 'חעה', 'בכפ',
        'גדת', 'הח', 'אב',
        'שמא', 'שמב', 'מלא', 'מלב', 'דהא', 'דהב', 'חזל', 'רשי', 'שות',
    ].map(withGershayim));
    return {
        ...spec,
        title: 'ראשי תיבות שלא נפרשו',
        registers: ['academic'],
        run(ctx) {
            const findings = [];
            const seen = new Set();
            const acronym = new RegExp(`(?<![${HEB_ANY}])([${HEB}]{1,4}${GERSHAYIM}[${HEB}])(?![${HEB_ANY}])`, 'g');
            let m;
            while ((m = acronym.exec(ctx.text)) !== null) {
                const form = m[1];
                if (WELL_KNOWN.has(form) || DOMAIN_TERMS.has(form) || seen.has(form))
                    continue;
                seen.add(form);
                // פרישה מקובלת: סוגריים מיד אחרי ראשי התיבות, או ראשי התיבות בסוגריים אחרי הפרישה
                const after = ctx.text.slice(m.index + form.length, m.index + form.length + 3);
                const before = ctx.text.slice(Math.max(0, m.index - 2), m.index);
                if (/^\s*\(/.test(after) || /\(\s*$/.test(before))
                    continue;
                findings.push(makeFinding(ctx, spec, {
                    start: m.index,
                    end: m.index + form.length,
                    message: `ראשי התיבות «${form}» מופיעים כאן בפעם הראשונה בלי פרישה.`,
                    suggestion: `לפרוש בהופעה הראשונה: ״... (${form})״`,
                    authority: convention('מוסכמות כתיבה אקדמית — פרישת ראשי תיבות'),
                }));
            }
            return findings;
        },
    };
}
//# sourceMappingURL=academic.js.map
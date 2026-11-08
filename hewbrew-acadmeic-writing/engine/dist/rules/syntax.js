/**
 * תחביר: יידוע בסמיכות, התאם בין שם לכינוי רומז, וכפילויות תחביריות.
 *
 * הכללים כאן נזהרים בכוונה. בלי ניתוח תחבירי מלא אפשר לזהות רק
 * צורות שמראש אינן תקינות בשום קריאה, ולא ״ניסוחים חשודים״.
 */
import { makeFinding } from '../text/diagnostics.js';
import { academy, convention, regexRule } from './helpers.js';
import { guessNounGender } from '../knowledge/nounGender.js';
import { nextWord } from '../text/tokenize.js';
const HEB = '\\u05D0-\\u05EA';
const HEB_ANY = '\\u05D0-\\u05EA\\u0591-\\u05C7';
/**
 * צירופי סמיכות נפוצים. ביידוע צירוף סמיכות ה״א הידיעה באה על הסומך
 * (הנסמך השני), ולא על הנסמך: ״בית הספר״ ולא ״הבית ספר״.
 */
const CONSTRUCT_PHRASES = [
    ['בית', 'ספר'], ['בית', 'חולים'], ['בית', 'כנסת'], ['בית', 'קפה'],
    ['בית', 'משפט'], ['בית', 'מלון'], ['בית', 'דין'], ['בית', 'אבות'],
    ['כדור', 'רגל'], ['כדור', 'סל'], ['כדור', 'יד'], ['כדור', 'עף'],
    ['עורך', 'דין'], ['עורך', 'הדין'], ['גן', 'ילדים'], ['גן', 'חיות'],
    ['תחנת', 'רכבת'], ['תחנת', 'משטרה'], ['משרד', 'החינוך'],
    ['סרט', 'קולנוע'], ['חדר', 'מדרגות'], ['מגרש', 'חניה'],
    ['שולחן', 'עבודה'], ['כרטיס', 'ביקור'], ['תעודת', 'זהות'],
    ['מועצת', 'העיר'], ['ראש', 'ממשלה'], ['שר', 'החינוך'],
    ['עיתון', 'ערב'], ['ספר', 'לימוד'], ['תוכנית', 'לימודים'],
];
/** כינויי רמז לפי מין ומספר */
const DEMONSTRATIVES = {
    הזה: { gender: 'm', plural: false, alt: 'הזאת' },
    הזאת: { gender: 'f', plural: false, alt: 'הזה' },
    הזו: { gender: 'f', plural: false, alt: 'הזה' },
    האלה: { gender: 'm', plural: true, alt: 'האלה' },
    האלו: { gender: 'm', plural: true, alt: 'האלו' },
};
export const syntaxRules = [
    constructDefinitenessRule(),
    demonstrativeAgreementRule(),
    /*
     * יידוע כפול נבדק רק על צמדים ידועים של נסמך וסומך.
     * ״ה+X ה+Y״ הוא גם התבנית הרגילה של שם ותוארו — ״התוכנית החדשה״ —
     * ולכן בלי בדיקת הצמד הכלל היה מסמן כל שם מיודע עם תואר.
     */
    doubleDefiniteRule(),
    regexRule({
        id: 'syntax/duplicate-preposition',
        category: 'syntax',
        severity: 'error',
        title: 'מילת יחס כפולה',
        authority: convention('ניקיון תחבירי'),
        pattern: new RegExp(`(?<![${HEB_ANY}])(של|את|על|אל|עם|כי|אם|לא)\\s+\\1(?![${HEB_ANY}])`),
        message: (m) => `המילה «${m[1]}» חוזרת פעמיים ברצף.`,
        suggestion: (m) => m[1],
        replacement: (m) => m[1],
    }),
    regexRule({
        id: 'syntax/et-after-preposition',
        category: 'syntax',
        severity: 'error',
        title: '״את״ אחרי מילת יחס',
        authority: academy('התחביר — ״את״ מציינת מושא ישיר'),
        pattern: new RegExp(`(?<![${HEB_ANY}])(ל|ב|מ|על|אל|עם|בעבור|בשביל)\\s+את(?![${HEB_ANY}])`),
        message: (m) => `אחרי מילת היחס «${m[1]}» אין מקום ל״את״, שכן ״את״ מציינת מושא ישיר.`,
        suggestion: 'להשמיט את ״את״ או את מילת היחס',
        autoFixSafe: false,
    }),
    regexRule({
        id: 'syntax/she-duplication',
        category: 'syntax',
        severity: 'warning',
        title: 'כפל מילית שעבוד',
        authority: convention('ניקיון תחבירי'),
        pattern: new RegExp(`(?<![${HEB_ANY}])(אשר\\s+ש|ש\\s*אשר|כי\\s+ש)(?![${HEB_ANY}])`),
        message: 'שתי מיליות שעבוד סמוכות. די באחת מהן.',
        suggestion: 'להשאיר מילית שעבוד אחת',
        autoFixSafe: true,
    }),
    regexRule({
        id: 'syntax/long-construct-chain',
        category: 'syntax',
        severity: 'suggestion',
        title: 'שרשרת סמיכות ארוכה',
        authority: convention('בהירות התחביר'),
        // ארבע מילים עבריות רצופות שאין ביניהן מילת יחס או ה״א הידיעה
        pattern: new RegExp(`(?<![${HEB_ANY}])([${HEB}]{3,}ת|[${HEB}]{3,}י)\\s+([${HEB}]{3,})\\s+([${HEB}]{3,})\\s+([${HEB}]{3,})(?![${HEB_ANY}])`),
        message: (m) => {
            const words = [m[1], m[2], m[3], m[4]];
            if (words.some((w) => w.startsWith('ה') || w.startsWith('ו') || w === 'של'))
                return null;
            return 'שרשרת סמיכות בת ארבעה איברים קשה לפענוח. אפשר לפרק אותה בעזרת ״של״ או במילת יחס.';
        },
        suggestion: 'לפרק את הסמיכות',
        autoFixSafe: false,
        optIn: true,
    }),
];
/** ״הבית הספר״ ← ״בית הספר״ */
function doubleDefiniteRule() {
    const spec = {
        id: 'syntax/double-definite-construct',
        category: 'syntax',
        severity: 'error',
    };
    const pairs = new Set(CONSTRUCT_PHRASES.map(([head, dependent]) => `${head}|${dependent.replace(/^ה/, '')}`));
    return {
        ...spec,
        title: 'יידוע כפול בצירוף סמיכות',
        run(ctx) {
            const findings = [];
            for (const tok of ctx.doc.tokens) {
                if (tok.kind !== 'hebrew' || !tok.text.startsWith('ה'))
                    continue;
                const head = tok.text.slice(1);
                const next = nextWord(ctx.doc, tok);
                if (!next || next.kind !== 'hebrew' || !next.text.startsWith('ה'))
                    continue;
                const dependent = next.text.slice(1);
                if (!pairs.has(`${head}|${dependent}`))
                    continue;
                findings.push(makeFinding(ctx, spec, {
                    start: tok.start,
                    end: next.end,
                    message: `בצירוף סמיכות ה״א הידיעה באה על הסומך בלבד: «${head} ה${dependent}» ולא «ה${head} ה${dependent}».`,
                    suggestion: `${head} ה${dependent}`,
                    replacement: `${head} ה${dependent}`,
                    authority: academy('התחביר — יידוע צירוף הסמיכות'),
                }));
            }
            return findings;
        },
    };
}
/** ״הבית ספר״ ← ״בית הספר״ */
function constructDefinitenessRule() {
    const spec = {
        id: 'syntax/construct-definiteness',
        category: 'syntax',
        severity: 'error',
    };
    const heads = new Map();
    for (const [head, dependent] of CONSTRUCT_PHRASES) {
        const list = heads.get(head) ?? [];
        list.push(dependent.replace(/^ה/, ''));
        heads.set(head, list);
    }
    return {
        ...spec,
        title: 'יידוע צירוף סמיכות',
        run(ctx) {
            const findings = [];
            for (const tok of ctx.doc.tokens) {
                if (tok.kind !== 'hebrew' || !tok.text.startsWith('ה'))
                    continue;
                const head = tok.text.slice(1);
                const dependents = heads.get(head);
                if (!dependents)
                    continue;
                const next = nextWord(ctx.doc, tok);
                if (!next || next.kind !== 'hebrew')
                    continue;
                // אם הסומך כבר מיודע, זהו יידוע כפול — כלל אחר מטפל בו
                if (next.text.startsWith('ה'))
                    continue;
                if (!dependents.includes(next.text))
                    continue;
                findings.push(makeFinding(ctx, spec, {
                    start: tok.start,
                    end: next.end,
                    message: `בצירוף סמיכות ה״א הידיעה באה על הסומך: «${head} ה${next.text}» ולא «${tok.text} ${next.text}».`,
                    suggestion: `${head} ה${next.text}`,
                    replacement: `${head} ה${next.text}`,
                    authority: academy('התחביר — יידוע צירוף הסמיכות'),
                }));
            }
            return findings;
        },
    };
}
/** ״הספר הזאת״ ← ״הספר הזה״ */
function demonstrativeAgreementRule() {
    const spec = {
        id: 'syntax/demonstrative-agreement',
        category: 'syntax',
        severity: 'error',
    };
    return {
        ...spec,
        title: 'התאם בין שם עצם לכינוי רומז',
        run(ctx) {
            const findings = [];
            for (const tok of ctx.doc.tokens) {
                if (tok.kind !== 'hebrew')
                    continue;
                const demo = DEMONSTRATIVES[tok.text];
                if (!demo || demo.plural)
                    continue;
                const noun = previousHebrew(ctx, tok.index);
                if (!noun)
                    continue;
                const guess = guessNounGender(noun.text.replace(/^ה/, ''));
                if (guess.gender === 'unknown' || guess.confidence !== 'lexicon')
                    continue;
                if (guess.plural)
                    continue;
                if (guess.gender === demo.gender)
                    continue;
                findings.push(makeFinding(ctx, spec, {
                    start: tok.start,
                    end: tok.end,
                    message: `«${noun.text}» הוא שם ב${guess.gender === 'm' ? 'זכר' : 'נקבה'}, ולכן הכינוי הרומז צריך להיות «${demo.alt}».`,
                    suggestion: demo.alt,
                    replacement: demo.alt,
                    authority: academy('התחביר — התאם בין השם לכינוי הרומז'),
                }));
            }
            return findings;
        },
    };
}
function previousHebrew(ctx, index) {
    for (let i = index - 1; i >= 0; i--) {
        const t = ctx.doc.tokens[i];
        if (t.kind === 'whitespace')
            continue;
        return t.kind === 'hebrew' ? t : undefined;
    }
    return undefined;
}
//# sourceMappingURL=syntax.js.map
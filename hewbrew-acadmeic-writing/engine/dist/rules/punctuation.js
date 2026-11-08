/**
 * כללי הפיסוק של האקדמיה ללשון העברית.
 *
 * הכללים כאן נבחרו לפי מידת הוודאות שאפשר להגיע אליה בלי ניתוח תחבירי מלא:
 * איזון סימנים, סימן סיום, פסיק ברשימה, קו מפריד, ופיסוק שאלה.
 */
import { makeFinding } from '../text/diagnostics.js';
import { academy, convention, regexRule } from './helpers.js';
import { EN_DASH } from '../text/chars.js';
import { sentenceWords } from '../text/tokenize.js';
const HEB = '\\u05D0-\\u05EA';
const HEB_ANY = '\\u05D0-\\u05EA\\u0591-\\u05C7';
/** מילות שאלה שפותחות משפט שאלה */
const INTERROGATIVES = new Set([
    'האם', 'מדוע', 'למה', 'מתי', 'כיצד', 'איך', 'מי', 'מה', 'כמה',
    'היכן', 'לאן', 'מניין', 'מאין', 'האמנם', 'וכי', 'איזה', 'איזו', 'אילו',
]);
/**
 * האם הפסיק שלפני ו״ו החיבור עומד בסוף רשימת איברים.
 *
 * הכלל של האקדמיה נוגע לרשימה — ״תפוחים, אגסים וענבים״ — ולא לו״ו
 * שמחברת פסוקיות. ״ביום הוא ליטש עדשות, ובלילה כתב״ הוא פיסוק תקין
 * לחלוטין, ולכן חיפוש ״פסיק ואחריו ו״ו״ לבדו מייצר יותר רעש מתועלת.
 *
 * שני תנאים מבחינים בין השניים: ברשימה יש לפחות שלושה איברים, כלומר
 * פסיק נוסף קודם באותו משפט; והאיברים עצמם קצרים, שכן איבר ברשימה הוא
 * צירוף ולא משפט שלם.
 */
const MAX_LIST_ITEM_WORDS = 4;
const CLAUSE_BREAKS = ['.', '!', '?', '…', ':', ';', '\n'];
function countWords(segment) {
    return segment.trim().split(/\s+/).filter(Boolean).length;
}
/*
 * מזהה פסיק שבא לפני ו״ו החיבור של האיבר האחרון ברשימה.
 *
 * הגבול: רשימה של שני איברים אינה מזוהה כאן, ובכוונה. ״X, וY״ נראה זהה
 * ברשימה ובמשפט מאוחה, וההכרעה היא אם בכל אחד משני האיברים יש נושא ונשוא.
 * נמדד: הנתח המורפולוגי אינו מספק לכך — ״מסווג״ ו״מדווח״ אינם מזוהים
 * כפועל, ולעומתם ״תקנית״ ו״לשונית״ כן (ת+קנית נראה כעתיד), ולכן כל משפט
 * שמני נראה כאילו יש בו נשוא. כלל שהיה מסתמך על זה היה מסמן משפטים
 * מאוחים תקינים. ההכרעה הועברה אל SKILL.md כבדיקה שאינה אוטומטית.
 */
function isListFinalVav(text, commaIndex) {
    const sentenceStart = Math.max(-1, ...CLAUSE_BREAKS.map((ch) => text.lastIndexOf(ch, commaIndex - 1))) + 1;
    const members = text.slice(sentenceStart, commaIndex).split(',');
    if (members.length < 2)
        return false; // אין פסיק קודם — אין רשימה
    if (countWords(members[members.length - 1]) > MAX_LIST_ITEM_WORDS)
        return false;
    const after = [...CLAUSE_BREAKS, ',']
        .map((ch) => text.indexOf(ch, commaIndex + 1))
        .filter((i) => i > 0);
    const tailEnd = after.length ? Math.min(...after) : text.length;
    return countWords(text.slice(commaIndex + 1, tailEnd)) <= MAX_LIST_ITEM_WORDS + 1;
}
/** מיליות חיבור ושעבוד שפסיק צמוד אחריהן שגוי */
const SUBORDINATORS = ['כי', 'אם', 'כאשר', 'אשר', 'שכן', 'מפני', 'משום', 'כדי', 'בעוד', 'אף'];
export const punctuationRules = [
    balancedDelimitersRule(),
    missingTerminalPunctuationRule(),
    questionWithoutQuestionMarkRule(),
    regexRule({
        id: 'punct/comma-before-vav-list',
        category: 'punctuation',
        severity: 'warning',
        title: 'אין פסיק לפני ו״ו החיבור ברשימה',
        authority: academy('כללי הפיסוק — הפסיק ברשימת איברים'),
        // פסיק, רווח, ואז מילה שמתחילה בו״ו החיבור
        pattern: new RegExp(`,(\\s+)(\\u05D5[${HEB}])`),
        message: (m, ctx) => isListFinalVav(ctx.text, m.index)
            ? 'ברשימת איברים אין מציבים פסיק לפני ו״ו החיבור המחברת את האיבר האחרון.'
            : null,
        suggestion: 'להסיר את הפסיק',
        replacement: (m) => `${m[1]}${m[2]}`,
        autoFixSafe: false,
    }),
    regexRule({
        id: 'punct/comma-after-subordinator',
        category: 'punctuation',
        severity: 'error',
        title: 'פסיק צמוד אחרי מילית שעבוד',
        authority: academy('כללי הפיסוק — מקום הפסיק'),
        pattern: new RegExp(`(?<![${HEB_ANY}])(${SUBORDINATORS.join('|')})\\s*,`),
        message: (m) => `אין להציב פסיק מיד אחרי «${m[1]}» — הפסיק מפריד בין חלקי המשפט, לא בין המילית לפסוקית שלה.`,
        suggestion: (m) => `«${m[1]}» בלי פסיק`,
        replacement: (m) => m[1],
    }),
    regexRule({
        id: 'punct/hyphen-as-dash',
        category: 'punctuation',
        severity: 'warning',
        title: 'קו מפריד במקום מקף',
        authority: academy('כללי הפיסוק — הקו המפריד'),
        // מקף מוקף רווחים משמש כאן כקו מפריד
        pattern: /(?<=\S) - (?=\S)/,
        message: 'להפרדה בין חלקי משפט משמש קו מפריד – ולא מקף. המקף מחבר מילים בלי רווחים.',
        suggestion: ` ${EN_DASH} `,
        replacement: ` ${EN_DASH} `,
    }),
    regexRule({
        id: 'punct/dash-spacing',
        category: 'punctuation',
        severity: 'warning',
        title: 'הקו המפריד מוקף רווחים',
        authority: academy('כללי הפיסוק — הקו המפריד'),
        /*
         * רק בין אותיות. בטווח מספרים הקו נכתב בלי רווחים — ״עמ׳ 20–15״ —
         * וגם ״(–)״ בתוך סוגריים אינו קו מפריד בין חלקי משפט.
         */
        pattern: /(?<=[א-תA-Za-z])[–—](?=[א-תA-Za-z])/,
        message: 'הקו המפריד מופרד ברווח מכל צד.',
        suggestion: 'להוסיף רווחים משני הצדדים',
        replacement: (m) => ` ${m[0]} `,
        autoFixSafe: true,
    }),
    regexRule({
        id: 'punct/colon-before-list',
        category: 'punctuation',
        severity: 'suggestion',
        title: 'נקודתיים לפני פירוט',
        authority: academy('כללי הפיסוק — הנקודתיים לפני פירוט'),
        pattern: new RegExp(`(?<![${HEB_ANY}])(כגון|כדלקמן|כלהלן|לדוגמה|כמפורט)\\s*,`),
        message: (m) => `אחרי «${m[1]}» הפותח פירוט באות נקודתיים ולא פסיק.`,
        suggestion: (m) => `${m[1]}:`,
        replacement: (m) => `${m[1]}:`,
        autoFixSafe: false,
    }),
    regexRule({
        id: 'punct/double-comma',
        category: 'punctuation',
        severity: 'error',
        title: 'פסיק כפול',
        authority: convention('ניקיון פיסוק'),
        pattern: /,\s*,+/,
        message: 'יש כאן יותר מפסיק אחד ברצף.',
        suggestion: 'פסיק אחד',
        replacement: ',',
    }),
    regexRule({
        id: 'punct/comma-before-closing',
        category: 'punctuation',
        severity: 'warning',
        title: 'פסיק לפני סוגר',
        authority: convention('סדר סימני הפיסוק'),
        pattern: /,\s*(?=[)\]])/,
        message: 'פסיק אינו בא לפני סוגריים סוגרים; מקומו אחריהם.',
        suggestion: 'להעביר את הפסיק אחרי הסוגר',
        autoFixSafe: false,
    }),
    regexRule({
        id: 'punct/period-before-conjunction',
        category: 'punctuation',
        severity: 'suggestion',
        title: 'משפט הפותח בו״ו החיבור',
        authority: convention('מבנה משפט בכתיבה עיונית'),
        registers: ['academic'],
        pattern: new RegExp(`(?<=[.!?]\\s)\\u05D5[${HEB}]{2,}`),
        message: 'משפט הפותח בו״ו החיבור מרמז שהוא המשך המשפט הקודם. אפשר לחבר את המשפטים או לפתוח במילת קישור מפורשת.',
        suggestion: 'לחבר למשפט הקודם, או לפתוח ב«נוסף על כך», «כמו כן», «אולם»',
        autoFixSafe: false,
    }),
];
/**
 * איזון סוגריים, סוגריים מרובעים ומירכאות.
 * מירכאות שמשמשות ראשי תיבות (בין שתי אותיות עבריות) אינן נספרות.
 */
function balancedDelimitersRule() {
    const spec = {
        id: 'punct/unbalanced-delimiters',
        category: 'punctuation',
        severity: 'error',
    };
    const PAIRS = { '(': ')', '[': ']', '{': '}', '“': '”', '„': '”' };
    const CLOSERS = new Set([')', ']', '}', '”']);
    const NAMES = {
        '(': 'סוגריים',
        '[': 'סוגריים מרובעים',
        '{': 'סוגריים מסולסלים',
        '“': 'מירכאות',
        '„': 'מירכאות',
    };
    return {
        ...spec,
        title: 'איזון סוגריים ומירכאות',
        run(ctx) {
            const findings = [];
            const stack = [];
            const acronymQuote = new RegExp(`(?<=[${HEB}])"(?=[${HEB}])`);
            for (let i = 0; i < ctx.text.length; i++) {
                const ch = ctx.text[i];
                if (ch in PAIRS) {
                    stack.push({ ch, pos: i });
                    continue;
                }
                if (CLOSERS.has(ch)) {
                    const top = stack[stack.length - 1];
                    if (top && PAIRS[top.ch] === ch) {
                        stack.pop();
                    }
                    else {
                        findings.push(makeFinding(ctx, spec, {
                            start: i,
                            end: i + 1,
                            message: `הסימן «${ch}» סוגר בלי סימן פותח מתאים.`,
                            suggestion: 'לבדוק את איזון הסימנים במשפט',
                            authority: academy('כללי הפיסוק — הסוגריים והמירכאות באים בזוגות'),
                        }));
                    }
                }
            }
            for (const open of stack) {
                findings.push(makeFinding(ctx, spec, {
                    start: open.pos,
                    end: open.pos + 1,
                    message: `${NAMES[open.ch] ?? 'הסימן'} נפתחו כאן ולא נסגרו.`,
                    suggestion: `להוסיף «${PAIRS[open.ch]}»`,
                    authority: academy('כללי הפיסוק — הסוגריים והמירכאות באים בזוגות'),
                }));
            }
            // מירכאות ישרות: סופרים רק כאלה שאינן גרשיים של ראשי תיבות
            const quotePositions = [];
            for (let i = 0; i < ctx.text.length; i++) {
                if (ctx.text[i] !== '"')
                    continue;
                const context = ctx.text.slice(Math.max(0, i - 1), i + 2);
                if (acronymQuote.test(context))
                    continue;
                quotePositions.push(i);
            }
            if (quotePositions.length % 2 === 1) {
                const last = quotePositions[quotePositions.length - 1];
                findings.push(makeFinding(ctx, spec, {
                    start: last,
                    end: last + 1,
                    message: 'מספר המירכאות בטקסט אינו זוגי — כנראה חסרה מירכאה פותחת או סוגרת.',
                    suggestion: 'להשלים את המירכאה החסרה',
                    authority: academy('כללי הפיסוק — המירכאות באות בזוגות'),
                }));
            }
            return findings;
        },
    };
}
/** משפט מלא שאין בסופו סימן סיום. כותרות ופריטי רשימה מדולגים. */
function missingTerminalPunctuationRule() {
    const spec = {
        id: 'punct/missing-terminal',
        category: 'punctuation',
        severity: 'suggestion',
    };
    const TERMINALS = new Set(['.', '!', '?', '…', ':', ';', '׃']);
    return {
        ...spec,
        title: 'סימן סיום בסוף משפט',
        run(ctx) {
            const findings = [];
            for (const sentence of ctx.doc.sentences) {
                const words = sentenceWords(ctx.doc, sentence);
                // קטע קצר הוא בדרך כלל כותרת או פריט ברשימה, ואינו טעון נקודה
                if (words.length < 5)
                    continue;
                const lastChar = sentence.text.trimEnd().slice(-1);
                if (TERMINALS.has(lastChar))
                    continue;
                if (lastChar === ')' || lastChar === '"' || lastChar === '”')
                    continue;
                const end = sentence.end;
                findings.push(makeFinding(ctx, spec, {
                    start: Math.max(sentence.start, end - 1),
                    end,
                    message: 'המשפט מסתיים בלי סימן סיום.',
                    suggestion: 'להוסיף נקודה',
                    replacement: ctx.text.slice(Math.max(sentence.start, end - 1), end) + '.',
                    autoFixSafe: false,
                    authority: academy('כללי הפיסוק — הנקודה בסוף משפט'),
                }));
            }
            return findings;
        },
    };
}
/** משפט שפותח במילת שאלה ומסתיים בנקודה. */
function questionWithoutQuestionMarkRule() {
    const spec = {
        id: 'punct/question-mark',
        category: 'punctuation',
        severity: 'warning',
    };
    return {
        ...spec,
        title: 'סימן שאלה במשפט שאלה',
        run(ctx) {
            const findings = [];
            for (const sentence of ctx.doc.sentences) {
                const words = sentenceWords(ctx.doc, sentence);
                const first = words[0];
                if (!first || first.kind !== 'hebrew')
                    continue;
                if (!INTERROGATIVES.has(first.text))
                    continue;
                // «מי ש...», «מה ש...» הן פסוקיות זיקה ולא שאלות
                const second = words[1];
                if (second && second.text.startsWith('ש'))
                    continue;
                if (!sentence.text.trimEnd().endsWith('.'))
                    continue;
                const end = sentence.end;
                findings.push(makeFinding(ctx, spec, {
                    start: end - 1,
                    end,
                    message: `המשפט פותח ב«${first.text}» ונראה כמשפט שאלה, אך מסתיים בנקודה.`,
                    suggestion: 'סימן שאלה',
                    replacement: '?',
                    autoFixSafe: false,
                    authority: academy('כללי הפיסוק — סימן השאלה'),
                }));
            }
            return findings;
        },
    };
}
//# sourceMappingURL=punctuation.js.map
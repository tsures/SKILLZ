/**
 * עריכה ספרותית: מה שנכון דקדוקית ובכל זאת קורא רע —
 * חזרות, שרשרות סמיכות, עודף ״של״, קלישאות ומקצב אחיד.
 */
import { makeFinding } from '../text/diagnostics.js';
import { convention, regexRule, termRule } from './helpers.js';
import { sentenceWords } from '../text/tokenize.js';
import { normalizeForLookup } from '../text/chars.js';
const HEB_ANY = '\\u05D0-\\u05EA\\u0591-\\u05C7';
/** מילים תפקודיות — חזרה עליהן טבעית ואינה פגם */
const FUNCTION_WORDS = new Set([
    'של', 'את', 'עם', 'על', 'אל', 'מן', 'כי', 'אם', 'או', 'גם', 'אך', 'אבל',
    'לא', 'כן', 'זה', 'זו', 'זאת', 'הוא', 'היא', 'הם', 'הן', 'אני', 'אתה',
    'אנחנו', 'אתם', 'הזה', 'ההוא', 'אשר', 'כמו', 'כדי', 'רק', 'עוד', 'כבר',
    'יש', 'אין', 'היה', 'היו', 'הייתה', 'להיות', 'כל', 'כמה', 'מאוד', 'יותר',
    'אחרי', 'לפני', 'בין', 'תוך', 'בלי', 'אצל', 'ללא', 'אותו', 'אותה', 'שם',
    'כאן', 'שלו', 'שלה', 'שלהם', 'אלה', 'אלו', 'איזה', 'מה', 'מי', 'לכן',
]);
const CLICHES = [
    { avoid: 'בסופו של יום', prefer: 'בסופו של דבר / לבסוף', manual: true },
    { avoid: 'קצה הקרחון', prefer: 'ניסוח ישיר', manual: true },
    { avoid: 'חרב פיפיות', prefer: 'ניסוח ישיר', manual: true },
    { avoid: 'הנקודה למחשבה', prefer: 'ניסוח ישיר', manual: true },
    { avoid: 'ללא ספק', prefer: 'להשמיט — הביטחון עולה מן הטיעון', manual: true },
    { avoid: 'אין ספק כי', prefer: 'להשמיט', manual: true },
    { avoid: 'לא צריך להיות גאון', prefer: 'ניסוח ישיר', manual: true },
    { avoid: 'שווה זהב', prefer: 'ניסוח ישיר', manual: true },
    { avoid: 'טיפה בים', prefer: 'ניסוח ישיר', manual: true },
    { avoid: 'לשים על השולחן', prefer: 'להציג / להעלות', manual: true },
    { avoid: 'ברחבי הארץ', prefer: 'בכל הארץ', manual: true },
    { avoid: 'בזמן האחרון', prefer: 'לאחרונה', manual: true },
    { avoid: 'יום יומי', prefer: 'יומיומי', manual: true },
];
export const literaryRules = [
    termRule({
        id: 'literary/cliche',
        category: 'literary',
        severity: 'style',
        title: 'ביטוי שחוק',
        authority: convention('עריכה ספרותית — הימנעות מקלישאות'),
        registers: ['literary', 'academic'],
        entries: CLICHES,
        message: (entry, matched) => `«${matched}» ביטוי שחוק שאינו מוסיף מידע. ${entry.prefer}.`,
    }),
    regexRule({
        id: 'literary/periphrastic-past',
        category: 'literary',
        severity: 'style',
        title: 'עבר מתמשך בצורה מורכבת',
        authority: convention('עריכה ספרותית — מקצב הפועל'),
        registers: ['literary'],
        pattern: new RegExp(`(?<![${HEB_ANY}])(היה|הייתה|היו|הייתי|היינו)\\s+(מ[${HEB_ANY}]{3,})(?![${HEB_ANY}])`),
        message: (m) => `«${m[1]} ${m[2]}» הוא עבר מתמשך. אם אין כוונה להרגל חוזר, הצורה הפשוטה חדה יותר.`,
        suggestion: 'לשקול פועל בעבר פשוט',
        autoFixSafe: false,
        optIn: true,
    }),
    shelChainRule(),
    repetitionRule(),
    sentenceRhythmRule(),
];
/** יותר משלושה ״של״ במשפט אחד — סימן לנומינליזציה כבדה */
function shelChainRule() {
    const spec = {
        id: 'literary/shel-chain',
        category: 'literary',
        severity: 'suggestion',
    };
    return {
        ...spec,
        title: 'שרשרת ״של״',
        run(ctx) {
            const findings = [];
            for (const sentence of ctx.doc.sentences) {
                const shels = sentenceWords(ctx.doc, sentence).filter((t) => t.text === 'של');
                if (shels.length < 3)
                    continue;
                findings.push(makeFinding(ctx, spec, {
                    start: shels[0].start,
                    end: shels[shels.length - 1].end,
                    message: `במשפט אחד מופיעה המילה ״של״ ${shels.length} פעמים. אפשר להחליף חלק מהצירופים בסמיכות או לפצל את המשפט.`,
                    suggestion: 'להמיר חלק מן הצירופים לסמיכות',
                    authority: convention('עריכה ספרותית — נומינליזציה'),
                }));
            }
            return findings;
        },
    };
}
/** חזרה על אותה מילת תוכן בטווח קצר */
function repetitionRule() {
    const spec = {
        id: 'literary/word-repetition',
        category: 'literary',
        severity: 'suggestion',
    };
    const WINDOW = 12;
    return {
        ...spec,
        title: 'חזרה על מילה בטווח קצר',
        registers: ['literary', 'academic'],
        run(ctx) {
            const findings = [];
            const words = ctx.doc.words.filter((t) => t.kind === 'hebrew');
            for (let i = 0; i < words.length; i++) {
                const base = normalizeForLookup(words[i].text);
                if (base.length < 4 || FUNCTION_WORDS.has(base))
                    continue;
                for (let j = i + 1; j < words.length && j <= i + WINDOW; j++) {
                    if (normalizeForLookup(words[j].text) !== base)
                        continue;
                    // חזרה מכוונת בצמידות (״לאט לאט״) אינה פגם
                    if (j === i + 1)
                        break;
                    findings.push(makeFinding(ctx, spec, {
                        start: words[j].start,
                        end: words[j].end,
                        message: `המילה «${words[j].text}» חוזרת במרחק ${j - i} מילים מהופעתה הקודמת.`,
                        suggestion: 'לשקול מילה נרדפת או ניסוח אחר',
                        authority: convention('עריכה ספרותית — גיוון לשוני'),
                    }));
                    break;
                }
            }
            return findings;
        },
    };
}
/** רצף משפטים באורך דומה יוצר מקצב מונוטוני */
function sentenceRhythmRule() {
    const spec = {
        id: 'literary/monotone-rhythm',
        category: 'literary',
        severity: 'style',
    };
    return {
        ...spec,
        title: 'מקצב משפטים אחיד',
        registers: ['literary'],
        optIn: true,
        run(ctx) {
            const findings = [];
            const lengths = ctx.doc.sentences.map((s) => sentenceWords(ctx.doc, s).length);
            for (let i = 0; i + 3 < lengths.length; i++) {
                const window = lengths.slice(i, i + 4);
                if (window.some((n) => n < 6))
                    continue;
                const min = Math.min(...window);
                const max = Math.max(...window);
                if (max - min > 3)
                    continue;
                const first = ctx.doc.sentences[i];
                const last = ctx.doc.sentences[i + 3];
                findings.push(makeFinding(ctx, spec, {
                    start: first.start,
                    end: Math.min(last.end, first.start + 80),
                    message: `ארבעה משפטים רצופים באורך דומה (${window.join(', ')} מילים). גיוון באורך המשפט משפר את המקצב.`,
                    suggestion: 'לקצר משפט אחד או לאחד שניים',
                    authority: convention('עריכה ספרותית — מקצב'),
                }));
                i += 3;
            }
            return findings;
        },
    };
}
//# sourceMappingURL=literary.js.map
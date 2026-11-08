/** רישום הכלים, המשאבים וההנחיות של שרת ה־MCP. */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { analyze } from './engine.js';
import { applyFixes } from './text/fixer.js';
import { ALL_RULES, ALL_CATEGORIES, getRule } from './rules/index.js';
import { loadConfig } from './config.js';
import { formatAnalysis, formatConjugation } from './format.js';
import { CATEGORY_LABEL_HE, SEVERITY_LABEL_HE } from './text/diagnostics.js';
import { conjugate, BINYANIM } from './morph/binyanim.js';
import { detectGizra, normalizeRoot, GIZRA_DESCRIPTIONS } from './morph/roots.js';
import { classifyShva, attachPrefix, attachAllPrefixes } from './morph/vocalization.js';
import { analyzeVerb, TENSE_LABELS } from './morph/analyze.js';
import { numberToHebrewWords, ordinalToHebrewWords } from './knowledge/numerals.js';
import { CONNECTIVE_GROUPS, findConnectives, classifyConnective } from './knowledge/connectives.js';
const registerSchema = z.enum(['academic', 'literary', 'neutral']);
const severitySchema = z.enum(['error', 'warning', 'suggestion', 'style']);
const textOf = (s) => ({ content: [{ type: 'text', text: s }] });
/** מריץ בדיקה ומחזיר תשובה מעוצבת */
function runCheck(text, options, title) {
    const result = analyze(text, options);
    return textOf(formatAnalysis(text, result, title));
}
export function createServer() {
    const server = new McpServer({ name: 'hebrew-editor', version: '0.1.0' }, {
        instructions: 'שרת לעריכה לשונית־ספרותית ולהגהה בעברית לפי כללי האקדמיה ללשון העברית. ' +
            'כל הבדיקות מקומיות ומבוססות כללים — אין שליחת טקסט לשירות חיצוני. ' +
            'להגהה כללית יש להשתמש ב־proofread; לתיקון בפועל ב־apply_fixes. ' +
            'הכלים המורפולוגיים מחזירים כתיב מלא כברירת מחדל, וניקוד רק כשמבקשים אותו במפורש.',
    });
    // ── הגהה ────────────────────────────────────────────────────────────────
    server.registerTool('proofread', {
        title: 'הגהה מלאה',
        description: 'בודק טקסט עברי בכל קטגוריות הכללים: פיסוק, טיפוגרפיה, כתיב מלא, תחביר, ' +
            'שגיאות נפוצות, מילים לועזיות, מספרים, ומרשם הכתיבה. מחזיר לכל ממצא מיקום ' +
            'מדויק, הסבר בעברית, הצעת תיקון והפניה לכלל.',
        inputSchema: {
            text: z.string().describe('הטקסט העברי לבדיקה'),
            register: registerSchema.optional().describe('מרשם הכתיבה. academic מפעיל גם כללי סגנון עיוני'),
            categories: z.array(z.string()).optional().describe('להגביל לקטגוריות מסוימות'),
            severityMin: severitySchema.optional().describe('חומרה מזערית לדיווח'),
            maxFindings: z.number().int().positive().optional().describe('מספר ממצאים מרבי'),
        },
    }, async ({ text, register, categories, severityMin, maxFindings }) => runCheck(text, {
        register: register,
        categories: categories,
        severityMin: severityMin,
        maxFindings,
    }, 'הגהה מלאה'));
    server.registerTool('apply_fixes', {
        title: 'החלת תיקונים',
        description: 'מחזיר את הטקסט אחרי החלת התיקונים הבטוחים. תיקונים שדורשים הכרעה של ההקשר ' +
            'אינם מוחלים אלא אם מבקשים זאת במפורש, ומדווחים בנפרד.',
        inputSchema: {
            text: z.string().describe('הטקסט לתיקון'),
            register: registerSchema.optional(),
            onlySafe: z.boolean().optional().describe('להחיל רק תיקונים בטוחים. ברירת מחדל: true'),
            ruleIds: z.array(z.string()).optional().describe('להגביל לכללים מסוימים'),
            categories: z.array(z.string()).optional().describe('להגביל לקטגוריות מסוימות'),
        },
    }, async ({ text, register, onlySafe = true, ruleIds, categories }) => {
        const result = analyze(text, {
            register: register,
            categories: categories,
        });
        const fixed = applyFixes(text, result.findings, { onlySafe, ruleIds, categories });
        const lines = [
            `הוחלו ${fixed.applied.length} תיקונים.`,
            '',
            '── הטקסט המתוקן ──',
            fixed.text,
            '',
        ];
        if (fixed.applied.length > 0) {
            lines.push('── מה שונה ──');
            for (const a of fixed.applied) {
                lines.push(`  «${a.before}» ← «${a.after}»   (${a.ruleId})`);
            }
            lines.push('');
        }
        const needsReview = fixed.skipped.filter((s) => s.reason === 'unsafe' || s.reason === 'no-replacement');
        if (needsReview.length > 0) {
            lines.push(`── טעון הכרעה ידנית (${needsReview.length}) ──`);
            for (const s of needsReview.slice(0, 25)) {
                lines.push(`  «${s.excerpt}»   (${s.ruleId})`);
            }
            if (needsReview.length > 25)
                lines.push(`  ...ועוד ${needsReview.length - 25}`);
        }
        return textOf(lines.join('\n').trimEnd());
    });
    // ── בדיקות ממוקדות ──────────────────────────────────────────────────────
    const focused = [
        ['check_punctuation', 'פיסוק וטיפוגרפיה', 'בודק פיסוק וטיפוגרפיה בלבד: פסיק, נקודה, גרש וגרשיים, מקף עברי, מירכאות, רווחים ואותיות סופיות.', ['punctuation', 'typography']],
        ['check_ktiv_male', 'כתיב מלא', 'בודק כתיב חסר ניקוד לפי כללי הכתיב של האקדמיה: תוכנית, ביטחון, ייצוא, תקווה וכדומה.', ['ktiv-male']],
        ['check_syntax', 'תחביר והתאם', 'בודק התאם מין ומספר, יידוע בסמיכות, מילית ״את״, שלילה, ומילות היחס של הפועל.', ['syntax', 'numbers']],
        ['check_academic_style', 'מרשם אקדמי', 'בודק התאמה לכתיבה עיונית: לשון דיבור, ניסוח אישי, קיצורים, משפטים ארוכים וראשי תיבות שלא נפרשו.', ['academic']],
        ['check_literary_style', 'עריכה ספרותית', 'בודק חזרות מילוליות, שרשראות ״של״, קלישאות ומקצב משפטים.', ['literary']],
    ];
    for (const [name, title, description, categories] of focused) {
        server.registerTool(name, {
            title,
            description,
            inputSchema: {
                text: z.string().describe('הטקסט לבדיקה'),
                register: registerSchema.optional(),
            },
        }, async ({ text, register }) => runCheck(text, {
            categories,
            // הכללים האקדמיים והספרותיים פעילים רק במרשם שלהם
            register: register ??
                (name === 'check_academic_style' ? 'academic' : name === 'check_literary_style' ? 'literary' : undefined),
        }, title));
    }
    // ── מורפולוגיה ──────────────────────────────────────────────────────────
    server.registerTool('conjugate_verb', {
        title: 'נטיית הפועל',
        description: 'מחזיר טבלת נטייה מלאה לשורש בבניין נתון: עבר, הווה, עתיד, ציווי, שם הפועל, ' +
            'בינוני פעול ושם הפעולה. הניקוד מוחזר רק כאשר nikud=true. גזרה שאין לה תבנית ' +
            'ייעודית מסומנת accuracy=approx במקום להחזיר ניקוד שגוי בשקט.',
        inputSchema: {
            root: z.string().describe('שורש בן שלוש או ארבע אותיות, למשל כתב או פקד'),
            binyan: z.enum(BINYANIM).describe('הבניין'),
            nikud: z.boolean().optional().describe('להחזיר צורות מנוקדות. ברירת מחדל: false'),
        },
    }, async ({ root, binyan, nikud = false }) => {
        try {
            return textOf(formatConjugation(conjugate(root, binyan), nikud));
        }
        catch (err) {
            return textOf(`לא ניתן לנטות: ${err.message}`);
        }
    });
    server.registerTool('identify_gizra', {
        title: 'זיהוי גזרה',
        description: 'מזהה את גזרת השורש ומסביר במה היא משפיעה על הנטייה.',
        inputSchema: { root: z.string().describe('שורש בן שלוש או ארבע אותיות') },
    }, async ({ root }) => {
        const radicals = normalizeRoot(root);
        if (radicals.length < 3)
            return textOf('שורש חייב למנות שלוש אותיות לפחות.');
        const gizra = detectGizra(radicals);
        return textOf([
            `שורש ${radicals.join('־')}`,
            `גזרה: ${gizra}`,
            GIZRA_DESCRIPTIONS[gizra],
        ].join('\n'));
    });
    server.registerTool('analyze_verb', {
        title: 'ניתוח מורפולוגי של פועל',
        description: 'מקבל צורת פועל ומחזיר את השורש, הבניין, הגזרה, הזמן והגוף. ' +
            'צורה עברית חסרת ניקוד היא לרוב דו־משמעית, ולכן מוחזרים כל הניתוחים ' +
            'האפשריים לפי סדר מהימנות. הניתוח מקומי לגמרי — הוא נגזר ממנוע ' +
            'הנטייה עצמו, ולכן מדויק בדיוק כמותו.',
        inputSchema: {
            word: z.string().describe('צורת פועל, למשל נשלחה או התיישבנו'),
            nikud: z.boolean().optional().describe('להציג את הצורה המנוקדת'),
        },
    }, async ({ word, nikud = false }) => {
        const results = analyzeVerb(word);
        if (results.length === 0) {
            return textOf(`לא נמצא ניתוח ל«${word}». ייתכן שאינה פועל, או שהגזרה שלה אינה מכוסה במנוע.`);
        }
        const lines = [`ניתוח «${word}» — ${results.length} אפשרויות`, ''];
        for (const r of results) {
            const bits = [
                `שורש ${r.root.join('־')}`,
                `בניין ${r.binyan}`,
                `גזרת ${r.gizra}`,
                TENSE_LABELS[r.tense],
            ];
            if (r.personLabel)
                bits.push(`גוף ${r.personLabel}`);
            lines.push(`· ${bits.join(' · ')}`);
            lines.push(`    ${nikud ? r.nikud : r.plain}${r.accuracy !== 'full' ? `   [דיוק: ${r.accuracy}]` : ''}`);
        }
        return textOf(lines.join('\n'));
    });
    server.registerTool('analyze_shva', {
        title: 'סיווג שוואים ודגש קל',
        description: 'מקבל מילה מנוקדת ומסווג כל שווא שבה כנע או כנח, עם הכלל שהכריע, ' +
            'ומציין היכן יש דגש קל ומדוע. דורש מילה מנוקדת — בלי ניקוד אין מה לסווג.',
        inputSchema: {
            word: z.string().describe('מילה מנוקדת, למשל כְּשֶׁמִּתְעַצְבֶּנֶת'),
            isInfinitive: z.boolean().optional().describe('האם המילה היא שם פועל'),
        },
    }, async ({ word, isInfinitive }) => {
        const a = classifyShva(word, { isInfinitive });
        if (a.shvas.length === 0 && a.dageshQal.length === 0) {
            return textOf(`במילה «${word}» לא נמצאו שוואים ולא דגש קל. יש לוודא שהמילה מנוקדת.`);
        }
        const lines = [`ניתוח «${word}»`, ''];
        if (a.shvas.length) {
            lines.push('שוואים:');
            for (const s of a.shvas)
                lines.push(`  ${s.letter} — שווא ${s.kind}: ${s.reason}`);
            lines.push('');
        }
        if (a.dageshQal.length) {
            lines.push('דגש קל:');
            for (const d of a.dageshQal)
                lines.push(`  ${d.letter} — ${d.reason}`);
        }
        return textOf(lines.join('\n').trimEnd());
    });
    server.registerTool('attach_prefix', {
        title: 'ניקוד אותיות השימוש',
        description: 'מצרף אות שימוש (מש״ה וכל״ב) למילה מנוקדת ומנקד אותה לפי הכללים: פירוק צרור ' +
            'שוואים, ו״ו החיבור לפני בומ״פ, דגש משלים, והתנהגות ה״א הידיעה לפני גרוניות. ' +
            'בלי prefix מוחזרות כל אותיות השימוש להשוואה.',
        inputSchema: {
            word: z.string().describe('מילה מנוקדת, למשל חֲלוֹם'),
            prefix: z.enum(['ו', 'כ', 'ל', 'ב', 'מ', 'ש', 'ה']).optional().describe('אות השימוש'),
        },
    }, async ({ word, prefix }) => {
        try {
            const results = prefix
                ? [attachPrefix(word, prefix)]
                : attachAllPrefixes(word);
            const lines = [`המילה «${word}»`, ''];
            for (const r of results) {
                lines.push(`${r.prefixName} (${r.prefix}):  ${r.vocalized}   ← בכתיב מלא: ${r.plain}`);
                lines.push(`    ${r.rule}`);
                if (r.compensatoryDagesh)
                    lines.push('    האות הראשונה קיבלה דגש משלים.');
                lines.push('');
            }
            return textOf(lines.join('\n').trimEnd());
        }
        catch (err) {
            return textOf(`לא ניתן לצרף: ${err.message}`);
        }
    });
    // ── מספרים ──────────────────────────────────────────────────────────────
    server.registerTool('hebrew_number', {
        title: 'מספר במילים',
        description: 'ממיר מספר לכתיב מילולי עברי בהתאם למין שם העצם שאחריו. בעברית שם המספר ' +
            'מתאים למין שם העצם, וצורת הזכר היא דווקא זו שסיומה ה״א: שלושה ילדים, שלוש ילדות.',
        inputSchema: {
            value: z.number().int().describe('המספר, בטווח 0 עד 999999'),
            gender: z.enum(['m', 'f']).optional().describe('מין שם העצם הנמנה. ברירת מחדל: זכר'),
            ordinal: z.boolean().optional().describe('להחזיר מספר סודר במקום מונה'),
        },
    }, async ({ value, gender = 'm', ordinal = false }) => {
        try {
            const words = ordinal
                ? ordinalToHebrewWords(value, gender)
                : numberToHebrewWords(value, gender);
            const other = ordinal
                ? ordinalToHebrewWords(value, gender === 'm' ? 'f' : 'm')
                : numberToHebrewWords(value, gender === 'm' ? 'f' : 'm');
            return textOf([
                `${value} — ${words}`,
                `(ב${gender === 'm' ? 'נקבה' : 'זכר'}: ${other})`,
                '',
                'העשרות אינן נוטות במין; המאות בנקבה; האלפים והמיליונים בזכר.',
            ].join('\n'));
        }
        catch (err) {
            return textOf(err.message);
        }
    });
    // ── מילות קישור ─────────────────────────────────────────────────────────
    server.registerTool('find_connective', {
        title: 'מילות קישור',
        description: 'מוצא את מילות הקישור המתאימות לתפקיד רטורי או תחבירי: סיבה, ויתור, ניגוד, ' +
            'תכלית, סיכום, השוואה ועוד. אפשר גם למסור מילת קישור ולקבל את תפקידה.',
        inputSchema: {
            query: z.string().optional().describe('תפקיד או מילת קישור, למשל: ויתור, סיבה, אף על פי ש'),
            kind: z.enum(['פסוקית', 'משפט-מאוחה', 'בין-משפטים']).optional().describe('להגביל לסוג קישור'),
        },
    }, async ({ query, kind }) => {
        let groups = query ? findConnectives(query) : CONNECTIVE_GROUPS;
        if (kind)
            groups = groups.filter((g) => g.kind === kind);
        if (groups.length === 0) {
            return textOf(`לא נמצאה קבוצת קישור התואמת ל«${query}».`);
        }
        const exact = query ? classifyConnective(query.trim()) : [];
        const lines = [];
        if (exact.length > 0) {
            lines.push(`«${query}» משמשת: ${exact.map((g) => g.label).join(', ')}`, '');
        }
        for (const g of groups.slice(0, 12)) {
            lines.push(`${g.label} — ${g.kind}`);
            lines.push(`  ${g.connectives.join(' · ')}`);
            if (g.example)
                lines.push(`  דוגמה: ${g.example}`);
            lines.push('');
        }
        if (groups.length > 12)
            lines.push(`...ועוד ${groups.length - 12} קבוצות.`);
        return textOf(lines.join('\n').trimEnd());
    });
    // ── קטלוג הכללים ────────────────────────────────────────────────────────
    server.registerTool('list_rules', {
        title: 'קטלוג הכללים',
        description: 'מציג את כל הכללים שהשרת מכיר, לפי קטגוריה, כולל חומרה ומצב הפעלה.',
        inputSchema: {
            category: z.string().optional().describe('להגביל לקטגוריה'),
        },
    }, async ({ category }) => {
        const rules = category ? ALL_RULES.filter((r) => r.category === category) : ALL_RULES;
        if (rules.length === 0) {
            return textOf(`אין כללים בקטגוריה «${category}». הקטגוריות הקיימות: ${ALL_CATEGORIES.join(', ')}`);
        }
        const byCategory = new Map();
        for (const r of rules) {
            const list = byCategory.get(r.category) ?? [];
            list.push(r);
            byCategory.set(r.category, list);
        }
        const lines = [`${rules.length} כללים`, ''];
        for (const [cat, list] of byCategory) {
            lines.push(`── ${CATEGORY_LABEL_HE[cat] ?? cat} ──`);
            for (const r of list) {
                const flags = [SEVERITY_LABEL_HE[r.severity]];
                if (r.optIn)
                    flags.push('כבוי כברירת מחדל');
                if (r.registers)
                    flags.push(`מרשם: ${r.registers.join('/')}`);
                lines.push(`  ${r.id}  —  ${r.title}  [${flags.join(', ')}]`);
            }
            lines.push('');
        }
        return textOf(lines.join('\n').trimEnd());
    });
    server.registerTool('explain_rule', {
        title: 'הסבר כלל',
        description: 'מסביר כלל לפי מזההו, ומראה על מה הוא חל.',
        inputSchema: { ruleId: z.string().describe('מזהה הכלל, למשל ktiv/deficient-spelling') },
    }, async ({ ruleId }) => {
        const rule = getRule(ruleId);
        if (!rule) {
            const near = ALL_RULES.filter((r) => r.id.includes(ruleId)).map((r) => r.id);
            return textOf(near.length
                ? `לא נמצא כלל «${ruleId}». כללים דומים: ${near.join(', ')}`
                : `לא נמצא כלל «${ruleId}». אפשר לראות את הרשימה המלאה ב־list_rules.`);
        }
        return textOf([
            `${rule.id}`,
            `כותרת: ${rule.title}`,
            `קטגוריה: ${CATEGORY_LABEL_HE[rule.category]}`,
            `חומרת ברירת מחדל: ${SEVERITY_LABEL_HE[rule.severity]}`,
            rule.registers ? `פעיל במרשמים: ${rule.registers.join(', ')}` : 'פעיל בכל המרשמים',
            rule.optIn ? 'כבוי כברירת מחדל — יש להפעילו ב־enabledRules' : 'פעיל כברירת מחדל',
        ].join('\n'));
    });
    // ── משאבים ──────────────────────────────────────────────────────────────
    server.registerResource('connectives', 'hebrew://connectives', {
        title: 'רשימת מילות הקישור',
        description: 'טבלת מילות הקישור לפי תפקיד תחבירי ורטורי',
        mimeType: 'text/markdown',
    }, async (uri) => ({
        contents: [
            {
                uri: uri.href,
                mimeType: 'text/markdown',
                text: CONNECTIVE_GROUPS.map((g) => `## ${g.label} (${g.kind})\n\n${g.connectives.join(' · ')}\n${g.example ? `\n> ${g.example}\n` : ''}`).join('\n'),
            },
        ],
    }));
    server.registerResource('rules', 'hebrew://rules', {
        title: 'קטלוג הכללים',
        description: 'כל הכללים שהשרת מכיר',
        mimeType: 'text/markdown',
    }, async (uri) => ({
        contents: [
            {
                uri: uri.href,
                mimeType: 'text/markdown',
                text: ALL_RULES.map((r) => `- \`${r.id}\` — ${r.title} (${CATEGORY_LABEL_HE[r.category]}, ${SEVERITY_LABEL_HE[r.severity]})`).join('\n'),
            },
        ],
    }));
    server.registerResource('config', 'hebrew://config', {
        title: 'הגדרות סגנון הבית',
        description: 'ההגדרות שנטענו בפועל',
        mimeType: 'application/json',
    }, async (uri) => {
        const config = loadConfig();
        return {
            contents: [
                {
                    uri: uri.href,
                    mimeType: 'application/json',
                    text: JSON.stringify({ ...config, allowWords: [...config.allowWords] }, null, 2),
                },
            ],
        };
    });
    // ── הנחיות ──────────────────────────────────────────────────────────────
    server.registerPrompt('הגהה-מלאה', {
        title: 'הגהה מלאה',
        description: 'מריץ הגהה על טקסט ומסכם את הממצאים לפי סדר חשיבות',
        argsSchema: { text: z.string().describe('הטקסט להגהה') },
    }, ({ text }) => ({
        messages: [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text: 'הרץ proofread על הטקסט שלהלן. אחר כך סכם: קודם השגיאות התקניות שחייבות תיקון, ' +
                        'ואחריהן הצעות הסגנון. לכל ממצא ציין את הכלל ואת המקור. אל תשנה את הטקסט בעצמך — ' +
                        'הצג מה נמצא ותן לי להכריע.\n\n' + text,
                },
            },
        ],
    }));
    server.registerPrompt('עריכה-אקדמית', {
        title: 'עריכה אקדמית',
        description: 'הגהה במרשם אקדמי עם דגש על מרשם הכתיבה העיונית',
        argsSchema: { text: z.string().describe('הטקסט לעריכה') },
    }, ({ text }) => ({
        messages: [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text: 'הרץ proofread עם register="academic" על הטקסט שלהלן, ואחריו check_academic_style. ' +
                        'התייחס במיוחד ללשון דיבור, לניסוח אישי, לראשי תיבות שלא נפרשו ולמשפטים ארוכים מדי. ' +
                        'הצע ניסוח חלופי לכל בעיית מרשם, ושמור על הטיעון כפי שהוא.\n\n' + text,
                },
            },
        ],
    }));
    server.registerPrompt('עריכה-ספרותית', {
        title: 'עריכה ספרותית',
        description: 'עריכה ספרותית — חזרות, מקצב, קלישאות ונומינליזציה',
        argsSchema: { text: z.string().describe('הטקסט לעריכה') },
    }, ({ text }) => ({
        messages: [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text: 'הרץ proofread עם register="literary" ואחריו check_literary_style על הטקסט שלהלן. ' +
                        'התמקד בחזרות מילוליות, בשרשראות ״של״, בקלישאות ובמקצב המשפטים. ' +
                        'הצע חלופות ושמור על הקול של הכותב.\n\n' + text,
                },
            },
        ],
    }));
    return server;
}
//# sourceMappingURL=server.js.map
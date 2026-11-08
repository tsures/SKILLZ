/**
 * כללי סגנון בית.
 *
 * זהו כלל אחד שנטען מן ההגדרות בזמן ריצה, ולא רשימת כללים סטטית,
 * כדי שעריכת הקובץ תשפיע בלי בנייה מחדש.
 */
import { makeFinding } from '../text/diagnostics.js';
import { wholeWordPattern } from './helpers.js';
export const houseStyleRules = [
    {
        id: 'house/terms',
        category: 'house-style',
        severity: 'warning',
        title: 'מונחים אסורים ומועדפים מקובץ ההגדרות',
        run(ctx) {
            const findings = [];
            if (ctx.config.terms.length === 0)
                return findings;
            for (const term of ctx.config.terms) {
                let re;
                try {
                    re = term.regex
                        ? new RegExp(term.avoid, 'g')
                        : new RegExp(wholeWordPattern(term.avoid), 'g');
                }
                catch (err) {
                    process.stderr.write(`[hebrew-editor] כלל בית שגוי «${term.avoid}»: ${err.message}\n`);
                    continue;
                }
                let m;
                while ((m = re.exec(ctx.text)) !== null) {
                    if (m[0].length === 0) {
                        re.lastIndex++;
                        continue;
                    }
                    findings.push(makeFinding(ctx, { id: 'house/terms', category: 'house-style', severity: 'warning' }, {
                        start: m.index,
                        end: m.index + m[0].length,
                        severity: term.severity ?? 'warning',
                        message: `לפי כללי הבית אין להשתמש ב«${m[0]}»; הצורה המועדפת היא «${term.prefer}»` +
                            (term.reason ? ` — ${term.reason}` : '') + '.',
                        suggestion: term.prefer,
                        // ביטוי רגולרי עשוי ללכוד טקסט משתנה, ולכן אין מחליפים אוטומטית
                        replacement: term.regex ? undefined : term.prefer,
                        autoFixSafe: !term.regex,
                        authority: {
                            source: 'סגנון בית',
                            clause: ctx.config.sourcePath ?? 'הגדרות מקומיות',
                        },
                    }));
                }
            }
            return findings;
        },
    },
];
//# sourceMappingURL=houseStyle.js.map
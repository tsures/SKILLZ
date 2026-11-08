/**
 * החלת תיקונים על הטקסט.
 *
 * התיקונים מוחלים מהסוף להתחלה כדי שההיסטים של תיקון שטרם הוחל
 * לא יזוזו. ממצאים שטווחיהם חופפים אינם ניתנים להחלה יחד, ולכן נבחר
 * מהם אחד לפי סדר עדיפות קבוע והשאר מדווחים כמדולגים.
 */
import { SEVERITY_ORDER } from './diagnostics.js';
/**
 * ממצא עדיף על מתחרה חופף אם חומרתו גבוהה יותר; בשוויון — הטווח הארוך יותר,
 * ואז סדר אלפביתי של מזהה הכלל, כדי שהתוצאה תהיה דטרמיניסטית.
 */
function comparePriority(a, b) {
    return (SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity] ||
        b.end - b.start - (a.end - a.start) ||
        a.ruleId.localeCompare(b.ruleId));
}
export function applyFixes(text, findings, options = {}) {
    const { onlySafe = true, ruleIds, categories } = options;
    const applied = [];
    const skipped = [];
    const candidates = [];
    for (const f of findings) {
        const note = (reason) => skipped.push({ ruleId: f.ruleId, start: f.start, end: f.end, excerpt: f.excerpt, reason });
        if (ruleIds && !ruleIds.includes(f.ruleId)) {
            note('filtered');
            continue;
        }
        if (categories && !categories.includes(f.category)) {
            note('filtered');
            continue;
        }
        if (f.replacement === undefined) {
            note('no-replacement');
            continue;
        }
        if (onlySafe && !f.autoFixSafe) {
            note('unsafe');
            continue;
        }
        // תיקון שאינו משנה דבר אינו תיקון
        if (f.replacement === f.excerpt)
            continue;
        candidates.push(f);
    }
    // בוחרים קבוצה בלתי חופפת: עוברים לפי עדיפות ותופסים טווחים פנויים
    const chosen = [];
    const taken = [];
    for (const f of [...candidates].sort(comparePriority)) {
        const clashes = taken.some(([s, e]) => f.start < e && s < f.end);
        if (clashes) {
            skipped.push({
                ruleId: f.ruleId,
                start: f.start,
                end: f.end,
                excerpt: f.excerpt,
                reason: 'overlap',
            });
            continue;
        }
        taken.push([f.start, f.end]);
        chosen.push(f);
    }
    let out = text;
    for (const f of chosen.sort((a, b) => b.start - a.start)) {
        out = out.slice(0, f.start) + f.replacement + out.slice(f.end);
        applied.push({
            ruleId: f.ruleId,
            start: f.start,
            end: f.end,
            before: f.excerpt,
            after: f.replacement,
        });
    }
    applied.reverse();
    return { text: out, applied, skipped };
}
//# sourceMappingURL=fixer.js.map
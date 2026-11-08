/** טיפוסי הליבה: ממצא, חומרה, קטגוריה, וכלל. */
export const SEVERITY_ORDER = {
    error: 3,
    warning: 2,
    suggestion: 1,
    style: 0,
};
export const SEVERITY_LABEL_HE = {
    error: 'שגיאה',
    warning: 'אזהרה',
    suggestion: 'הצעה',
    style: 'סגנון',
};
export const CATEGORY_LABEL_HE = {
    typography: 'טיפוגרפיה',
    punctuation: 'פיסוק',
    'ktiv-male': 'כתיב מלא',
    syntax: 'תחביר',
    morphology: 'צורות ונטיות',
    'common-errors': 'שגיאות נפוצות',
    'foreign-terms': 'מילים לועזיות',
    academic: 'כתיבה אקדמית',
    literary: 'עריכה ספרותית',
    numbers: 'מספרים ותאריכים',
    spelling: 'איות',
    'house-style': 'סגנון בית',
};
/** בונה ממצא ומוודא שההיסטים והקטע עקביים. */
export function makeFinding(ctx, rule, init) {
    const start = Math.max(0, Math.min(init.start, ctx.text.length));
    const end = Math.max(start, Math.min(init.end, ctx.text.length));
    return {
        ruleId: rule.id,
        category: rule.category,
        severity: init.severity ?? rule.severity,
        start,
        end,
        excerpt: ctx.text.slice(start, end),
        message: init.message,
        suggestion: init.suggestion,
        replacement: init.replacement,
        autoFixSafe: init.autoFixSafe ?? init.replacement !== undefined,
        authority: init.authority,
    };
}
/** מיון ממצאים: לפי מיקום, ואז לפי חומרה יורדת. */
export function sortFindings(findings) {
    return [...findings].sort((a, b) => a.start - b.start ||
        SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity] ||
        a.ruleId.localeCompare(b.ruleId));
}
//# sourceMappingURL=diagnostics.js.map
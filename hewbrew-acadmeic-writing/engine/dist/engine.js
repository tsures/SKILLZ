/**
 * מנוע ההרצה: מרכיב הקשר, מריץ את הכללים הרלוונטיים, ומחזיר ממצאים ממוינים.
 */
import { SEVERITY_ORDER, sortFindings, CATEGORY_LABEL_HE, SEVERITY_LABEL_HE } from './text/diagnostics.js';
import { parseDocument } from './text/tokenize.js';
import { ALL_RULES } from './rules/index.js';
import { loadConfig } from './config.js';
/** האם הכלל אמור לרוץ בהקשר הנוכחי */
function isRuleActive(rule, register, config, opts) {
    if (opts.ruleIds)
        return opts.ruleIds.includes(rule.id);
    if (config.disabledRules.includes(rule.id))
        return false;
    if (config.disabledCategories.includes(rule.category))
        return false;
    if (opts.categories && !opts.categories.includes(rule.category))
        return false;
    const forced = config.enabledRules.includes(rule.id);
    if (rule.optIn && !forced)
        return false;
    if (rule.registers && !rule.registers.includes(register) && !forced)
        return false;
    return true;
}
export function analyze(text, options = {}) {
    const config = options.config ?? loadConfig();
    const register = options.register ?? config.register;
    const doc = parseDocument(text);
    const ctx = { text, register, doc, config };
    const active = ALL_RULES.filter((r) => isRuleActive(r, register, config, options));
    let findings = [];
    for (const rule of active) {
        let produced;
        try {
            produced = rule.run(ctx);
        }
        catch (err) {
            // כלל שנכשל לא יפיל את כל הבדיקה
            process.stderr.write(`[hebrew-editor] הכלל ${rule.id} נכשל: ${err.message}\n`);
            continue;
        }
        const override = config.severityOverrides[rule.id];
        if (override)
            produced = produced.map((f) => ({ ...f, severity: override }));
        findings.push(...produced);
    }
    if (options.severityMin) {
        const floor = SEVERITY_ORDER[options.severityMin];
        findings = findings.filter((f) => SEVERITY_ORDER[f.severity] >= floor);
    }
    findings = dedupe(sortFindings(findings));
    const totalFindings = findings.length;
    if (options.maxFindings !== undefined && findings.length > options.maxFindings) {
        findings = findings.slice(0, options.maxFindings);
    }
    const byCategory = {};
    const bySeverity = {};
    for (const f of findings) {
        const cat = CATEGORY_LABEL_HE[f.category] ?? f.category;
        byCategory[cat] = (byCategory[cat] ?? 0) + 1;
        const sev = SEVERITY_LABEL_HE[f.severity];
        bySeverity[sev] = (bySeverity[sev] ?? 0) + 1;
    }
    return {
        findings,
        totalFindings,
        stats: {
            characters: text.length,
            words: doc.words.length,
            sentences: doc.sentences.length,
            byCategory,
            bySeverity,
        },
        register,
        rulesRun: active.length,
        configSource: config.sourcePath,
    };
}
/** שני כללים שמצאו בדיוק את אותו קטע — מספיק לדווח על החמור שבהם. */
function dedupe(findings) {
    const seen = new Map();
    const out = [];
    for (const f of findings) {
        const key = `${f.start}:${f.end}:${f.replacement ?? ''}`;
        const prev = seen.get(key);
        if (prev && prev.ruleId !== f.ruleId && SEVERITY_ORDER[prev.severity] >= SEVERITY_ORDER[f.severity]) {
            continue;
        }
        seen.set(key, f);
        out.push(f);
    }
    return out;
}
//# sourceMappingURL=engine.js.map
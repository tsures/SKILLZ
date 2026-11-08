/**
 * מנוע ההרצה: מרכיב הקשר, מריץ את הכללים הרלוונטיים, ומחזיר ממצאים ממוינים.
 */

import type {
  Category,
  Finding,
  Register,
  Rule,
  RuleContext,
  Severity,
} from './text/diagnostics.js';
import { SEVERITY_ORDER, sortFindings, CATEGORY_LABEL_HE, SEVERITY_LABEL_HE } from './text/diagnostics.js';
import { parseDocument } from './text/tokenize.js';
import { ALL_RULES } from './rules/index.js';
import { loadConfig, type ResolvedConfig } from './config.js';

export interface AnalyzeOptions {
  register?: Register;
  /** להריץ רק קטגוריות אלו */
  categories?: Category[];
  /** להריץ רק כללים אלו */
  ruleIds?: string[];
  /** חומרה מזערית לדיווח */
  severityMin?: Severity;
  /** מספר ממצאים מרבי בתשובה */
  maxFindings?: number;
  config?: ResolvedConfig;
}

export interface AnalyzeResult {
  findings: Finding[];
  /** מספר הממצאים לפני חיתוך ל־maxFindings */
  totalFindings: number;
  stats: {
    characters: number;
    words: number;
    sentences: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  register: Register;
  rulesRun: number;
  configSource: string | null;
}

/** האם הכלל אמור לרוץ בהקשר הנוכחי */
function isRuleActive(rule: Rule, register: Register, config: ResolvedConfig, opts: AnalyzeOptions): boolean {
  if (opts.ruleIds) return opts.ruleIds.includes(rule.id);
  if (config.disabledRules.includes(rule.id)) return false;
  if (config.disabledCategories.includes(rule.category)) return false;
  if (opts.categories && !opts.categories.includes(rule.category)) return false;

  const forced = config.enabledRules.includes(rule.id);
  if (rule.optIn && !forced) return false;
  if (rule.registers && !rule.registers.includes(register) && !forced) return false;
  return true;
}

export function analyze(text: string, options: AnalyzeOptions = {}): AnalyzeResult {
  const config = options.config ?? loadConfig();
  const register = options.register ?? config.register;
  const doc = parseDocument(text);
  const ctx: RuleContext = { text, register, doc, config };

  const active = ALL_RULES.filter((r) => isRuleActive(r, register, config, options));

  let findings: Finding[] = [];
  for (const rule of active) {
    let produced: Finding[];
    try {
      produced = rule.run(ctx);
    } catch (err) {
      // כלל שנכשל לא יפיל את כל הבדיקה
      process.stderr.write(`[hebrew-editor] הכלל ${rule.id} נכשל: ${(err as Error).message}\n`);
      continue;
    }
    const override = config.severityOverrides[rule.id];
    if (override) produced = produced.map((f) => ({ ...f, severity: override }));
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

  const byCategory: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
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
function dedupe(findings: Finding[]): Finding[] {
  const seen = new Map<string, Finding>();
  const out: Finding[] = [];
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

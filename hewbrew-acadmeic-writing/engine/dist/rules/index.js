/** רג׳יסטרי הכללים — נקודת האיסוף היחידה של כל מודולי הכללים. */
import { typographyRules } from './typography.js';
import { punctuationRules } from './punctuation.js';
import { appositionRule } from './apposition.js';
import { academySyntaxRules } from './academySyntax.js';
import { clauseRules } from './clauses.js';
import { ktivMaleRules } from './ktivMale.js';
import { commonErrorRules } from './commonErrors.js';
import { foreignTermRules } from './foreignTerms.js';
import { syntaxRules } from './syntax.js';
import { academicRules } from './academic.js';
import { literaryRules } from './literary.js';
import { numberRules } from './numbers.js';
import { houseStyleRules } from './houseStyle.js';
import { courseRules } from './courseRules.js';
import { agreementRules } from './agreement.js';
export const ALL_RULES = [
    ...typographyRules,
    ...punctuationRules,
    appositionRule(),
    ...academySyntaxRules,
    ...clauseRules,
    ...ktivMaleRules,
    ...commonErrorRules,
    ...foreignTermRules,
    ...syntaxRules,
    ...academicRules,
    ...literaryRules,
    ...numberRules,
    ...houseStyleRules,
    ...courseRules,
    ...agreementRules,
];
const byId = new Map(ALL_RULES.map((r) => [r.id, r]));
export function getRule(id) {
    return byId.get(id);
}
export function rulesByCategory(category) {
    return ALL_RULES.filter((r) => r.category === category);
}
export const ALL_CATEGORIES = [
    ...new Set(ALL_RULES.map((r) => r.category)),
];
/** בדיקת שפיות: מזהי כללים חייבים להיות ייחודיים. */
export function findDuplicateRuleIds() {
    const seen = new Set();
    const dupes = new Set();
    for (const r of ALL_RULES) {
        if (seen.has(r.id))
            dupes.add(r.id);
        seen.add(r.id);
    }
    return [...dupes];
}
//# sourceMappingURL=index.js.map
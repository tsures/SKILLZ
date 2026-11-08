/**
 * כללי בית — הגדרות שהמשתמש יכול לספק כדי לדרוס את ברירות המחדל.
 *
 * הקובץ נטען אוטומטית מ־hebrew-editor.config.json בתיקיית העבודה,
 * או מהנתיב שב־HEBREW_EDITOR_CONFIG. היעדר קובץ אינו שגיאה.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
export const DEFAULT_CONFIG = {
    register: 'neutral',
    disabledRules: [],
    enabledRules: [],
    disabledCategories: [],
    severityOverrides: {},
    terms: [],
    ktivMale: {},
    allowWords: new Set(),
    maxSentenceWords: 40,
    sourcePath: null,
};
const CONFIG_FILENAMES = ['hebrew-editor.config.json', '.hebrew-editor.json'];
function findConfigPath(cwd) {
    const fromEnv = process.env.HEBREW_EDITOR_CONFIG;
    if (fromEnv && existsSync(fromEnv))
        return resolve(fromEnv);
    for (const name of CONFIG_FILENAMES) {
        const candidate = join(cwd, name);
        if (existsSync(candidate))
            return candidate;
    }
    return null;
}
export function resolveConfig(raw, sourcePath = null) {
    return {
        register: raw.register ?? DEFAULT_CONFIG.register,
        disabledRules: raw.disabledRules ?? [],
        enabledRules: raw.enabledRules ?? [],
        disabledCategories: raw.disabledCategories ?? [],
        severityOverrides: raw.severityOverrides ?? {},
        terms: raw.terms ?? [],
        ktivMale: raw.ktivMale ?? {},
        allowWords: new Set(raw.allowWords ?? []),
        maxSentenceWords: raw.maxSentenceWords ?? DEFAULT_CONFIG.maxSentenceWords,
        sourcePath,
    };
}
let cached = null;
/**
 * טוען את הגדרות סגנון הבית. קובץ פגום מדווח ל־stderr ואינו מפיל את השרת —
 * עדיף להמשיך עם ברירות המחדל מאשר לאבד את כל הבדיקות בגלל פסיק מיותר.
 */
export function loadConfig(cwd = process.cwd(), force = false) {
    if (cached && !force)
        return cached;
    const path = findConfigPath(cwd);
    if (!path) {
        cached = { ...DEFAULT_CONFIG, allowWords: new Set() };
        return cached;
    }
    try {
        const raw = JSON.parse(readFileSync(path, 'utf8'));
        cached = resolveConfig(raw, path);
    }
    catch (err) {
        process.stderr.write(`[hebrew-editor] שגיאה בקריאת קובץ ההגדרות ${path}: ${err.message}\n` +
            '[hebrew-editor] ממשיך עם הגדרות ברירת המחדל.\n');
        cached = { ...DEFAULT_CONFIG, allowWords: new Set() };
    }
    return cached;
}
export function clearConfigCache() {
    cached = null;
}
//# sourceMappingURL=config.js.map
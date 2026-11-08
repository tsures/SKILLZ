/**
 * שמות יישובים — רשימת היתר.
 *
 * שם מקום אינו מילה מילונית, ולכן כל בדיקת כתיב עלולה לסמן אותו
 * כשגיאה. מה שמופיע ברשימה הזאת לא מדווח, לא כשגיאת כתיב ולא כשיבוש.
 *
 * הקובץ נטען מ־data/places.json שנוצר מקומית; בהיעדרו אין השפעה.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
function dataPath() {
    const fromEnv = process.env.HEBREW_EDITOR_PLACES_DATA;
    if (fromEnv)
        return resolve(fromEnv);
    const here = dirname(fileURLToPath(import.meta.url));
    return join(here, '..', '..', 'data', 'places.json');
}
let cached = null;
let source = '';
export function loadPlaceNames(force = false) {
    if (cached && !force)
        return cached;
    const path = dataPath();
    if (!existsSync(path)) {
        cached = new Set();
        return cached;
    }
    try {
        const raw = JSON.parse(readFileSync(path, 'utf8'));
        source = raw.source ?? '';
        cached = new Set(raw.names ?? []);
    }
    catch (err) {
        process.stderr.write(`[hebrew-editor] רשימת היישובים ב־${path} אינה קריאה: ${err.message}\n`);
        cached = new Set();
    }
    return cached;
}
export function isPlaceName(word) {
    return loadPlaceNames().has(word);
}
export function placesSummary() {
    const names = loadPlaceNames();
    if (names.size === 0) {
        return 'רשימת היישובים אינה טעונה. אפשר לייצר אותה בפקודה: npm run harvest:places';
    }
    return `${names.size} שמות יישובים ורכיבי שם · מקור: ${source}`;
}
export function clearPlacesCache() {
    cached = null;
}
//# sourceMappingURL=places.js.map
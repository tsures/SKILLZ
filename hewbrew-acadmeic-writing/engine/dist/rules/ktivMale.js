/**
 * כתיב חסר ניקוד — כללי הכתיב המלא של האקדמיה.
 *
 * הבדיקה נעשית על טוקנים ולא בביטוי רגולרי, כדי שאפשר יהיה לטפל
 * באותיות השימוש בנפרד ולהצמיד לממצא רמת ודאות שונה.
 */
import { makeFinding } from '../text/diagnostics.js';
import { academy, regexRule } from './helpers.js';
import { normalizeForLookup, toFinalForm, hasFinalForm } from '../text/chars.js';
import { KTIV_MALE_MAP, KTIV_MALE_AMBIGUOUS_MAP, PREFIX_COLLISIONS_NORMALIZED, NEVER_FLAG, } from '../knowledge/ktivMale.js';
import { loadAcademyLexicon } from '../lexicon/academy.js';
import { isPlaceName } from '../lexicon/places.js';
/** אותיות השימוש שיכולות להיצמד לראש מילה */
const PREFIXES = ['ו', 'ה', 'ב', 'ל', 'כ', 'מ', 'ש', 'וה', 'וב', 'ול', 'וכ', 'ומ', 'וש', 'כש', 'לכש', 'מש'];
/**
 * אם המילה המקורית הסתיימה באות סופית, גם הצורה המתוקנת צריכה להסתיים בה.
 * ברשימות שמורות הצורות עם אות רגילה בסוף (״שיך״ ולא ״שיך״ הסופי).
 */
function withFinalLetter(word) {
    if (word.length === 0)
        return word;
    const last = word[word.length - 1];
    if (!hasFinalForm(last))
        return word;
    return word.slice(0, -1) + toFinalForm(last);
}
/**
 * ערך מלקסיקון האקדמיה, אם נקצר.
 * הוא נבדק אחרי הרשימה המובנית, כדי שהניסוחים והנימוקים הידניים
 * יגברו על ערך שנגזר אוטומטית.
 */
function academyEntry(normalized) {
    const lex = loadAcademyLexicon();
    const plene = lex.ktivMale[normalized];
    if (plene) {
        return {
            entry: { deficient: normalized, plene, rule: 'לפי מאגר המונחים של האקדמיה', prefixable: false },
            prefix: '',
            confidence: 'exact',
            ambiguous: false,
            origin: 'academy',
        };
    }
    const maybe = lex.ktivMaleAmbiguous[normalized];
    if (maybe) {
        return {
            entry: {
                deficient: normalized,
                plene: maybe,
                rule: 'הצורה החסרה היא בעצמה ערך תקני במאגר המונחים',
                prefixable: false,
            },
            prefix: '',
            confidence: 'exact',
            ambiguous: true,
            origin: 'academy',
        };
    }
    return null;
}
function lookup(surface) {
    const normalized = normalizeForLookup(surface);
    // הרשימה השמורה גוברת על כל מקור, כולל לקסיקון שנקצר
    if (NEVER_FLAG.has(normalized))
        return null;
    // שם יישוב נכתב כפי שנקבע רשמית, ואינו כפוף לכללי הכתיב המלא
    if (isPlaceName(surface) || isPlaceName(normalized))
        return null;
    const exact = KTIV_MALE_MAP.get(normalized);
    if (exact) {
        return { entry: exact, prefix: '', confidence: 'exact', ambiguous: false, origin: 'builtin' };
    }
    const exactAmbiguous = KTIV_MALE_AMBIGUOUS_MAP.get(normalized);
    if (exactAmbiguous) {
        return { entry: exactAmbiguous, prefix: '', confidence: 'exact', ambiguous: true, origin: 'builtin' };
    }
    if (PREFIX_COLLISIONS_NORMALIZED.has(normalized))
        return null;
    // הארוכות קודם, כדי ש״לכש״ ייבדק לפני ״ל״
    for (const prefix of [...PREFIXES].sort((a, b) => b.length - a.length)) {
        if (!normalized.startsWith(prefix))
            continue;
        const rest = normalized.slice(prefix.length);
        if (rest.length < 3)
            continue;
        const entry = KTIV_MALE_MAP.get(rest);
        if (entry?.prefixable) {
            return { entry, prefix, confidence: 'prefixed', ambiguous: false, origin: 'builtin' };
        }
    }
    return academyEntry(normalized);
}
function ktivMaleRule() {
    const spec = {
        id: 'ktiv/deficient-spelling',
        category: 'ktiv-male',
        severity: 'warning',
    };
    return {
        ...spec,
        title: 'כתיב חסר במקום כתיב מלא',
        run(ctx) {
            const findings = [];
            const extra = ctx.config.ktivMale;
            for (const tok of ctx.doc.tokens) {
                if (tok.kind !== 'hebrew')
                    continue;
                const normalized = normalizeForLookup(tok.text);
                // תוספות של סגנון בית קודמות לרשימה המובנית
                const fromConfig = extra[normalized] ?? extra[tok.text];
                if (fromConfig) {
                    const corrected = withFinalLetter(fromConfig);
                    findings.push(makeFinding(ctx, spec, {
                        start: tok.start,
                        end: tok.end,
                        message: `«${tok.text}» — לפי כללי הבית הכתיב הוא «${corrected}».`,
                        suggestion: corrected,
                        replacement: corrected,
                        authority: { source: 'סגנון בית', clause: 'רשימת כתיב מלא מקומית' },
                    }));
                    continue;
                }
                const match = lookup(tok.text);
                if (!match)
                    continue;
                const corrected = withFinalLetter(match.prefix + match.entry.plene);
                const isPrefixed = match.confidence === 'prefixed';
                findings.push(makeFinding(ctx, spec, {
                    start: tok.start,
                    end: tok.end,
                    /*
                     * שלוש דרגות ודאות:
                     * הרשימה המובנית נבדקה ערך־ערך, ולכן היא אזהרה שמתקנת מאליה.
                     * צורה דו־משמעית מדווחת בלי תיקון.
                     * ערך שנגזר אוטומטית ממאגר המונחים הוא הצעה בלבד: המאגר מוסר
                     * את הכתיב המלא של הערך, אך אינו יודע שהצורה החסרה שנגזרה ממנו
                     * היא לפעמים מילה אחרת לגמרי — ״שירת״ מול ״שיורת״. המסננים
                     * חוסמים את רוב ההתנגשויות, לא את כולן, ולכן אין תיקון אוטומטי.
                     */
                    severity: match.ambiguous || match.origin === 'academy' ? 'suggestion' : 'warning',
                    message: match.ambiguous
                        ? `«${tok.text}» — ${match.entry.rule}, ואז הכתיב המלא הוא «${corrected}».`
                        : match.origin === 'academy'
                            ? `אם «${tok.text}» כאן הוא המונח שבמאגר האקדמיה, הכתיב המלא שלו הוא ` +
                                `«${corrected}». צורה עברית אחרת באותן אותיות תקינה כמות שהיא.`
                            : `«${tok.text}» נכתב בכתיב חסר. הכתיב המלא הוא «${corrected}» (${match.entry.rule}).`,
                    suggestion: corrected,
                    replacement: match.ambiguous || match.origin === 'academy' ? undefined : corrected,
                    autoFixSafe: !match.ambiguous && match.origin !== 'academy',
                    authority: match.origin === 'academy'
                        ? {
                            source: 'האקדמיה ללשון העברית',
                            clause: 'מאגר המונחים — הכתיב המלא של הערך',
                            url: 'https://terms.hebrew-academy.org.il',
                        }
                        : academy(`כללי הכתיב חסר הניקוד — ${match.entry.rule}`),
                }));
            }
            return findings;
        },
    };
}
/**
 * מילים שנפתחות בו״ו עיצורית.
 *
 * רשימה סגורה ולא דפוס: ״ולד״ ו״ולך״ נראות זהות למכונה, והבחנה ביניהן
 * מחייבת היכרות עם המילה עצמה. הצורות בלי אות שימוש תקינות כמות שהן.
 */
const VAV_INITIAL = [
    'ועד', 'ועדה', 'ועדות', 'ועידה', 'ועידות',
    'ותיק', 'ותיקה', 'ותיקים', 'ותיקות', 'ותק',
    'ויכוח', 'ויכוחים', 'ויתור', 'ויתורים',
    'וילון', 'וילונות', 'וילה', 'וילות',
    'ורוד', 'ורודה', 'ורודים',
    'וטרינר', 'וטרינרית', 'ויזה', 'ויטמין', 'ויטמינים',
    'ויסקי', 'וידאו', 'ויראלי',
];
/**
 * צירופים שאסור לפרש כאות שימוש ועוד מילה שפותחת בו״ו: כל אחד מהם מילה
 * שכיחה בפני עצמה. ״מועד״ אינו מ+ועד, ו״מותק״ אינו מ+ותק.
 */
const VAV_PREFIX_COLLISIONS = new Set([
    'מועד', 'מועדים', 'מועדה', 'מועדות', 'מועידה', 'מותק', 'שותק',
]);
export const ktivMaleRules = [
    ktivMaleRule(),
    regexRule({
        id: 'ktiv/vav-not-doubled-after-prefix',
        category: 'ktiv-male',
        severity: 'warning',
        title: 'ו״ו עיצורית נכפלת אחרי אות שימוש',
        authority: academy('כללי הכתיב חסר הניקוד — כפל ו״ו עיצורית באמצע מילה'),
        /*
         * בראש מילה נכתבת ו״ו אחת — ״ועדה״, ״ותיק״ — אך אות שימוש מעבירה
         * אותה אל תוך המילה, ואז היא נכפלת: ״הוועדה״, ״הוותיק״, ״בוויכוח״.
         * הרשימה סגורה בכוונה: ״הולך״ ו״הוא״ פותחות באותו רצף אותיות בדיוק,
         * ורק היכרות עם המילה מבחינה ביניהן.
         */
        /*
         * ו״ו החיבור אינה נכללת: ״ו+ועדה״ נכתב ״וועדה״ ולא בשלוש ו״וים,
         * ולכן הצורה הכתובה כבר תקינה ואין מה להוסיף לה.
         */
        pattern: new RegExp(`(?<![א-ת֑-ׇ])([הבלכמש]|כש|לכש|מש)(${VAV_INITIAL.join('|')})(?![א-ת֑-ׇ])`),
        message: (m) => VAV_PREFIX_COLLISIONS.has(m[0])
            ? null
            : `ו״ו עיצורית באמצע מילה נכפלת. אחרי אות השימוש «${m[1]}» יש לכתוב ` +
                `«${m[1]}ו${m[2]}» ולא «${m[0]}».`,
        suggestion: (m) => `${m[1]}ו${m[2]}`,
        replacement: (m) => `${m[1]}ו${m[2]}`,
        autoFixSafe: true,
    }),
    // ── החלה יתרה של הכללים ──────────────────────────────────────────────────
    regexRule({
        id: 'ktiv/vav-doubled-at-start',
        category: 'ktiv-male',
        severity: 'warning',
        title: 'ו״ו כפולה בראש מילה',
        authority: academy('כללי הכתיב חסר הניקוד — אין מכפילים ו״ו בראש מילה'),
        pattern: /(?<![א-ת֑-ׇ])וו(?=[א-ת])/,
        message: 'בראש מילה נכתבת ו״ו אחת, גם כשהיא עיצורית: ורוד, ותיק, ועדה. הכפלה נהוגה רק בתעתיק שמות לועזיים.',
        suggestion: 'ו״ו אחת',
        replacement: 'ו',
        autoFixSafe: false,
    }),
    regexRule({
        id: 'ktiv/vav-tripled',
        category: 'ktiv-male',
        severity: 'error',
        title: 'שלוש ו״וים ברצף',
        authority: academy('כללי הכתיב חסר הניקוד — ו״ו כפולה לכל היותר'),
        pattern: /ווו+/,
        message: 'רצף של שלוש ו״וים אינו תקני בשום כתיב.',
        suggestion: 'ו״ו כפולה',
        replacement: 'וו',
        autoFixSafe: false,
    }),
    regexRule({
        id: 'ktiv/yod-doubled-at-end',
        category: 'ktiv-male',
        severity: 'suggestion',
        title: 'יו״ד כפולה בסוף מילה',
        authority: academy('כללי הכתיב חסר הניקוד — היו״ד בסוף מילה'),
        // כפל יו״ד בסוף מילה תקין רק בכינוי הקניין של מדבר: ילדיי, ספריי
        pattern: /(?<=[א-ת])ייִ?(?![א-ת֑-ׇ])/,
        message: 'כפל יו״ד בסוף מילה שמור לכינוי הקניין של מדבר (ספריי, ילדיי). בכל מקרה אחר נכתבת יו״ד אחת.',
        suggestion: 'לבדוק אם מדובר בכינוי קניין של מדבר',
        autoFixSafe: false,
        optIn: true,
    }),
];
//# sourceMappingURL=ktivMale.js.map
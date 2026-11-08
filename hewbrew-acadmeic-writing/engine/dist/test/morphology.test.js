/**
 * מבחני המורפולוגיה.
 *
 * טבלת הזהב היא נטיית השורש פק"ד בשבעת הבניינים, מתוך דף העזר
 * ״נטיית הפועל בגזרת השלמים – שורש פק״ד״, המכללה האקדמית בית ברל,
 * החוג ללשון העברית. כל צורה שם היא צורה שנבדקה ונלמדה.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conjugate } from '../morph/binyanim.js';
import { detectGizra, normalizeRoot } from '../morph/roots.js';
import { classifyShva, attachPrefix } from '../morph/vocalization.js';
import { analyzeVerb } from '../morph/analyze.js';
import { numberToHebrewWords, ordinalToHebrewWords } from '../knowledge/numerals.js';
const nfc = (s) => s?.normalize('NFC');
/** טבלת פק"ד — בניין ← מפתח צורה ← הצורה המנוקדת */
const PAQAD = {
    פעל: {
        'past.p3ms': 'פָּקַד', 'past.p1s': 'פָּקַדְתִּי', 'past.p3fs': 'פָּקְדָה',
        'past.p2mp': 'פְּקַדְתֶּם', 'past.p3mp': 'פָּקְדוּ',
        'present.ms': 'פּוֹקֵד', 'present.fs': 'פּוֹקֶדֶת',
        'present.mp': 'פּוֹקְדִים', 'present.fp': 'פּוֹקְדוֹת',
        'future.p3ms': 'יִפְקֹד', 'future.p1s': 'אֶפְקֹד', 'future.p2fs': 'תִּפְקְדִי',
        'future.p1p': 'נִפְקֹד', 'future.p3mp': 'יִפְקְדוּ',
        'imperative.ms': 'פְּקֹד', 'imperative.fs': 'פִּקְדִי', 'imperative.mp': 'פִּקְדוּ',
        infinitive: 'לִפְקֹד', passiveParticiple: 'פָּקוּד', gerund: 'פְּקִידָה',
    },
    נפעל: {
        'past.p3ms': 'נִפְקַד', 'past.p1s': 'נִפְקַדְתִּי', 'past.p3fs': 'נִפְקְדָה',
        'present.ms': 'נִפְקָד', 'present.fs': 'נִפְקֶדֶת',
        'present.mp': 'נִפְקָדִים', 'present.fp': 'נִפְקָדוֹת',
        'future.p3ms': 'יִפָּקֵד', 'future.p1s': 'אֶפָּקֵד', 'future.p2fs': 'תִּפָּקְדִי',
        'imperative.ms': 'הִפָּקֵד', 'imperative.fs': 'הִפָּקְדִי',
        infinitive: 'לְהִפָּקֵד',
    },
    פיעל: {
        'past.p3ms': 'פִּקֵּד', 'past.p1s': 'פִּקַּדְתִּי', 'past.p3fs': 'פִּקְּדָה',
        'present.ms': 'מְפַקֵּד', 'present.fs': 'מְפַקֶּדֶת', 'present.mp': 'מְפַקְּדִים',
        'future.p3ms': 'יְפַקֵּד', 'future.p1s': 'אֲפַקֵּד', 'future.p1p': 'נְפַקֵּד',
        'imperative.ms': 'פַּקֵּד', infinitive: 'לְפַקֵּד',
    },
    פועל: {
        'past.p3ms': 'פֻּקַּד', 'past.p1s': 'פֻּקַּדְתִּי', 'past.p3fs': 'פֻּקְּדָה',
        'present.ms': 'מְפֻקָּד', 'present.fs': 'מְפֻקֶּדֶת', 'present.mp': 'מְפֻקָּדִים',
        'future.p3ms': 'יְפֻקַּד', 'future.p1s': 'אֲפֻקַּד',
    },
    הפעיל: {
        'past.p3ms': 'הִפְקִיד', 'past.p1s': 'הִפְקַדְתִּי', 'past.p3fs': 'הִפְקִידָה',
        'present.ms': 'מַפְקִיד', 'present.fs': 'מַפְקִידָה', 'present.mp': 'מַפְקִידִים',
        'future.p3ms': 'יַפְקִיד', 'future.p1s': 'אַפְקִיד', 'future.p1p': 'נַפְקִיד',
        'imperative.ms': 'הַפְקֵד', infinitive: 'לְהַפְקִיד', gerund: 'הַפְקָדָה',
    },
    הופעל: {
        'past.p3ms': 'הֻפְקַד', 'past.p1s': 'הֻפְקַדְתִּי', 'past.p3fs': 'הֻפְקְדָה',
        'present.ms': 'מֻפְקָד', 'present.fs': 'מֻפְקֶדֶת', 'present.mp': 'מֻפְקָדִים',
        'future.p3ms': 'יֻפְקַד', 'future.p1s': 'אֻפְקַד',
    },
    התפעל: {
        'past.p3ms': 'הִתְפַּקֵּד', 'past.p1s': 'הִתְפַּקַּדְתִּי', 'past.p3fs': 'הִתְפַּקְּדָה',
        'present.ms': 'מִתְפַּקֵּד', 'present.fs': 'מִתְפַּקֶּדֶת', 'present.mp': 'מִתְפַּקְּדִים',
        'future.p3ms': 'יִתְפַּקֵּד', 'future.p1s': 'אֶתְפַּקֵּד',
        'imperative.ms': 'הִתְפַּקֵּד', infinitive: 'לְהִתְפַּקֵּד', gerund: 'הִתְפַּקְּדוּת',
    },
};
function formOf(binyan, key) {
    const c = conjugate('פקד', binyan);
    if (key === 'infinitive')
        return c.infinitive?.nikud;
    if (key === 'passiveParticiple')
        return c.passiveParticiple?.nikud;
    if (key === 'gerund')
        return c.gerund?.nikud;
    const [section, name] = key.split('.');
    const list = section === 'past' ? c.past
        : section === 'present' ? c.present
            : section === 'future' ? c.future
                : c.imperative;
    return list.find((f) => f.key === name)?.nikud;
}
for (const [binyan, forms] of Object.entries(PAQAD)) {
    test(`נטיית פק"ד בבניין ${binyan} תואמת לטבלת בית ברל`, () => {
        for (const [key, expected] of Object.entries(forms)) {
            assert.equal(nfc(formOf(binyan, key)), nfc(expected), `${binyan}.${key}`);
        }
    });
}
test('כתיב מלא נגזר מן הצורה המנוקדת', () => {
    const cases = [
        ['כתב', 'פעל', 'future.p3ms', 'יכתוב'],
        ['כתב', 'נפעל', 'future.p3ms', 'ייכתב'],
        ['דבר', 'פיעל', 'gerund', 'דיבור'],
        ['כתב', 'הופעל', 'past.p3ms', 'הוכתב'],
        ['קנה', 'פעל', 'gerund', 'קנייה'],
        ['גלה', 'פיעל', 'past.p3ms', 'גילה'],
        ['קום', 'פעל', 'future.p3ms', 'יקום'],
    ];
    for (const [root, binyan, key, expected] of cases) {
        const c = conjugate(root, binyan);
        const [section, name] = key.split('.');
        const list = section === 'past' ? c.past : section === 'future' ? c.future : [];
        const form = key === 'gerund' ? c.gerund?.plain : list.find((f) => f.key === name)?.plain;
        assert.equal(form, expected, `${root}/${binyan}/${key}`);
    }
});
test('מטתזה בהתפעל לפני אות שורקת', () => {
    assert.equal(conjugate('סדר', 'התפעל').past.find((f) => f.key === 'p3ms')?.plain, 'הסתדר');
    assert.equal(conjugate('צרף', 'התפעל').past.find((f) => f.key === 'p3ms')?.plain, 'הצטרף');
    assert.equal(conjugate('זמן', 'התפעל').past.find((f) => f.key === 'p3ms')?.plain, 'הזדמן');
});
/**
 * המבחן שתופס את מחלקת הבאגים של המנתח.
 *
 * הניתוח הוא היפוך של הייצור, ולכן כל צורה שהמנוע מייצר חייבת להיות
 * ניתנת לניתוח בחזרה אל אותו שורש ואותו בניין. כשהאמת הזאת נשברת,
 * הסיבה כמעט תמיד אחת משתיים: אות בשורש הבדיקה שמתנגשת בשלד התבנית,
 * או שתי תבניות שונות שנבלעו זו בזו במפתח הדדופליקציה.
 */
test('כל צורה שהמנוע מייצר ניתנת לניתוח בחזרה', () => {
    const cases = [
        ['כתב', 'פעל'], ['קום', 'פעל'], ['בנה', 'פעל'], ['מצא', 'פעל'],
        ['יצא', 'פעל'], ['ישב', 'פעל'], ['נפל', 'פעל'], ['סבב', 'פעל'],
        ['אמר', 'פעל'], ['שלח', 'פעל'], ['שיר', 'פעל'], ['נתן', 'פעל'],
        ['עלה', 'פעל'], ['רוץ', 'פעל'],
        ['קנה', 'פיעל'], ['פרסם', 'פיעל'], ['תרגם', 'פיעל'],
        ['ארגן', 'התפעל'], ['סדר', 'התפעל'], ['צרף', 'התפעל'], ['זמן', 'התפעל'],
        ['ידע', 'הפעיל'], ['יצא', 'הפעיל'], ['ישב', 'הפעיל'], ['ירד', 'הפעיל'],
        ['כנס', 'נפעל'], ['שלם', 'פועל'], ['עבר', 'הופעל'], ['ידע', 'הופעל'],
    ];
    const missing = [];
    for (const [root, binyan] of cases) {
        const table = conjugate(root, binyan);
        const forms = [...table.past, ...table.present, ...table.future, ...table.imperative];
        for (const single of [table.infinitive, table.passiveParticiple, table.gerund]) {
            if (single)
                forms.push(single);
        }
        for (const form of forms) {
            const found = analyzeVerb(form.plain).some((a) => a.binyan === binyan && a.root.join('') === table.root.join(''));
            if (!found)
                missing.push(`${root}/${binyan} ${form.key}=${form.plain}`);
        }
    }
    assert.deepEqual(missing, [], `צורות שאינן ניתנות לניתוח: ${missing.join(', ')}`);
});
test('פ״י שמקורה פ״ו מקבלת אם קריאה בבניינים הכבדים', () => {
    assert.equal(conjugate('ידע', 'הפעיל').past.find((f) => f.key === 'p3ms')?.nikud, 'הוֹדִיעַ');
    assert.equal(conjugate('ישב', 'הפעיל').past.find((f) => f.key === 'p3ms')?.plain, 'הושיב');
    assert.equal(conjugate('ירד', 'הפעיל').gerund?.plain, 'הורדה');
    assert.equal(conjugate('יצא', 'הפעיל').past.find((f) => f.key === 'p3ms')?.plain, 'הוציא');
    assert.equal(conjugate('ידע', 'הופעל').past.find((f) => f.key === 'p3ms')?.nikud, 'הוּדַע');
    // פ״י מקורית נשארת בצירי־יו״ד
    assert.equal(conjugate('יטב', 'הפעיל').past.find((f) => f.key === 'p3ms')?.plain, 'היטיב');
});
test('שורש מרובע נוטה בבניינים הכבדים', () => {
    const piel = conjugate('פרסם', 'פיעל');
    assert.equal(piel.past.find((f) => f.key === 'p3ms')?.plain, 'פרסם');
    assert.equal(piel.past.find((f) => f.key === 'p3ms')?.nikud, 'פִּרְסֵם');
    assert.equal(piel.past.find((f) => f.key === 'p1s')?.nikud, 'פִּרְסַמְתִּי');
    assert.equal(piel.present.find((f) => f.key === 'ms')?.nikud, 'מְפַרְסֵם');
    assert.equal(piel.infinitive?.nikud, 'לְפַרְסֵם');
    // שם הפעולה של מרובע: פִּרְסוּם, בלי יו״ד — החיריק סגור בהברה
    assert.equal(piel.gerund?.plain, 'פרסום');
    assert.equal(conjugate('תרגם', 'פיעל').gerund?.plain, 'תרגום');
    assert.equal(conjugate('ארגן', 'התפעל').past.find((f) => f.key === 'p3ms')?.plain, 'התארגן');
});
test('ניתוח מזהה שורש מרובע מוכר בלבד', () => {
    const found = analyzeVerb('פרסם').find((a) => a.binyan === 'פיעל' && a.tense === 'past');
    assert.equal(found?.root.join(''), 'פרסמ');
    assert.ok(analyzeVerb('תרגמתי').some((a) => a.root.join('') === 'תרגמ'));
    /*
     * שלד המרובעים ריק כמעט לגמרי, ולכן כל מילה בת ארבע אותיות מתאימה
     * לתבנית. רק רשימת השורשים המוכרים מונעת מ״שולחן״ להיקרא פועל.
     */
    assert.equal(analyzeVerb('שולחן').length, 0);
});
test('אות סופית בשורש מנורמלת', () => {
    assert.deepEqual(normalizeRoot('קום'), ['ק', 'ו', 'מ']);
    assert.equal(conjugate('קום', 'פעל').past.find((f) => f.key === 'p1s')?.plain, 'קמתי');
});
test('זיהוי גזרה', () => {
    assert.equal(detectGizra(['ק', 'נ', 'ה']), 'ל"ה');
    assert.equal(detectGizra(['ק', 'ו', 'מ']), 'ע"ו');
    assert.equal(detectGizra(['נ', 'פ', 'ל']), 'פ"נ');
    assert.equal(detectGizra(['מ', 'צ', 'א']), 'ל"א');
    assert.equal(detectGizra(['כ', 'ת', 'ב']), 'שלמים');
});
/**
 * צורות שנבדקו מול לוחות נטיית הפועל של האקדמיה ללשון העברית.
 * אלה בדיוק הגזרות שהמנוע טעה בהן לפני האימות.
 */
const ACADEMY_FORMS = [
    // ע״ע — העתיד והציווי מתכווצים
    ['סבב', 'פעל', 'future.p3ms', 'יָסֹב'],
    ['סבב', 'פעל', 'future.p1s', 'אָסֹב'],
    ['סבב', 'פעל', 'imperative.ms', 'סֹב'],
    ['סבב', 'פעל', 'infinitive', 'לִסְבֹּב'],
    ['סבב', 'פעל', 'present.ms', 'סוֹבֵב'],
    ['סבב', 'פעל', 'past.p3ms', 'סָבַב'],
    // פ״א מקבוצת ״יֹאמַר״
    ['אמר', 'פעל', 'future.p3ms', 'יֹאמַר'],
    ['אמר', 'פעל', 'future.p1s', 'אֹמַר'],
    ['אמר', 'פעל', 'future.p2fs', 'תֹּאמְרִי'],
    ['אמר', 'פעל', 'imperative.ms', 'אֱמֹר'],
    ['אמר', 'פעל', 'present.ms', 'אוֹמֵר'],
    ['אמר', 'פעל', 'past.p3ms', 'אָמַר'],
    // ל״א — צירי לפני סיומת עיצורית
    ['מצא', 'פעל', 'past.p1s', 'מָצָאתִי'],
    ['מצא', 'פעל', 'future.p3ms', 'יִמְצָא'],
    ['מצא', 'פעל', 'present.fs', 'מוֹצֵאת'],
    ['מצא', 'פעל', 'infinitive', 'לִמְצֹא'],
    ['מצא', 'נפעל', 'past.p3ms', 'נִמְצָא'],
    ['מצא', 'נפעל', 'past.p1s', 'נִמְצֵאתִי'],
    ['מצא', 'נפעל', 'present.fs', 'נִמְצֵאת'],
    ['מצא', 'הפעיל', 'past.p3ms', 'הִמְצִיא'],
    ['מצא', 'הפעיל', 'past.p1s', 'הִמְצֵאתִי'],
    ['מצא', 'הפעיל', 'future.p3ms', 'יַמְצִיא'],
    ['מצא', 'הופעל', 'past.p3ms', 'הֻמְצָא'],
    ['מצא', 'הופעל', 'future.p3ms', 'יֻמְצָא'],
    ['מצא', 'התפעל', 'past.p3ms', 'הִתְמַצֵּא'],
    ['מצא', 'התפעל', 'past.p1s', 'הִתְמַצֵּאתִי'],
];
/** גזרות שאומתו מול לוחות נטיית הפועל, סבב שני */
const ACADEMY_FORMS_2 = [
    // ע״ו ו־ע״י
    ['קום', 'פעל', 'infinitive', 'לָקוּם'],
    ['קום', 'פעל', 'past.p1s', 'קַמְתִּי'],
    ['קום', 'פעל', 'future.p3ms', 'יָקוּם'],
    ['שיר', 'פעל', 'infinitive', 'לָשִׁיר'],
    ['שיר', 'פעל', 'past.p3ms', 'שָׁר'],
    ['שיר', 'פעל', 'future.p3ms', 'יָשִׁיר'],
    ['שיר', 'פעל', 'imperative.ms', 'שִׁיר'],
    // פ״י — היו״ד נופלת בעתיד ובציווי
    ['ישב', 'פעל', 'past.p3ms', 'יָשַׁב'],
    ['ישב', 'פעל', 'present.ms', 'יוֹשֵׁב'],
    ['ישב', 'פעל', 'future.p1s', 'אֵשֵׁב'],
    ['ישב', 'פעל', 'future.p3ms', 'יֵשֵׁב'],
    ['ישב', 'פעל', 'imperative.ms', 'שֵׁב'],
    ['ישב', 'פעל', 'infinitive', 'לָשֶׁבֶת'],
    // ל׳ גרונית — פתח גנובה ותנועת פתח בעתיד
    ['שלח', 'פעל', 'present.ms', 'שׁוֹלֵחַ'],
    ['שלח', 'פעל', 'present.fs', 'שׁוֹלַחַת'],
    ['שלח', 'פעל', 'future.p3ms', 'יִשְׁלַח'],
    ['שלח', 'פעל', 'infinitive', 'לִשְׁלֹחַ'],
];
test('ניתוח מורפולוגי מזהה שורש, בניין, זמן וגוף', () => {
    /*
     * הצורות והניתוחים אומתו מול שירות ניתוח הפעלים של האקדמיה.
     * המנתח עצמו מקומי: הוא נגזר ממנוע הנטייה בדרך ההפוכה.
     */
    const cases = [
        ['נשלחה', { root: 'שלח', binyan: 'נפעל', tense: 'past', person: 'p3fs' }],
        ['הפקיד', { root: 'פקד', binyan: 'הפעיל', tense: 'past', person: 'p3ms' }],
        ['ייכתבו', { root: 'כתב', binyan: 'נפעל', tense: 'future', person: 'p3mp' }],
        ['התיישבנו', { root: 'ישב', binyan: 'התפעל', tense: 'past', person: 'p1p' }],
        ['כתבתי', { root: 'כתב', binyan: 'פעל', tense: 'past', person: 'p1s' }],
        ['מדובר', { root: 'דבר', binyan: 'פועל', tense: 'present', person: 'ms' }],
    ];
    for (const [word, want] of cases) {
        const results = analyzeVerb(word);
        const hit = results.find((r) => r.root.join('') === want.root &&
            r.binyan === want.binyan &&
            r.tense === want.tense &&
            (want.person === undefined || r.person === want.person));
        assert.ok(hit, `«${word}» — לא נמצא הניתוח ${want.root}/${want.binyan}/${want.tense}`);
    }
});
test('כפל יו״ד בפעלי פ״י בבניינים הכבדים', () => {
    assert.equal(conjugate('ישב', 'התפעל').past.find((f) => f.key === 'p3ms')?.plain, 'התיישב');
    assert.equal(conjugate('יצג', 'פיעל').present.find((f) => f.key === 'ms')?.plain, 'מייצג');
    // ביו״ד שאינה פ״א הפועל הכלל אינו חל
    assert.equal(conjugate('חיה', 'פעל').past.find((f) => f.key === 'p3ms')?.plain, 'חיה');
});
test('שורש חלש בשתי עמדות מסומן כטעון אימות', () => {
    for (const root of ['חיה', 'נטה']) {
        assert.equal(conjugate(root, 'פעל').accuracy, 'approx', root);
    }
    for (const root of ['קנה', 'קום', 'ישב', 'פקד']) {
        assert.equal(conjugate(root, 'פעל').accuracy, 'full', root);
    }
});
test('נקודת שי״ן ושׂי״ן מסומנת', () => {
    // בלי הנקודה הצורה אינה מנוקדת כהלכה, וזה נגע לכל שורש שיש בו שי״ן
    assert.equal(nfc(conjugate('שמר', 'פעל').past.find((f) => f.key === 'p3ms')?.nikud), nfc('שָׁמַר'));
    assert.equal(nfc(conjugate('עשה', 'פעל').past.find((f) => f.key === 'p3ms')?.nikud), nfc('עָשָׂה'));
    assert.equal(nfc(conjugate('עשה', 'פעל').present.find((f) => f.key === 'ms')?.nikud), nfc('עוֹשֶׂה'));
});
test('גזרות ע״ו, ע״י, פ״י ול׳ גרונית תואמות ללוחות האקדמיה', () => {
    for (const [root, binyan, key, expected] of ACADEMY_FORMS_2) {
        const c = conjugate(root, binyan);
        let got;
        if (key === 'infinitive')
            got = c.infinitive?.nikud;
        else {
            const [section, name] = key.split('.');
            const list = section === 'past' ? c.past
                : section === 'present' ? c.present
                    : section === 'future' ? c.future
                        : c.imperative;
            got = list.find((f) => f.key === name)?.nikud;
        }
        assert.equal(nfc(got), nfc(expected), `${root}/${binyan}/${key}`);
    }
});
test('גזרות ע״ע, פ״א ול״א תואמות ללוחות האקדמיה', () => {
    for (const [root, binyan, key, expected] of ACADEMY_FORMS) {
        const c = conjugate(root, binyan);
        let got;
        if (key === 'infinitive')
            got = c.infinitive?.nikud;
        else {
            const [section, name] = key.split('.');
            const list = section === 'past' ? c.past
                : section === 'present' ? c.present
                    : section === 'future' ? c.future
                        : c.imperative;
            got = list.find((f) => f.key === name)?.nikud;
        }
        assert.equal(nfc(got), nfc(expected), `${root}/${binyan}/${key}`);
    }
});
test('גזרה שאין לה תבנית מסומנת ואינה מתחזה לוודאית', () => {
    const c = conjugate('סבב', 'התפעל');
    assert.notEqual(c.accuracy, 'full');
    assert.ok(c.note && c.note.length > 0);
});
// ── שוואים ואותיות שימוש ────────────────────────────────────────────────────
test('סיווג שוואים לפי כללי הקורס', () => {
    // שווא בראש מילה — נע
    assert.equal(classifyShva('וְחוֹזֶרֶת').shvas[0].kind, 'נע');
    // שווא אחרי תנועה גדולה — נע
    assert.equal(classifyShva('צָדְקוּ').shvas[0].kind, 'נע');
    // שווא אחרי תנועה קטנה — נח
    assert.equal(classifyShva('מַלְכֵּי').shvas[0].kind, 'נח');
});
test('דגש קל אחרי שווא נח בלבד', () => {
    // שאלת הבונוס מן המטלה: אין סיבה לדגש קל בכ״ף של ״לכופף״
    const withDagesh = classifyShva('לְכּוֹפֵף');
    assert.equal(withDagesh.dageshQal.length, 0);
    const legit = classifyShva('מַלְכֵּי');
    assert.equal(legit.dageshQal.length, 1);
    assert.equal(legit.dageshQal[0].letter, 'כ');
});
test('ניקוד אותיות השימוש', () => {
    const cases = [
        ['מַזְמִינָה', 'ו', 'וּמַזְמִינָה'], // ו״ו לפני בומ״פ
        ['בְּכָל', 'ו', 'וּבְכָל'], // פירוק צרור שוואים
        ['יְשֵׁנָה', 'ו', 'וִישֵׁנָה'], // יו״ד שוואית
        ['חֲלוֹם', 'ב', 'בַּחֲלוֹם'], // לפני חטף
        ['הַחֲלוֹם', 'ו', 'וְהַחֲלוֹם'], // ו״ו אינה בולעת את ה״א הידיעה
        ['נָשִׁים', 'ה', 'הַנָּשִׁים'], // פתח ודגש משלים
        ['אִישׁ', 'ה', 'הָאִישׁ'], // קמץ לפני אר״ע
        ['חָשׁוּךְ', 'ה', 'הֶחָשׁוּךְ'], // סגול לפני ח בקמץ
        ['מִבְנֵה', 'מ', 'מִמִּבְנֵה'], // חיריק ודגש משלים
        ['עוֹלָם', 'מ', 'מֵעוֹלָם'], // צירי לפני גרונית
    ];
    for (const [word, prefix, expected] of cases) {
        assert.equal(nfc(attachPrefix(word, prefix).vocalized), nfc(expected), `${prefix} + ${word}`);
    }
});
// ── מספרים ──────────────────────────────────────────────────────────────────
test('שם המספר נוטה במין', () => {
    assert.equal(numberToHebrewWords(3, 'm'), 'שלושה');
    assert.equal(numberToHebrewWords(3, 'f'), 'שלוש');
    assert.equal(numberToHebrewWords(12, 'm'), 'שנים עשר');
    assert.equal(numberToHebrewWords(12, 'f'), 'שתים עשרה');
    assert.equal(numberToHebrewWords(0), 'אפס');
});
test('מאות בנקבה ואלפים בזכר', () => {
    assert.equal(numberToHebrewWords(300, 'm'), 'שלוש מאות');
    assert.equal(numberToHebrewWords(3000, 'm'), 'שלושת אלפים');
    assert.equal(numberToHebrewWords(21, 'f'), 'עשרים ואחת');
});
test('מיליונים — לפי הדוגמאות שבחומרי הקורס', () => {
    /*
     * ״מיליון״ ו״אלף״ שמות זכר, ולכן שם המספר שלפניהם בזכר תמיד;
     * רק הקבוצה האחרונה מתאימה את מינה לשם העצם הנמנה.
     */
    assert.equal(numberToHebrewWords(24_012_016, 'f'), 'עשרים וארבעה מיליון שנים עשר אלף ושש עשרה');
    assert.equal(numberToHebrewWords(11_050_803, 'm'), 'אחד עשר מיליון חמישים אלף שמונה מאות ושלושה');
    assert.equal(numberToHebrewWords(1_000_000), 'מיליון');
    assert.equal(numberToHebrewWords(2_000_000), 'שני מיליון');
});
test('מספרים סודרים', () => {
    assert.equal(ordinalToHebrewWords(1, 'm'), 'ראשון');
    assert.equal(ordinalToHebrewWords(2, 'f'), 'שנייה');
});
//# sourceMappingURL=morphology.test.js.map
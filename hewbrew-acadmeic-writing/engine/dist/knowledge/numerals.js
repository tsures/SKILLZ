/**
 * שמות המספר בעברית ומינם.
 *
 * בעברית שם המספר מתאים למין שם העצם, ובניגוד להיגיון הצורני —
 * שם המספר בזכר הוא דווקא זה שסיומו ה״א: שלושה ילדים, שלוש ילדות.
 */
/**
 * ״שמונה״ נכתב אותו הדבר בזכר ובנקבה בכתיב חסר ניקוד (שְׁמוֹנָה / שְׁמוֹנֶה),
 * ולכן אי אפשר להסיק ממנו על המין בלי ניקוד.
 */
const RAW = [
    ['אחד', 1, 'm', 'absolute'],
    ['אחת', 1, 'f', 'absolute'],
    ['שניים', 2, 'm', 'absolute'],
    ['שתיים', 2, 'f', 'absolute'],
    ['שני', 2, 'm', 'construct'],
    ['שתי', 2, 'f', 'construct'],
    ['שלושה', 3, 'm', 'absolute'],
    ['שלוש', 3, 'f', 'absolute'],
    ['שלושת', 3, 'm', 'construct'],
    ['ארבעה', 4, 'm', 'absolute'],
    ['ארבע', 4, 'f', 'absolute'],
    ['ארבעת', 4, 'm', 'construct'],
    ['חמישה', 5, 'm', 'absolute'],
    ['חמש', 5, 'f', 'absolute'],
    ['חמשת', 5, 'm', 'construct'],
    ['שישה', 6, 'm', 'absolute'],
    ['שש', 6, 'f', 'absolute'],
    ['ששת', 6, 'm', 'construct'],
    ['שבעה', 7, 'm', 'absolute'],
    ['שבע', 7, 'f', 'absolute'],
    ['שבעת', 7, 'm', 'construct'],
    ['שמונה', 8, 'both', 'absolute'],
    ['שמונת', 8, 'm', 'construct'],
    ['תשעה', 9, 'm', 'absolute'],
    ['תשע', 9, 'f', 'absolute'],
    ['תשעת', 9, 'm', 'construct'],
    ['עשרה', 10, 'm', 'absolute'],
    ['עשר', 10, 'f', 'absolute'],
    ['עשרת', 10, 'm', 'construct'],
];
export const NUMERALS = RAW.map(([word, value, gender, state]) => ({
    word,
    value,
    gender,
    state,
}));
export const NUMERAL_BY_WORD = new Map(NUMERALS.map((n) => [n.word, n]));
/** הצורה הנגדית: אותו ערך, אותו מצב, המין ההפוך */
export function counterpart(numeral, gender) {
    return NUMERALS.find((n) => n.value === numeral.value && n.state === numeral.state && (n.gender === gender || n.gender === 'both'));
}
// ── יצירת מספרים במילים ──────────────────────────────────────────────────────
const ONES = {
    m: ['', 'אחד', 'שניים', 'שלושה', 'ארבעה', 'חמישה', 'שישה', 'שבעה', 'שמונה', 'תשעה'],
    f: ['', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע'],
};
const TEENS = {
    m: [
        'עשרה', 'אחד עשר', 'שנים עשר', 'שלושה עשר', 'ארבעה עשר', 'חמישה עשר',
        'שישה עשר', 'שבעה עשר', 'שמונה עשר', 'תשעה עשר',
    ],
    f: [
        'עשר', 'אחת עשרה', 'שתים עשרה', 'שלוש עשרה', 'ארבע עשרה', 'חמש עשרה',
        'שש עשרה', 'שבע עשרה', 'שמונה עשרה', 'תשע עשרה',
    ],
};
/** העשרות אינן נוטות במין */
const TENS = ['', 'עשר', 'עשרים', 'שלושים', 'ארבעים', 'חמישים', 'שישים', 'שבעים', 'שמונים', 'תשעים'];
/** המאות נוטות בנקבה, משום ש״מאה״ היא שם נקבה */
const HUNDREDS = [
    '', 'מאה', 'מאתיים', 'שלוש מאות', 'ארבע מאות', 'חמש מאות',
    'שש מאות', 'שבע מאות', 'שמונה מאות', 'תשע מאות',
];
/** האלפים באים בנסמך של הזכר: שלושת אלפים */
const THOUSANDS_CONSTRUCT = [
    '', 'אלף', 'אלפיים', 'שלושת אלפים', 'ארבעת אלפים', 'חמשת אלפים',
    'ששת אלפים', 'שבעת אלפים', 'שמונת אלפים', 'תשעת אלפים',
];
/**
 * ממיר מספר שלם לכתיב מילולי עברי, בהתאם למין שם העצם שאחריו.
 * נתמך הטווח 0–999,999.
 */
export function numberToHebrewWords(n, gender = 'm') {
    if (!Number.isInteger(n))
        throw new Error('נתמכים מספרים שלמים בלבד');
    if (n < 0)
        return 'מינוס ' + numberToHebrewWords(-n, gender);
    if (n === 0)
        return 'אפס';
    if (n > 999_999_999)
        throw new Error('נתמך הטווח 0–999,999,999');
    const parts = [];
    /*
     * ״מיליון״ ו״אלף״ הם שמות זכר, ולכן שם המספר שלפניהם בזכר תמיד —
     * גם כששם העצם הנמנה בנקבה: ״עשרים וארבעה מיליון... ושש עשרה חתולות״.
     * רק הקבוצה האחרונה מתאימה את מינה לשם העצם.
     */
    const millions = Math.floor(n / 1_000_000);
    if (millions > 0) {
        // לפני ״מיליון״ בא שם המספר בנסמך, ולכן ״שני מיליון״ ולא ״שניים מיליון״
        const count = millions === 1 ? '' : millions === 2 ? 'שני' : numberToHebrewWords(millions, 'm');
        parts.push(count ? `${count} מיליון` : 'מיליון');
    }
    const belowMillion = n % 1_000_000;
    const thousands = Math.floor(belowMillion / 1000);
    let rest = belowMillion % 1000;
    if (thousands > 0) {
        if (thousands < 10) {
            parts.push(THOUSANDS_CONSTRUCT[thousands]);
        }
        else {
            // מעל תשעת אלפים: המספר נאמר במלואו ואחריו ״אלף״
            parts.push(`${numberToHebrewWords(thousands, 'm')} אלף`);
        }
    }
    const hundreds = Math.floor(rest / 100);
    rest = rest % 100;
    if (hundreds > 0)
        parts.push(HUNDREDS[hundreds]);
    if (rest >= 10 && rest <= 19) {
        parts.push(TEENS[gender][rest - 10]);
    }
    else {
        const tens = Math.floor(rest / 10);
        const ones = rest % 10;
        if (tens > 0)
            parts.push(TENS[tens]);
        if (ones > 0)
            parts.push(ONES[gender][ones]);
    }
    // בין שני האיברים האחרונים באה ו״ו החיבור
    if (parts.length > 1) {
        const last = parts.pop();
        return `${parts.join(' ')} ו${last}`;
    }
    return parts[0];
}
/** מספרים סודרים: ראשון, שני, שלישי... מעל עשירי משתמשים בשם המספר המונה */
const ORDINALS = {
    m: ['', 'ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שביעי', 'שמיני', 'תשיעי', 'עשירי'],
    f: ['', 'ראשונה', 'שנייה', 'שלישית', 'רביעית', 'חמישית', 'שישית', 'שביעית', 'שמינית', 'תשיעית', 'עשירית'],
};
export function ordinalToHebrewWords(n, gender = 'm') {
    if (n >= 1 && n <= 10)
        return ORDINALS[gender][n];
    // מאחת עשרה ומעלה משמש שם המספר המונה במקום הסודר
    return `ה${numberToHebrewWords(n, gender)}`;
}
//# sourceMappingURL=numerals.js.map
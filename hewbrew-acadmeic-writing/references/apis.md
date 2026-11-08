# שירותי לשון חינמיים — תיעוד

כל השלושה: **ללא מפתח API, ללא הרשמה, ללא הגבלת מכסה מוצהרת.**
כולם נבדקו ועובדים.

---

## 1. האקדמיה ללשון העברית — החלטות בדקדוק ובפיסוק

הסמכות הרשמית לעברית תקנית. האתר בנוי על ורדפרס וחושף REST API פתוח.

**בסיס:** `https://hebrew-academy.org.il/wp-json/wp/v2`

| נתיב | תוכן |
|---|---|
| `/hahlata` | 403 החלטות רשמיות (דקדוק, ניקוד, פיסוק, שימושי לשון) |
| `/topic` | טקסונומיית הפרקים: 1.1 הקמץ, 2.1 משקלים, 4.1 שימושי לשון, כללי הפיסוק… |
| `/posts`, `/pages` | תוכן האתר הכללי |

**חובה לשלוח User-Agent של דפדפן** — Cloudflare חוסם בקשות ללא UA:

```bash
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
curl -s -A "$UA" "https://hebrew-academy.org.il/wp-json/wp/v2/hahlata?per_page=100&_fields=id,title,link,topic"
```

**מגבלה:** פרמטר `search=` אינו פועל על סוג הפוסט `hahlata` (מחזיר `[]`).
לכן `heb_api.py` מוריד את כל 403 ההחלטות פעם אחת, שומר במטמון מקומי
(`scripts/.cache/`) ומסנן מקומית. גוף ההחלטה עצמו אינו נחשף ב-API —
ה-JSON מחזיר כותרת, פרק וקישור קנוני; את הנוסח המלא יש לקרוא בעמוד עצמו.

```bash
python scripts/heb_api.py rules פיסוק
python scripts/heb_api.py rules שימושי לשון
python scripts/heb_api.py topics
```

לרענון המטמון: `rm -rf scripts/.cache`.

---

## 2. Dicta Nakdan — ניקוד וניתוח מורפולוגי

עמותת דיקטה, המרכז הישראלי לניתוח טקסטים. חינמי וקוד פתוח.

**נקודת קצה:** `POST https://nakdan-2-0.loadbalancer.dicta.org.il/api`

```bash
curl -s -X POST "https://nakdan-2-0.loadbalancer.dicta.org.il/api" \
  -H "Content-Type: application/json" \
  -d '{"task":"nakdan","data":"הנחש שרף את העם","genre":"modern","addmorph":true}'
```

`genre`: `modern` · `rabbinic` · `poetic` (למקרא ולפיוט).

התשובה: מערך אסימונים, לכל אחד `word` ורשימת `options` מדורגת — הראשונה היא
ההצעה המובילה. הסימן `|` מפריד תחילית מגוף המילה (`הַ|נָּחָשׁ`).

```bash
python scripts/heb_api.py nikud "הנחש שרף את העם במדבר"
```

שימוש עיקרי: לוודא ניקוד של ציטוט שהוקלד ידנית, ולראות חלופות מורפולוגיות
כשיש ספק בגזרה או במשקל.

---

## 3. Sefaria — נוסח מקראי ותלמודי מדויק

רלוונטי לכתיבה במדעי היהדות ובחקר המקרא. ראו גם `references/domain-tanach.md`.

**נקודת קצה:** `GET https://www.sefaria.org/api/v3/texts/<ref>`

```bash
curl -s "https://www.sefaria.org/api/v3/texts/Numbers%2021:9"
```

מחזיר את נוסח **Miqra according to the Masorah** — מהדורה דיגיטלית המבוססת
על כתר ארם צובה, עם ניקוד וטעמים מלאים. זהו הנוסח שיש לצטט בעבודה אקדמית.

```bash
python scripts/heb_api.py verse "Numbers 21:9"
python scripts/heb_api.py verse "Malachi 3:23-24"
```

הפניות בשמות אנגליים (`Genesis`, `Numbers`, `II Samuel`, `Malachi`) או
בעברית מקודדת. נקודות קצה נוספות: `/api/related/<ref>` למפרשים ולמקבילות,
`/api/search-wrapper` לחיפוש בקורפוס.

---

## מה נבדק ונפסל

- **LanguageTool** (`api.languagetool.org`) — 62 שפות, **עברית אינה ביניהן**.
- **hspell.ivrix.org.il** — הפרויקט קוד פתוח אך אין שירות רשת פעיל;
  שימוש דורש התקנה מקומית.
- **מונחי האקדמיה / מאגרים** — אין REST API ציבורי מתועד.
- **חיפוש טקסט חופשי בהחלטות האקדמיה** — הפרמטר קיים אך אינו מחזיר תוצאות
  על `hahlata`; ראי העקיפה למעלה.

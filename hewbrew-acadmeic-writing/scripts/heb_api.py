#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
heb_api.py - כלי עזר לכתיבה אקדמית בעברית תקנית.

כל השירותים כאן חינמיים לחלוטין ואינם דורשים מפתח API או הרשמה.

  rules <מילות חיפוש>   חיפוש בהחלטות האקדמיה ללשון העברית (403 החלטות רשמיות)
  topics                 רשימת פרקי ההחלטות (קמץ, משקלים, שימושי לשון, פיסוק...)
  nikud "<טקסט>"        ניקוד אוטומטי + ניתוח מורפולוגי (Dicta Nakdan)
  verse <הפניה>          נוסח מדויק של פסוק עם ניקוד וטעמים (Sefaria, כתר ארם צובה)
  lint <קובץ|->          בדיקת לשון מקומית: שגיאות תקן וסגנון
  idioms <קובץ|->        איתור ניבים: שיבושי צורה + בדיקת התאמה להקשר
  idiom "<ביטוי>"       שליפת ערך מן המאגר: צורה תקינה, משמעות והקשר

דוגמאות:
  python heb_api.py rules פיסוק
  python heb_api.py nikud "הנחש שרף את העם"
  python heb_api.py verse "Numbers 21:9"
  python heb_api.py lint draft.txt
  python heb_api.py idioms draft.txt
  python heb_api.py idiom "קרם עור"
"""

import io
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

# פלט עברי תקין גם בקונסולה שאינה UTF-8 (ברירת המחדל בחלונות)
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".cache")

ACADEMY = "https://hebrew-academy.org.il/wp-json/wp/v2"
DICTA_NAKDAN = "https://nakdan-2-0.loadbalancer.dicta.org.il/api"
SEFARIA = "https://www.sefaria.org/api"


def _get(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA,
                                               "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def _post(url, payload, timeout=45):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={
        "User-Agent": UA,
        "Content-Type": "application/json",
        "Accept": "application/json",
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def _cached(name, builder):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name)
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    data = builder()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    return data


# ---------------------------------------------------------------- האקדמיה ללשון

def _fetch_topics():
    out, page = {}, 1
    while True:
        batch = _get("%s/topic?per_page=100&page=%d&_fields=id,name" % (ACADEMY, page))
        if not batch:
            break
        for t in batch:
            out[str(t["id"])] = t["name"]
        if len(batch) < 100:
            break
        page += 1
    return out


def _fetch_decisions():
    out, page = [], 1
    while True:
        batch = _get("%s/hahlata?per_page=100&page=%d&_fields=id,title,link,topic"
                     % (ACADEMY, page))
        if not batch:
            break
        out.extend({"id": d["id"],
                    "title": re.sub(r"<[^>]+>", "", d["title"]["rendered"]),
                    "link": d["link"],
                    "topic": d.get("topic") or []} for d in batch)
        if len(batch) < 100:
            break
        page += 1
    return out


def _strip_nikud(s):
    # מסיר ניקוד וטעמים אך משאיר מקף ופסק (05BE, 05C0, 05C3)
    keep = {0x05BE, 0x05C0, 0x05C3, 0x05C6}
    return "".join(c for c in s if not (0x0591 <= ord(c) <= 0x05C7) or ord(c) in keep)


def cmd_topics():
    topics = _cached("topics.json", _fetch_topics)
    for tid, name in sorted(topics.items(), key=lambda kv: kv[1]):
        print("%-8s %s" % (tid, name))


def cmd_rules(terms):
    if not terms:
        sys.exit("שימוש: rules <מילות חיפוש>")
    topics = _cached("topics.json", _fetch_topics)
    decisions = _cached("decisions.json", _fetch_decisions)
    needles = [_strip_nikud(t) for t in terms]
    hits = []
    for d in decisions:
        hay = _strip_nikud(d["title"]) + " " + " ".join(
            topics.get(str(t), "") for t in d["topic"])
        if all(n in hay for n in needles):
            hits.append(d)
    if not hits:
        print("לא נמצאו החלטות התואמות: %s" % " ".join(terms))
        print("כדאי לנסות מונח רחב יותר, או להריץ `topics` כדי לראות את שמות הפרקים.")
        return
    print("נמצאו %d החלטות מתוך %d:\n" % (len(hits), len(decisions)))
    for d in hits:
        chapters = ", ".join(topics.get(str(t), "") for t in d["topic"])
        print("• %s" % d["title"])
        if chapters:
            print("  פרק: %s" % chapters)
        print("  %s\n" % d["link"])


# ------------------------------------------------------------------ Dicta ניקוד

MORPH_POS = ["", "שם עצם", "פועל", "שם תואר", "מספר", "כינוי", "מילית",
             "תואר הפועל", "שם פרטי", "ראשי תיבות", "אחר"]


def cmd_nikud(text, genre="modern"):
    payload = {"task": "nakdan", "data": text, "genre": genre,
               "addmorph": True, "keepmetagim": True, "keepqq": False,
               "nodagesh": False, "patachma": False, "matchpartial": True}
    res = _post(DICTA_NAKDAN, payload)
    vocalized, details = [], []
    for tok in res:
        word = tok.get("word", "")
        if tok.get("sep") or not tok.get("options"):
            vocalized.append(word)
            continue
        opt = tok["options"][0]
        best = opt[0] if isinstance(opt, list) else opt
        vocalized.append(best.replace("|", ""))
        alts = [o[0] if isinstance(o, list) else o for o in tok["options"][1:4]]
        if alts:
            details.append("%s → %s   (חלופות: %s)" % (word, best, ", ".join(alts)))
        else:
            details.append("%s → %s" % (word, best))
    print("".join(vocalized))
    if details:
        print("\n--- פירוט ---")
        for d in details:
            print(d)


# ------------------------------------------------------------------ Sefaria פסוק

def cmd_verse(ref):
    url = "%s/v3/texts/%s" % (SEFARIA, urllib.parse.quote(ref))
    data = _get(url)
    versions = data.get("versions") or []
    if not versions:
        sys.exit("לא נמצא נוסח עבור ההפניה: %s" % ref)
    heb = next((v for v in versions if v.get("language") == "he"), versions[0])
    text = heb.get("text")
    if isinstance(text, list):
        text = " ".join(x for x in text if isinstance(x, str))
    text = re.sub(r"<[^>]+>", "", text or "")
    print("הפניה: %s" % data.get("ref", ref))
    print("מהדורה: %s" % heb.get("versionTitle", "—"))
    print()
    print(text)
    print()
    print("ללא ניקוד: %s" % _strip_nikud(text))


# ---------------------------------------------------------------- בדיקת לשון מקומית

# (תבנית, הסבר) - שגיאות התקן והסגנון השכיחות בכתיבה אקדמית בעברית
LINT_RULES = [
    (r"\bבכדי\b",
     "\"בכדי\" בהוראת 'כדי' פסולה בלשון תקנית. יש לכתוב \"כדי\"."),
    (r"מאחר\s+ו",
     "\"מאחר ו-\" שגוי. הצורה התקנית: \"מאחר ש-\"."),
    (r"היות\s+ו",
     "\"היות ו-\" שגוי. הצורה התקנית: \"היות ש-\" או \"מאחר ש-\"."),
    (r"מכיוון\s+ו",
     "\"מכיוון ו-\" שגוי. הצורה התקנית: \"מכיוון ש-\"."),
    (r"למרות\s+ש",
     "\"למרות ש-\" חורג מן התקן. עדיף \"אף על פי ש-\" או \"על אף ש-\"."),
    (r"בגלל\s+ש",
     "\"בגלל ש-\" חורג מן התקן. עדיף \"משום ש-\" או \"מפני ש-\"."),
    (r"במידה\s+ו",
     "\"במידה ו-\" שגוי. יש לכתוב \"אם\"."),
    (r"(?<![א-ת])[שוהכבלמ]?יתכן(?![א-ת])",
     "כתיב מלא: \"ייתכן\" (ביו\"ד כפולה)."),
    (r"אפשרי\s+ש",
     "\"אפשרי ש-\" - עדיף \"אפשר ש-\" או \"ייתכן ש-\"."),
    (r"יכול להיות\s+ש",
     "\"יכול להיות ש-\" - בלשון אקדמית עדיף \"ייתכן ש-\" או \"אפשר ש-\"."),
    (r"(?<![א-ת])(אנו|אנחנו|נציג|נבחן|ננתח|נדון|נתמקד|נערוך|נסקור|נטען|"
     r"סבורים|סבורות|מסיקים|מסיקות|לדעתנו|לטעמנו|בעבודתנו)(?![א-ת])",
     "גוף ראשון רבים. בעבודה יחידנית זו שגיאת רישום - יש לעבור לגוף ראשון "
     "יחיד (\"אבחן\", \"אעסוק\") או לניסוח סתמי (\"ניתן לראות\")."),
    (r"\s+;",
     "רווח לפני נקודה-פסיק. סימן הפיסוק נצמד למילה שלפניו."),
    (r"\s+[,.:]",
     "רווח לפני פסיק/נקודה/נקודתיים. סימן הפיסוק נצמד למילה שלפניו."),
    (r"[א-ת]{2,}\s{2,}[א-ת]",
     "רווח כפול."),
    (r"(?<![א-ת])([א-ת]{2,})\s+\1(?![א-ת])",
     "מילה כפולה."),
    (r"(?<![א-ת])ש\s+[א-ת]",
     "אות שעבוד מנותקת מן המילה שאחריה - יש לחבר (\"שהמחבר\", \"שלמרות\")."),
    (r"\bעף על פי\b",
     "שגיאת הקלדה: \"עף על פי\" ← \"אף על פי\"."),
    (r"\bמודע\s+(יש|הוא|היא|זה|אין)\b",
     "שגיאת הקלדה: \"מודע\" ← \"מדוע\"."),
    (r'ע"פ|ע"י|בע"ח',
     "ראשי תיבות בגוף הטקסט. בכתיבה אקדמית יש לכתוב במלואן "
     "(\"על פי\", \"על ידי\"); ראשי תיבות מותרות בהערות ובהפניות."),
    (r"חשוב לציין\s+ש|אין ספק\s+ש|(?<![א-ת])כידוע(?![א-ת])|למרבה הפלא",
     "ניסוח הטפתי או מילת מילוי. יש להסיר או להחליף בטענה עצמה."),
    (r"נעש(ה|תה|ו)\s+\S+\s+על ידי",
     "סביל מנופח. עדיף פועל אקטיבי (\"החוקר בדק\" במקום \"נעשתה בדיקה על ידי\")."),
    (r"(?<![א-ת])[וש]?באם(?![א-ת])",
     "\"באם\" אינו תקין. יש לכתוב \"אם\"."),
    (r"(?<![א-ת])[ושהו]{0,2}בעקב(?![א-ת])",
     "\"בעקב\" אינו תקין. יש לכתוב \"עקב\" או \"בעקבות\"."),
    (r"(?<![א-ת])[וש]?ברת(?![א-ת])",
     "\"ברת\" אינה תקינה בעברית. יש לכתוב \"בת\"."),
    (r"במקרה\s+ו",
     "\"במקרה ו-\" שגוי. הצורה התקנית: \"במקרה ש-\"."),
    (r"(?<![א-ת])(מתי|היכן|איפה|לאן)\s+ש",
     "מילת שאלה אינה מקבלת \"ש-\" (למעט \"מי\" ו\"מה\"). "
     "\"מתי ש-\" ← \"בזמן ש-\"; \"היכן ש-\" ← \"במקום ש-\"."),
    (r"(?<![א-ת])אפילו\s+אם(?![א-ת])",
     "\"אפילו אם\" כפילות - \"אפילו\" = \"אף אילו\". יש לכתוב \"אפילו\" או \"אף אם\"."),
    (r"(?<![א-ת])[וש]?(יש|אין)\s+(לי|לו|לה|לנו|לכם|להם|להן|לך)\s+את(?![א-ת])",
     "אחרי \"יש\" ו\"אין\" לא תבוא מילת היחס \"את\"."),
    (r"(?<![א-ת])אחד\s+(עם|את|ל|מ)?\s*ה?שני(?![א-ת])",
     "\"אחד\" מספר מונה ו\"השני\" מספר סודר - אין לצרפם. "
     "יש לכתוב \"זה עם זה\", \"זה את זה\" או \"זה לצד זה\"."),
    (r"(?<![א-ת])מבינ(יהם|יהן|ם|ן|נו)(?![א-ת])",
     "\"מביניהם\" - יש לכתוב \"ביניהם\"."),
    (r"[א-ת]\s+(כלומר|דהיינו|קרי|היינו|למשל)\s*,",
     "הפסיק בא לפני קשר הביאור ולא אחריו: \"…טיפשים, כלומר רק עשרים…\"."),
    # רק מיליות שפותחות פסוקית זיקה. מ- ואל- הושמטו: הן משלימות פועל קודם
    # לעיתים קרובות מדי ומייצרות התרעות שווא.
    (r"(?<![א-ת])(בה|בו|בהם|בהן|עליו|עליה|עליהם|עליהן)\s+"
     r"(אני|אנו|אנחנו|הוא|היא|הם|הן|אתה|אתם)(?![א-ת])",
     "פסוקית לוואי או מושא נפתחת ב\"ש-\" גם לפני מילת יחס: "
     "\"המפלגה שבה אני תומכת\", לא \"המפלגה בה אני תומכת\"."),
    (r"(?<![א-ת])[ושהב]?(למרבה ה(צער|מזל|שמחה|פלא)|לרוע המזל|לצערנו|לשמחתנו|"
     r"לדאבוננו|לאסוננו|לתדהמת הכל)(?![א-ת])",
     "מקשר הסגר רגשי. בטקסט אקדמי אובייקטיבי יש להשמיטו ולהציג את העובדה בלבד."),
    (r"(?<![א-ת])[ו]?(מי ייתן|הלוואי ש|ולוואי ש|יהי רצון ש|למען השם)",
     "הבעת משאלה אינה נהוגה בכתיבה אקדמית."),
    (r"(?<![א-ת])[ושה]?(אין פלא ש|מה הפלא ש|ברור כשמש|אין צל של ספק|ללא ספק|"
     r"מובן מאליו|לכל הדעות)",
     "הצהרה על ודאות במקום הצגת הראיה. יש להחליף בטענה עצמה ובמקורה."),
]

def cmd_lint(path):
    text = sys.stdin.read() if path == "-" else open(path, encoding="utf-8").read()
    lines = text.splitlines()
    found = 0
    for pattern, msg in LINT_RULES:
        rx = re.compile(pattern)
        for i, line in enumerate(lines, 1):
            for m in rx.finditer(line):
                start = max(0, m.start() - 35)
                ctx = line[start:m.end() + 35].strip()
                print("שורה %d: %s" % (i, msg))
                print("   …%s…\n" % ctx)
                found += 1
    print("סה\"כ %d הערות." % found if found else "לא נמצאו שגיאות מן הרשימה.")


# ---------------------------------------------------------- מאגר ניבים וביטויים

IDIOMS_TSV = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                          "references", "idioms.tsv")


def _load_idioms():
    rows = []
    with io.open(IDIOMS_TSV, encoding="utf-8") as f:
        header = f.readline().rstrip("\n").split("\t")
        for line in f:
            line = line.rstrip("\n")
            if not line.strip():
                continue
            rows.append(dict(zip(header, line.split("\t"))))
    return rows


_FINALS = {"ך": "כ", "ם": "מ", "ן": "נ",
           "ף": "פ", "ץ": "צ"}


def _norm(s):
    """נרמול להשוואה: הסרת ניקוד ופיסוק, איחוד אותיות סופיות."""
    s = _strip_nikud(s)
    s = re.sub(r"[\"'`,.;:!?()\[\]{}־–—-]", " ", s)
    s = "".join(_FINALS.get(c, c) for c in s)
    return re.sub(r"\s+", " ", s).strip()


# מילים שאין לספור בהתאמה מטושטשת
_STOP = set("של את על אל מן עם כי כך זה זו הוא היא אם או ו ה ב ל כ מ ש לא אין יש".split())

# תחיליות ותוספות נטייה נפוצות, לצורך התאמה גמישה
_PREF = "[ובכלמשה]{0,2}"
_SUFF = "(?:ים|ות|תי|תה|נו|תם|תן|ה|ת|ו|י|ן|ם)?"


def _flex_word(w, flexible):
    """מילה בודדת. flexible - מותרות תחילית וסיומת נטייה."""
    if not flexible or len(w) < 3:
        return re.escape(w)
    return _PREF + re.escape(w) + _SUFF


def _phrase_rx(phrase):
    """תבנית לצירוף שלם.
    צירוף בן מילה אחת נדרש להתאמה מדויקת, כדי שלא ייתפס בתוך מילה ארוכה יותר.
    מילית יחס בת אות אחת בסוף הצירוף ("עשה שימוש ב-") נדרשת כתחילית
    של המילה הבאה, ולא כמילה נפרדת."""
    words = _norm(phrase).split()
    if not words:
        return None
    tail = ""
    if len(words) > 1 and len(words[-1]) == 1:
        tail = r"\s+" + re.escape(words.pop()) + r"[א-ת]"
    if not words:
        return None
    flexible = len(words) > 1 or bool(tail)
    body = r"\s+".join(_flex_word(w, flexible) for w in words)
    if tail:
        return re.compile(r"(?<![א-ת])" + body + tail)
    return re.compile(r"(?<![א-ת])" + body + r"(?![א-ת])")


_RX_CACHE = {}


def _match(phrase, nsent):
    rx = _RX_CACHE.get(phrase)
    if rx is None:
        rx = _RX_CACHE[phrase] = _phrase_rx(phrase)
    return bool(rx and rx.search(nsent))


def _content_words(phrase):
    return [w for w in _norm(phrase).split() if w not in _STOP and len(w) > 1]


def _sentences(text):
    parts = re.split(r"(?<=[.!?])\s+|\n+", text)
    return [p.strip() for p in parts if p.strip()]


def cmd_idioms(path, fuzzy_ratio=0.7):
    text = sys.stdin.read() if path == "-" else io.open(path, encoding="utf-8").read()
    db = _load_idioms()
    sents = _sentences(text)
    errors, checks, suspects = [], [], []

    for si, sent in enumerate(sents, 1):
        nsent = _norm(sent)
        nwords = set(nsent.split())
        for e in db:
            bad_hit = None
            for bad in [w.strip() for w in e["wrong"].split(";") if w.strip()]:
                if _match(bad, nsent):
                    bad_hit = bad
                    break
            if bad_hit:
                errors.append((si, sent, bad_hit, e))
                continue

            good_hit = None
            for good in [g.strip() for g in e["correct"].split(";") if g.strip()]:
                # ערך חד-מילי נבדק להקשר רק אם סומן כערך הקשר
                if len(_norm(good).split()) < 2 and e["type"] != "הקשר":
                    continue
                if _match(good, nsent):
                    good_hit = good
                    break
            if good_hit:
                checks.append((si, sent, good_hit, e))
                continue

            cw = _content_words(e["correct"].split(";")[0])
            if len(cw) >= 3:
                overlap = sum(1 for w in cw
                              if any(t == w or (len(w) >= 4 and t.startswith(w))
                                     for t in nwords))
                if len(cw) > overlap >= fuzzy_ratio * len(cw):
                    suspects.append((si, sent, overlap, len(cw), e))

    def block(title):
        print("\n" + "=" * 62)
        print(title)
        print("=" * 62)

    if errors:
        block("שגיאות ודאיות - צורת הביטוי משובשת")
        for si, sent, bad, e in errors:
            print("\nמשפט %d: %s" % (si, sent[:150]))
            print("  שגוי:   %s" % bad)
            print("  תקין:   %s" % e["correct"].replace(";", " / "))
            print("  משמעות: %s" % e["meaning"])

    if suspects:
        block("חשד לשיבוש - צורה קרובה אך לא זהה")
        for si, sent, ov, tot, e in suspects:
            print("\nמשפט %d: %s" % (si, sent[:150]))
            print("  ייתכן שהכוונה ל: %s  (%d מתוך %d מילות תוכן)"
                  % (e["correct"].replace(";", " / "), ov, tot))
            print("  משמעות: %s" % e["meaning"])

    if checks:
        block("בדיקת הקשר - הצורה תקינה, יש לאמת שהיא מתאימה למשפט")
        for si, sent, hit, e in checks:
            print("\nמשפט %d: %s" % (si, sent[:180]))
            print("  ביטוי:  %s" % hit)
            print("  משמעות: %s" % e["meaning"])
            print("  מתי מתאים: %s" % e["context"])
            print("  דוגמה תקינה: %s" % e["example"])

    print("\n" + "-" * 62)
    print("סיכום: %d שגיאות ודאיות · %d חשדות · %d פריטים לבדיקת הקשר · מתוך %d ערכים."
          % (len(errors), len(suspects), len(checks), len(db)))
    if checks or suspects:
        print("יש להכריע על כל פריט אם ההקשר מצדיק אותו. ראו references/idioms.md.")


def cmd_idiom_lookup(term):
    db = _load_idioms()
    n = _norm(term)
    hits = [e for e in db
            if n in _norm(e["correct"]) or n in _norm(e["wrong"])
            or n in _norm(e["meaning"])]
    if not hits:
        print("לא נמצא ערך התואם: %s" % term)
        return
    for e in hits:
        print("\n%s  [%s]" % (e["correct"], e["type"]))
        if e["wrong"]:
            print("  שיבושים נפוצים: %s" % e["wrong"].replace(";", " · "))
        print("  משמעות: %s" % e["meaning"])
        print("  מתי מתאים: %s" % e["context"])
        print("  דוגמה: %s" % e["example"])
        print("  מקור: %s" % e["source"])
    print("\nסה\"כ %d ערכים." % len(hits))


# ------------------------------------------------------------------------- main

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    cmd, args = sys.argv[1], sys.argv[2:]
    try:
        if cmd == "rules":
            cmd_rules(args)
        elif cmd == "topics":
            cmd_topics()
        elif cmd == "nikud":
            if not args:
                sys.exit('שימוש: nikud "<טקסט>"')
            cmd_nikud(" ".join(args))
        elif cmd == "verse":
            if not args:
                sys.exit('שימוש: verse "Numbers 21:9"')
            cmd_verse(" ".join(args))
        elif cmd == "lint":
            if not args:
                sys.exit("שימוש: lint <קובץ|->")
            cmd_lint(args[0])
        elif cmd == "idioms":
            if not args:
                sys.exit("שימוש: idioms <קובץ|->")
            cmd_idioms(args[0])
        elif cmd == "idiom":
            if not args:
                sys.exit('שימוש: idiom "<ביטוי או מילה>"')
            cmd_idiom_lookup(" ".join(args))
        else:
            print(__doc__)
    except urllib.error.HTTPError as e:
        sys.exit("שגיאת HTTP %s מן השירות: %s" % (e.code, e.reason))
    except urllib.error.URLError as e:
        sys.exit("אין חיבור לשירות: %s" % e.reason)


if __name__ == "__main__":
    main()

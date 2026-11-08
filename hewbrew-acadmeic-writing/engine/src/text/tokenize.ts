/**
 * טוקנייזר מודע לעברית.
 *
 * שומר היסטים מוחלטים לכל טוקן כדי שכל ממצא יוכל להצביע על המקום המדויק
 * בטקסט המקורי. פיצול המשפטים יודע להתעלם מנקודה שהיא חלק מקיצור
 * (עמ׳, ד״ר, ת.ד.) ולא לשבור שם משפט.
 */

import { HEBREW_LETTER_RE, NIQQUD_RE, GERESH, GERSHAYIM, MAQAF } from './chars.js';

export type TokenKind =
  | 'hebrew'
  | 'latin'
  | 'number'
  | 'punctuation'
  | 'whitespace'
  | 'newline'
  | 'other';

export interface Token {
  kind: TokenKind;
  /** הטקסט כפי שהוא, כולל ניקוד אם היה */
  raw: string;
  /** הטקסט בלי ניקוד — לרוב זה מה שכללים משווים מולו */
  text: string;
  start: number;
  end: number;
  /** אינדקס הטוקן במערך הטוקנים של המסמך */
  index: number;
  /** אינדקס המשפט שאליו הטוקן שייך */
  sentence: number;
}

export interface Sentence {
  start: number;
  end: number;
  text: string;
  /** אינדקסים במערך הטוקנים: [firstToken, lastToken] כולל */
  tokenRange: [number, number];
  index: number;
}

export interface Document {
  text: string;
  tokens: Token[];
  sentences: Sentence[];
  /** רק טוקנים של מילים (עברית/לטינית/מספר), לנוחות כללים תחביריים */
  words: Token[];
}

/**
 * קיצורים שנקודה בסופם אינה סוף משפט.
 * נשמרים בלי סימני הגרש והנקודה.
 */
const ABBREVIATIONS = new Set([
  'עמ', 'עמו', 'רח', 'דר', 'פרופ', 'גב', 'מר',
  'וכו', 'וכד', 'וגו', 'הנל', 'זל', 'שליטא',
  'אחכ', 'בעמ', 'צהל', 'חכ', 'עוד', 'רוח', 'סמ', 'קמ', 'מר',
  'שח', 'לפנהס', 'לסהנ',
]);

const PUNCTUATION_CHARS = new Set([
  '.', ',', ';', ':', '!', '?', '(', ')', '[', ']', '{', '}',
  '"', "'", '“', '”', '„', '‘', '’', '‚',
  '-', '–', '—', MAQAF, '…', '/', '\\', '|', '&', '*',
  GERESH, GERSHAYIM, '׃', '«', '»', '‹', '›',
]);

const SENTENCE_ENDERS = new Set(['.', '!', '?', '…', '׃']);

const APOSTROPHE = "'";
const QUOTE = '"';

function isHebrewChar(ch: string): boolean {
  return HEBREW_LETTER_RE.test(ch) || NIQQUD_RE.test(ch);
}

function isLatinChar(ch: string): boolean {
  return /[A-Za-z]/.test(ch);
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

/**
 * חותך את הטקסט לטוקנים. מילה עברית עשויה להכיל גרש או גרשיים באמצע
 * (צה״ל, ג׳ירפה) ולכן הם נבלעים לתוך הטוקן במקום לשבור אותו.
 */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const niqqudGlobal = new RegExp(NIQQUD_RE.source, 'g');
  let i = 0;

  const push = (kind: TokenKind, start: number, end: number) => {
    const raw = text.slice(start, end);
    tokens.push({
      kind,
      raw,
      text: raw.replace(niqqudGlobal, ''),
      start,
      end,
      index: tokens.length,
      sentence: 0,
    });
  };

  while (i < text.length) {
    const ch = text[i];

    if (ch === '\n' || ch === '\r') {
      const start = i;
      while (i < text.length && (text[i] === '\n' || text[i] === '\r')) i++;
      push('newline', start, i);
      continue;
    }

    if (/\s/.test(ch)) {
      const start = i;
      while (i < text.length && /\s/.test(text[i]) && text[i] !== '\n' && text[i] !== '\r') i++;
      push('whitespace', start, i);
      continue;
    }

    if (isHebrewChar(ch)) {
      const start = i;
      while (i < text.length) {
        const c = text[i];
        if (isHebrewChar(c)) {
          i++;
          continue;
        }
        const isInnerMark =
          c === GERESH || c === GERSHAYIM || c === APOSTROPHE || c === QUOTE || c === MAQAF;
        // גרש/גרשיים/מקף נבלעים רק אם אחריהם ממשיכה מילה עברית — צה״ל, ג׳ירפה, בין־לאומי
        if (isInnerMark && i + 1 < text.length && isHebrewChar(text[i + 1])) {
          i++;
          continue;
        }
        // גרש בסוף קיצור: עמ׳
        if ((c === GERESH || c === APOSTROPHE) && i > start) {
          i++;
          break;
        }
        break;
      }
      push('hebrew', start, i);
      continue;
    }

    if (isLatinChar(ch)) {
      const start = i;
      while (i < text.length && (isLatinChar(text[i]) || text[i] === APOSTROPHE || text[i] === '-')) i++;
      push('latin', start, i);
      continue;
    }

    if (isDigit(ch)) {
      const start = i;
      while (i < text.length) {
        const c = text[i];
        if (isDigit(c)) {
          i++;
          continue;
        }
        // נקודה או פסיק נבלעים רק בין ספרות: 1,000 או 3.14
        if ((c === ',' || c === '.') && isDigit(text[i + 1] ?? '')) {
          i++;
          continue;
        }
        break;
      }
      push('number', start, i);
      continue;
    }

    if (PUNCTUATION_CHARS.has(ch)) {
      push('punctuation', i, i + 1);
      i++;
      continue;
    }

    push('other', i, i + 1);
    i++;
  }

  return tokens;
}

/** האם הנקודה בטוקן הזה היא חלק מקיצור ולא סוף משפט */
function isAbbreviation(tokens: Token[], punctIndex: number): boolean {
  const prev = tokens[punctIndex - 1];
  if (!prev || (prev.kind !== 'hebrew' && prev.kind !== 'latin')) return false;
  const bare = prev.text.replace(/[.'"׳״]/g, '');
  if (ABBREVIATIONS.has(bare)) return true;
  // ראשי תיבות מנוקדות: אות בודדת ואחריה נקודה, כמו ת.ד.
  if (prev.kind === 'hebrew' && bare.length === 1) return true;
  return false;
}

export function splitSentences(text: string, tokens: Token[]): Sentence[] {
  const sentences: Sentence[] = [];
  let sentenceStartToken = 0;

  const isFiller = (t: Token) => t.kind === 'whitespace' || t.kind === 'newline';

  const flush = (lastToken: number) => {
    if (lastToken < sentenceStartToken) return;
    const slice = tokens.slice(sentenceStartToken, lastToken + 1);
    const first = slice.find((t) => !isFiller(t));
    if (!first) {
      sentenceStartToken = lastToken + 1;
      return;
    }
    let lastIdx = slice.length - 1;
    while (lastIdx > 0 && isFiller(slice[lastIdx])) lastIdx--;
    const last = slice[lastIdx];
    const index = sentences.length;
    for (let t = sentenceStartToken; t <= lastToken; t++) tokens[t].sentence = index;
    sentences.push({
      start: first.start,
      end: last.end,
      text: text.slice(first.start, last.end),
      tokenRange: [sentenceStartToken, lastToken],
      index,
    });
    sentenceStartToken = lastToken + 1;
  };

  const CLOSERS = [')', ']', QUOTE, '”', '’'];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.kind === 'punctuation' && SENTENCE_ENDERS.has(tok.text)) {
      if (tok.text === '.' && isAbbreviation(tokens, i)) continue;
      // בולעים סימני סיום רצופים ומירכאות או סוגריים סוגרים
      let j = i;
      while (j + 1 < tokens.length) {
        const nxt = tokens[j + 1];
        if (nxt.kind !== 'punctuation') break;
        if (!SENTENCE_ENDERS.has(nxt.text) && !CLOSERS.includes(nxt.text)) break;
        j++;
      }
      flush(j);
      i = j;
      continue;
    }
    // שורה ריקה מסיימת פסקה, ולכן גם משפט
    if (tok.kind === 'newline' && tok.raw.replace(/\r/g, '').length >= 2) {
      flush(i);
    }
  }
  flush(tokens.length - 1);

  return sentences;
}

export function parseDocument(text: string): Document {
  const tokens = tokenize(text);
  const sentences = splitSentences(text, tokens);
  const words = tokens.filter(
    (t) => t.kind === 'hebrew' || t.kind === 'latin' || t.kind === 'number',
  );
  return { text, tokens, sentences, words };
}

/** הטוקן המילולי הקודם. עוצר אם בדרך יש סימן פיסוק. */
export function prevWord(doc: Document, token: Token): Token | undefined {
  for (let i = token.index - 1; i >= 0; i--) {
    const t = doc.tokens[i];
    if (t.kind === 'whitespace') continue;
    if (t.kind === 'hebrew' || t.kind === 'latin' || t.kind === 'number') return t;
    return undefined;
  }
  return undefined;
}

/** הטוקן המילולי הבא. עוצר אם בדרך יש סימן פיסוק. */
export function nextWord(doc: Document, token: Token): Token | undefined {
  for (let i = token.index + 1; i < doc.tokens.length; i++) {
    const t = doc.tokens[i];
    if (t.kind === 'whitespace') continue;
    if (t.kind === 'hebrew' || t.kind === 'latin' || t.kind === 'number') return t;
    return undefined;
  }
  return undefined;
}

/** כל טוקני המילים במשפט נתון */
export function sentenceWords(doc: Document, sentence: Sentence): Token[] {
  const [from, to] = sentence.tokenRange;
  const out: Token[] = [];
  for (let i = from; i <= to && i < doc.tokens.length; i++) {
    const t = doc.tokens[i];
    if (t.kind === 'hebrew' || t.kind === 'latin' || t.kind === 'number') out.push(t);
  }
  return out;
}

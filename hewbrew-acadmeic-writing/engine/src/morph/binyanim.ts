/**
 * נטיית הפועל בשבעת הבניינים.
 *
 * לכל בניין תבנית לגזרת השלמים, ולגזרות הנפוצות טבלת דריסות.
 * גזרה שאין לה דריסה נגזרת מתבנית השלמים ומסומנת accuracy: 'approx' —
 * עדיף לומר ״טעון בדיקה״ מאשר להחזיר ניקוד שגוי בלי לציין זאת.
 */

import { build, expand, render, finalizeLetters, type Segment } from './template.js';
import { detectGizra, isDoublyWeak, normalizeRoot, type Gizra } from './roots.js';

export type Binyan = 'פעל' | 'נפעל' | 'פיעל' | 'פועל' | 'הפעיל' | 'הופעל' | 'התפעל';

export const BINYANIM: Binyan[] = ['פעל', 'נפעל', 'פיעל', 'פועל', 'הפעיל', 'הופעל', 'התפעל'];

export type PersonKey =
  | 'p1s' | 'p2ms' | 'p2fs' | 'p3ms' | 'p3fs'
  | 'p1p' | 'p2mp' | 'p2fp' | 'p3mp' | 'p3fp';

export type PresentKey = 'ms' | 'fs' | 'mp' | 'fp';
export type ImperativeKey = 'ms' | 'fs' | 'mp';

export const PERSON_LABELS: Record<PersonKey, string> = {
  p1s: 'אני',
  p2ms: 'אתה',
  p2fs: 'את',
  p3ms: 'הוא',
  p3fs: 'היא',
  p1p: 'אנחנו',
  p2mp: 'אתם',
  p2fp: 'אתן',
  p3mp: 'הם',
  p3fp: 'הן',
};

export const PRESENT_LABELS: Record<PresentKey, string> = {
  ms: 'יחיד',
  fs: 'יחידה',
  mp: 'רבים',
  fp: 'רבות',
};

export const IMPERATIVE_LABELS: Record<ImperativeKey, string> = {
  ms: 'אתה',
  fs: 'את',
  mp: 'אתם/אתן',
};

interface BinyanTemplates {
  past: Partial<Record<PersonKey, string>>;
  present: Partial<Record<PresentKey, string>>;
  future: Partial<Record<PersonKey, string>>;
  imperative?: Partial<Record<ImperativeKey, string>>;
  infinitive?: string;
  /** בינוני פעול — קיים בבניין קל בלבד */
  passiveParticiple?: string;
  /** שם הפעולה */
  gerund?: string;
}

// ── שלמים ────────────────────────────────────────────────────────────────────

const STRONG: Record<Binyan, BinyanTemplates> = {
  פעל: {
    past: {
      p1s: '1ָ2ַ3ְתִּי', p2ms: '1ָ2ַ3ְתָּ', p2fs: '1ָ2ַ3ְתְּ',
      p3ms: '1ָ2ַ3', p3fs: '1ָ2ְ3ָה',
      p1p: '1ָ2ַ3ְנוּ', p2mp: '1ְ2ַ3ְתֶּם', p2fp: '1ְ2ַ3ְתֶּן',
      p3mp: '1ָ2ְ3וּ', p3fp: '1ָ2ְ3וּ',
    },
    present: { ms: '1וֹ2ֵ3', fs: '1וֹ2ֶ3ֶת', mp: '1וֹ2ְ3ִים', fp: '1וֹ2ְ3וֹת' },
    future: {
      p1s: 'אֶ1ְ2ֹ^3', p2ms: 'תִּ1ְ2ֹ^3', p2fs: 'תִּ1ְ2ְ3ִי',
      p3ms: 'יִ1ְ2ֹ^3', p3fs: 'תִּ1ְ2ֹ^3',
      p1p: 'נִ1ְ2ֹ^3', p2mp: 'תִּ1ְ2ְ3וּ', p2fp: 'תִּ1ְ2ְ3וּ',
      p3mp: 'יִ1ְ2ְ3וּ', p3fp: 'יִ1ְ2ְ3וּ',
    },
    imperative: { ms: '1ְ2ֹ^3', fs: '1ִ2ְ-3ִי', mp: '1ִ2ְ-3וּ' },
    infinitive: 'לִ1ְ2ֹ^3',
    passiveParticiple: '1ָ2וּ3',
    gerund: '1ְ2ִי3ָה',
  },

  נפעל: {
    past: {
      p1s: 'נִ1ְ2ַ3ְתִּי', p2ms: 'נִ1ְ2ַ3ְתָּ', p2fs: 'נִ1ְ2ַ3ְתְּ',
      p3ms: 'נִ1ְ2ַ3', p3fs: 'נִ1ְ2ְ3ָה',
      p1p: 'נִ1ְ2ַ3ְנוּ', p2mp: 'נִ1ְ2ַ3ְתֶּם', p2fp: 'נִ1ְ2ַ3ְתֶּן',
      p3mp: 'נִ1ְ2ְ3וּ', p3fp: 'נִ1ְ2ְ3וּ',
    },
    present: { ms: 'נִ1ְ2ָ3', fs: 'נִ1ְ2ֶ3ֶת', mp: 'נִ1ְ2ָ3ִים', fp: 'נִ1ְ2ָ3וֹת' },
    future: {
      p1s: 'אֶ*1ָ2ֵ3', p2ms: 'תִּ^*1ָ2ֵ3', p2fs: 'תִּ^*1ָ2ְ3ִי',
      p3ms: 'יִ^*1ָ2ֵ3', p3fs: 'תִּ^*1ָ2ֵ3',
      p1p: 'נִ^*1ָ2ֵ3', p2mp: 'תִּ^*1ָ2ְ3וּ', p2fp: 'תִּ^*1ָ2ְ3וּ',
      p3mp: 'יִ^*1ָ2ְ3וּ', p3fp: 'יִ^*1ָ2ְ3וּ',
    },
    imperative: { ms: 'הִ^*1ָ2ֵ3', fs: 'הִ^*1ָ2ְ3ִי', mp: 'הִ^*1ָ2ְ3וּ' },
    infinitive: 'לְהִ^*1ָ2ֵ3',
    gerund: 'הִ^*1ָ2ְ3וּת',
  },

  פיעל: {
    past: {
      p1s: '1ִ^*2ַ3ְתִּי', p2ms: '1ִ^*2ַ3ְתָּ', p2fs: '1ִ^*2ַ3ְתְּ',
      p3ms: '1ִ^*2ֵ3', p3fs: '1ִ^*2ְ3ָה',
      p1p: '1ִ^*2ַ3ְנוּ', p2mp: '1ִ^*2ַ3ְתֶּם', p2fp: '1ִ^*2ַ3ְתֶּן',
      p3mp: '1ִ^*2ְ3וּ', p3fp: '1ִ^*2ְ3וּ',
    },
    present: { ms: 'מְ1ַ*2ֵ3', fs: 'מְ1ַ*2ֶ3ֶת', mp: 'מְ1ַ*2ְ3ִים', fp: 'מְ1ַ*2ְ3וֹת' },
    future: {
      p1s: 'אֲ1ַ*2ֵ3', p2ms: 'תְּ1ַ*2ֵ3', p2fs: 'תְּ1ַ*2ְ3ִי',
      p3ms: 'יְ1ַ*2ֵ3', p3fs: 'תְּ1ַ*2ֵ3',
      p1p: 'נְ1ַ*2ֵ3', p2mp: 'תְּ1ַ*2ְ3וּ', p2fp: 'תְּ1ַ*2ְ3וּ',
      p3mp: 'יְ1ַ*2ְ3וּ', p3fp: 'יְ1ַ*2ְ3וּ',
    },
    imperative: { ms: '1ַ*2ֵ3', fs: '1ַ*2ְ3ִי', mp: '1ַ*2ְ3וּ' },
    infinitive: 'לְ1ַ*2ֵ3',
    gerund: '1ִ^*2וּ3',
  },

  פועל: {
    past: {
      p1s: '1ֻ^*2ַ3ְתִּי', p2ms: '1ֻ^*2ַ3ְתָּ', p2fs: '1ֻ^*2ַ3ְתְּ',
      p3ms: '1ֻ^*2ַ3', p3fs: '1ֻ^*2ְ3ָה',
      p1p: '1ֻ^*2ַ3ְנוּ', p2mp: '1ֻ^*2ַ3ְתֶּם', p2fp: '1ֻ^*2ַ3ְתֶּן',
      p3mp: '1ֻ^*2ְ3וּ', p3fp: '1ֻ^*2ְ3וּ',
    },
    present: { ms: 'מְ1ֻ^*2ָ3', fs: 'מְ1ֻ^*2ֶ3ֶת', mp: 'מְ1ֻ^*2ָ3ִים', fp: 'מְ1ֻ^*2ָ3וֹת' },
    future: {
      p1s: 'אֲ1ֻ^*2ַ3', p2ms: 'תְּ1ֻ^*2ַ3', p2fs: 'תְּ1ֻ^*2ְ3ִי',
      p3ms: 'יְ1ֻ^*2ַ3', p3fs: 'תְּ1ֻ^*2ַ3',
      p1p: 'נְ1ֻ^*2ַ3', p2mp: 'תְּ1ֻ^*2ְ3וּ', p2fp: 'תְּ1ֻ^*2ְ3וּ',
      p3mp: 'יְ1ֻ^*2ְ3וּ', p3fp: 'יְ1ֻ^*2ְ3וּ',
    },
  },

  הפעיל: {
    past: {
      p1s: 'הִ1ְ2ַ3ְתִּי', p2ms: 'הִ1ְ2ַ3ְתָּ', p2fs: 'הִ1ְ2ַ3ְתְּ',
      p3ms: 'הִ1ְ2ִי3', p3fs: 'הִ1ְ2ִי3ָה',
      p1p: 'הִ1ְ2ַ3ְנוּ', p2mp: 'הִ1ְ2ַ3ְתֶּם', p2fp: 'הִ1ְ2ַ3ְתֶּן',
      p3mp: 'הִ1ְ2ִי3וּ', p3fp: 'הִ1ְ2ִי3וּ',
    },
    present: { ms: 'מַ1ְ2ִי3', fs: 'מַ1ְ2ִי3ָה', mp: 'מַ1ְ2ִי3ִים', fp: 'מַ1ְ2ִי3וֹת' },
    future: {
      p1s: 'אַ1ְ2ִי3', p2ms: 'תַּ1ְ2ִי3', p2fs: 'תַּ1ְ2ִי3ִי',
      p3ms: 'יַ1ְ2ִי3', p3fs: 'תַּ1ְ2ִי3',
      p1p: 'נַ1ְ2ִי3', p2mp: 'תַּ1ְ2ִי3וּ', p2fp: 'תַּ1ְ2ִי3וּ',
      p3mp: 'יַ1ְ2ִי3וּ', p3fp: 'יַ1ְ2ִי3וּ',
    },
    imperative: { ms: 'הַ1ְ2ֵ3', fs: 'הַ1ְ2ִי3ִי', mp: 'הַ1ְ2ִי3וּ' },
    infinitive: 'לְהַ1ְ2ִי3',
    gerund: 'הַ1ְ2ָ3ָה',
  },

  הופעל: {
    past: {
      p1s: 'הֻ^1ְ2ַ3ְתִּי', p2ms: 'הֻ^1ְ2ַ3ְתָּ', p2fs: 'הֻ^1ְ2ַ3ְתְּ',
      p3ms: 'הֻ^1ְ2ַ3', p3fs: 'הֻ^1ְ2ְ3ָה',
      p1p: 'הֻ^1ְ2ַ3ְנוּ', p2mp: 'הֻ^1ְ2ַ3ְתֶּם', p2fp: 'הֻ^1ְ2ַ3ְתֶּן',
      p3mp: 'הֻ^1ְ2ְ3וּ', p3fp: 'הֻ^1ְ2ְ3וּ',
    },
    present: { ms: 'מֻ^1ְ2ָ3', fs: 'מֻ^1ְ2ֶ3ֶת', mp: 'מֻ^1ְ2ָ3ִים', fp: 'מֻ^1ְ2ָ3וֹת' },
    future: {
      p1s: 'אֻ^1ְ2ַ3', p2ms: 'תֻּ^1ְ2ַ3', p2fs: 'תֻּ^1ְ2ְ3ִי',
      p3ms: 'יֻ^1ְ2ַ3', p3fs: 'תֻּ^1ְ2ַ3',
      p1p: 'נֻ^1ְ2ַ3', p2mp: 'תֻּ^1ְ2ְ3וּ', p2fp: 'תֻּ^1ְ2ְ3וּ',
      p3mp: 'יֻ^1ְ2ְ3וּ', p3fp: 'יֻ^1ְ2ְ3וּ',
    },
  },

  התפעל: {
    past: {
      p1s: 'הִתְ1ַ*2ַ3ְתִּי', p2ms: 'הִתְ1ַ*2ַ3ְתָּ', p2fs: 'הִתְ1ַ*2ַ3ְתְּ',
      p3ms: 'הִתְ1ַ*2ֵ3', p3fs: 'הִתְ1ַ*2ְ3ָה',
      p1p: 'הִתְ1ַ*2ַ3ְנוּ', p2mp: 'הִתְ1ַ*2ַ3ְתֶּם', p2fp: 'הִתְ1ַ*2ַ3ְתֶּן',
      p3mp: 'הִתְ1ַ*2ְ3וּ', p3fp: 'הִתְ1ַ*2ְ3וּ',
    },
    present: { ms: 'מִתְ1ַ*2ֵ3', fs: 'מִתְ1ַ*2ֶ3ֶת', mp: 'מִתְ1ַ*2ְ3ִים', fp: 'מִתְ1ַ*2ְ3וֹת' },
    future: {
      p1s: 'אֶתְ1ַ*2ֵ3', p2ms: 'תִּתְ1ַ*2ֵ3', p2fs: 'תִּתְ1ַ*2ְ3ִי',
      p3ms: 'יִתְ1ַ*2ֵ3', p3fs: 'תִּתְ1ַ*2ֵ3',
      p1p: 'נִתְ1ַ*2ֵ3', p2mp: 'תִּתְ1ַ*2ְ3וּ', p2fp: 'תִּתְ1ַ*2ְ3וּ',
      p3mp: 'יִתְ1ַ*2ְ3וּ', p3fp: 'יִתְ1ַ*2ְ3וּ',
    },
    imperative: { ms: 'הִתְ1ַ*2ֵ3', fs: 'הִתְ1ַ*2ְ3ִי', mp: 'הִתְ1ַ*2ְ3וּ' },
    infinitive: 'לְהִתְ1ַ*2ֵ3',
    gerund: 'הִתְ1ַ*2ְ3וּת',
  },
};

// ── ל״ה ──────────────────────────────────────────────────────────────────────

const LAMED_HEY: Partial<Record<Binyan, BinyanTemplates>> = {
  פעל: {
    past: {
      p1s: '1ָ2ִיתִי', p2ms: '1ָ2ִיתָ', p2fs: '1ָ2ִית',
      p3ms: '1ָ2ָה', p3fs: '1ָ2ְתָה',
      p1p: '1ָ2ִינוּ', p2mp: '1ְ2ִיתֶם', p2fp: '1ְ2ִיתֶן',
      p3mp: '1ָ2וּ', p3fp: '1ָ2וּ',
    },
    present: { ms: '1וֹ2ֶה', fs: '1וֹ2ָה', mp: '1וֹ2ִים', fp: '1וֹ2וֹת' },
    future: {
      p1s: 'אֶ1ְ2ֶה', p2ms: 'תִּ1ְ2ֶה', p2fs: 'תִּ1ְ2ִי',
      p3ms: 'יִ1ְ2ֶה', p3fs: 'תִּ1ְ2ֶה',
      p1p: 'נִ1ְ2ֶה', p2mp: 'תִּ1ְ2וּ', p2fp: 'תִּ1ְ2וּ',
      p3mp: 'יִ1ְ2וּ', p3fp: 'יִ1ְ2וּ',
    },
    imperative: { ms: '1ְ2ֵה', fs: '1ְ2ִי', mp: '1ְ2וּ' },
    infinitive: 'לִ1ְ2וֹת',
    passiveParticiple: '1ָ2וּי',
    gerund: '1ְ2ִ~ייָּה',
  },

  פיעל: {
    past: {
      p1s: '1ִ^*2ִיתִי', p2ms: '1ִ^*2ִיתָ', p2fs: '1ִ^*2ִית',
      p3ms: '1ִ^*2ָה', p3fs: '1ִ^*2ְתָה',
      p1p: '1ִ^*2ִינוּ', p2mp: '1ִ^*2ִיתֶם', p2fp: '1ִ^*2ִיתֶן',
      p3mp: '1ִ^*2וּ', p3fp: '1ִ^*2וּ',
    },
    present: { ms: 'מְ1ַ*2ֶה', fs: 'מְ1ַ*2ָה', mp: 'מְ1ַ*2ִים', fp: 'מְ1ַ*2וֹת' },
    future: {
      p1s: 'אֲ1ַ*2ֶה', p2ms: 'תְּ1ַ*2ֶה', p2fs: 'תְּ1ַ*2ִי',
      p3ms: 'יְ1ַ*2ֶה', p3fs: 'תְּ1ַ*2ֶה',
      p1p: 'נְ1ַ*2ֶה', p2mp: 'תְּ1ַ*2וּ', p2fp: 'תְּ1ַ*2וּ',
      p3mp: 'יְ1ַ*2וּ', p3fp: 'יְ1ַ*2וּ',
    },
    imperative: { ms: '1ַ*2ֵה', fs: '1ַ*2ִי', mp: '1ַ*2וּ' },
    infinitive: 'לְ1ַ*2וֹת',
    gerund: '1ִ^*2וּי',
  },

  הפעיל: {
    past: {
      p1s: 'הִ1ְ2ֵיתִי', p2ms: 'הִ1ְ2ֵיתָ', p2fs: 'הִ1ְ2ֵית',
      p3ms: 'הִ1ְ2ָה', p3fs: 'הִ1ְ2ְתָה',
      p1p: 'הִ1ְ2ֵינוּ', p2mp: 'הִ1ְ2ֵיתֶם', p2fp: 'הִ1ְ2ֵיתֶן',
      p3mp: 'הִ1ְ2וּ', p3fp: 'הִ1ְ2וּ',
    },
    present: { ms: 'מַ1ְ2ֶה', fs: 'מַ1ְ2ָה', mp: 'מַ1ְ2ִים', fp: 'מַ1ְ2וֹת' },
    future: {
      p1s: 'אַ1ְ2ֶה', p2ms: 'תַּ1ְ2ֶה', p2fs: 'תַּ1ְ2ִי',
      p3ms: 'יַ1ְ2ֶה', p3fs: 'תַּ1ְ2ֶה',
      p1p: 'נַ1ְ2ֶה', p2mp: 'תַּ1ְ2וּ', p2fp: 'תַּ1ְ2וּ',
      p3mp: 'יַ1ְ2וּ', p3fp: 'יַ1ְ2וּ',
    },
    imperative: { ms: 'הַ1ְ2ֵה', fs: 'הַ1ְ2ִי', mp: 'הַ1ְ2וּ' },
    infinitive: 'לְהַ1ְ2וֹת',
    gerund: 'הַ1ְ2ָ~ייָה',
  },

  נפעל: {
    past: {
      p1s: 'נִ1ְ2ֵיתִי', p2ms: 'נִ1ְ2ֵיתָ', p2fs: 'נִ1ְ2ֵית',
      p3ms: 'נִ1ְ2ָה', p3fs: 'נִ1ְ2ְתָה',
      p1p: 'נִ1ְ2ֵינוּ', p2mp: 'נִ1ְ2ֵיתֶם', p2fp: 'נִ1ְ2ֵיתֶן',
      p3mp: 'נִ1ְ2וּ', p3fp: 'נִ1ְ2וּ',
    },
    present: { ms: 'נִ1ְ2ֶה', fs: 'נִ1ְ2ֵית', mp: 'נִ1ְ2ִים', fp: 'נִ1ְ2וֹת' },
    future: {
      p1s: 'אֶ*1ָ2ֶה', p2ms: 'תִּ^*1ָ2ֶה', p2fs: 'תִּ^*1ָ2ִי',
      p3ms: 'יִ^*1ָ2ֶה', p3fs: 'תִּ^*1ָ2ֶה',
      p1p: 'נִ^*1ָ2ֶה', p2mp: 'תִּ^*1ָ2וּ', p2fp: 'תִּ^*1ָ2וּ',
      p3mp: 'יִ^*1ָ2וּ', p3fp: 'יִ^*1ָ2וּ',
    },
    imperative: { ms: 'הִ^*1ָ2ֵה', fs: 'הִ^*1ָ2ִי', mp: 'הִ^*1ָ2וּ' },
    infinitive: 'לְהִ^*1ָ2וֹת',
    gerund: 'הִ^*1ָ2וּת',
  },

  התפעל: {
    past: {
      p1s: 'הִתְ1ַ*2ֵיתִי', p2ms: 'הִתְ1ַ*2ֵיתָ', p2fs: 'הִתְ1ַ*2ֵית',
      p3ms: 'הִתְ1ַ*2ָה', p3fs: 'הִתְ1ַ*2ְתָה',
      p1p: 'הִתְ1ַ*2ֵינוּ', p2mp: 'הִתְ1ַ*2ֵיתֶם', p2fp: 'הִתְ1ַ*2ֵיתֶן',
      p3mp: 'הִתְ1ַ*2וּ', p3fp: 'הִתְ1ַ*2וּ',
    },
    present: { ms: 'מִתְ1ַ*2ֶה', fs: 'מִתְ1ַ*2ָה', mp: 'מִתְ1ַ*2ִים', fp: 'מִתְ1ַ*2וֹת' },
    future: {
      p1s: 'אֶתְ1ַ*2ֶה', p2ms: 'תִּתְ1ַ*2ֶה', p2fs: 'תִּתְ1ַ*2ִי',
      p3ms: 'יִתְ1ַ*2ֶה', p3fs: 'תִּתְ1ַ*2ֶה',
      p1p: 'נִתְ1ַ*2ֶה', p2mp: 'תִּתְ1ַ*2וּ', p2fp: 'תִּתְ1ַ*2וּ',
      p3mp: 'יִתְ1ַ*2וּ', p3fp: 'יִתְ1ַ*2וּ',
    },
    imperative: { ms: 'הִתְ1ַ*2ֵה', fs: 'הִתְ1ַ*2ִי', mp: 'הִתְ1ַ*2וּ' },
    infinitive: 'לְהִתְ1ַ*2וֹת',
    gerund: 'הִתְ1ַ*2וּת',
  },
};

// ── ע״ו / ע״י (נחי העי״ן) ───────────────────────────────────────────────────

/** בגזרה זו אות השורש האמצעית היא אם קריאה, ולכן התבניות משתמשות ב־1 וב־3 בלבד */
function hollow(middle: 'ו' | 'י'): Partial<Record<Binyan, BinyanTemplates>> {
  const long = middle === 'ו' ? 'וּ' : 'ִי';
  const hifilVowel = middle === 'ו' ? 'ִי' : 'ִי';
  return {
    פעל: {
      past: {
        p1s: '1ַ3ְתִּי', p2ms: '1ַ3ְתָּ', p2fs: '1ַ3ְתְּ',
        p3ms: '1ָ3', p3fs: '1ָ3ָה',
        p1p: '1ַ3ְנוּ', p2mp: '1ַ3ְתֶּם', p2fp: '1ַ3ְתֶּן',
        p3mp: '1ָ3וּ', p3fp: '1ָ3וּ',
      },
      present: { ms: '1ָ3', fs: '1ָ3ָה', mp: '1ָ3ִים', fp: '1ָ3וֹת' },
      future: {
        p1s: `אָ1${long}3`, p2ms: `תָּ1${long}3`, p2fs: `תָּ1${long}3ִי`,
        p3ms: `יָ1${long}3`, p3fs: `תָּ1${long}3`,
        p1p: `נָ1${long}3`, p2mp: `תָּ1${long}3וּ`, p2fp: `תָּ1${long}3וּ`,
        p3mp: `יָ1${long}3וּ`, p3fp: `יָ1${long}3וּ`,
      },
      imperative: { ms: `1${long}3`, fs: `1${long}3ִי`, mp: `1${long}3וּ` },
      infinitive: `לָ1${long}3`,
      gerund: '1ִי3ָה',
    },
    הפעיל: {
      past: {
        p1s: 'הֵ1ַ3ְתִּי', p2ms: 'הֵ1ַ3ְתָּ', p2fs: 'הֵ1ַ3ְתְּ',
        p3ms: `הֵ1${hifilVowel}3`, p3fs: `הֵ1${hifilVowel}3ָה`,
        p1p: 'הֵ1ַ3ְנוּ', p2mp: 'הֵ1ַ3ְתֶּם', p2fp: 'הֵ1ַ3ְתֶּן',
        p3mp: `הֵ1${hifilVowel}3וּ`, p3fp: `הֵ1${hifilVowel}3וּ`,
      },
      present: {
        ms: `מֵ1${hifilVowel}3`, fs: `מְ1${hifilVowel}3ָה`,
        mp: `מְ1${hifilVowel}3ִים`, fp: `מְ1${hifilVowel}3וֹת`,
      },
      future: {
        p1s: `אָ1${hifilVowel}3`, p2ms: `תָּ1${hifilVowel}3`, p2fs: `תָּ1${hifilVowel}3ִי`,
        p3ms: `יָ1${hifilVowel}3`, p3fs: `תָּ1${hifilVowel}3`,
        p1p: `נָ1${hifilVowel}3`, p2mp: `תָּ1${hifilVowel}3וּ`, p2fp: `תָּ1${hifilVowel}3וּ`,
        p3mp: `יָ1${hifilVowel}3וּ`, p3fp: `יָ1${hifilVowel}3וּ`,
      },
      imperative: { ms: `הָ1${hifilVowel}3`, fs: `הָ1${hifilVowel}3ִי`, mp: `הָ1${hifilVowel}3וּ` },
      infinitive: `לְהָ1${hifilVowel}3`,
      gerund: 'הֲ1ָ3ָה',
    },
  };
}

// ── פ״נ ──────────────────────────────────────────────────────────────────────

/** הנו״ן נבלעת ומותירה דגש חזק באות שאחריה */
const PEY_NUN: Partial<Record<Binyan, BinyanTemplates>> = {
  פעל: {
    past: STRONG.פעל.past,
    present: STRONG.פעל.present,
    future: {
      p1s: 'אֶ*2ֹ^3', p2ms: 'תִּ*2ֹ^3', p2fs: 'תִּ*2ְ3ִי',
      p3ms: 'יִ*2ֹ^3', p3fs: 'תִּ*2ֹ^3',
      p1p: 'נִ*2ֹ^3', p2mp: 'תִּ*2ְ3וּ', p2fp: 'תִּ*2ְ3וּ',
      p3mp: 'יִ*2ְ3וּ', p3fp: 'יִ*2ְ3וּ',
    },
    imperative: STRONG.פעל.imperative,
    infinitive: STRONG.פעל.infinitive,
    passiveParticiple: STRONG.פעל.passiveParticiple,
    gerund: STRONG.פעל.gerund,
  },
  הפעיל: {
    past: {
      p1s: 'הִ*2ַ3ְתִּי', p2ms: 'הִ*2ַ3ְתָּ', p2fs: 'הִ*2ַ3ְתְּ',
      p3ms: 'הִ*2ִי3', p3fs: 'הִ*2ִי3ָה',
      p1p: 'הִ*2ַ3ְנוּ', p2mp: 'הִ*2ַ3ְתֶּם', p2fp: 'הִ*2ַ3ְתֶּן',
      p3mp: 'הִ*2ִי3וּ', p3fp: 'הִ*2ִי3וּ',
    },
    present: { ms: 'מַ*2ִי3', fs: 'מַ*2ִי3ָה', mp: 'מַ*2ִי3ִים', fp: 'מַ*2ִי3וֹת' },
    future: {
      p1s: 'אַ*2ִי3', p2ms: 'תַּ*2ִי3', p2fs: 'תַּ*2ִי3ִי',
      p3ms: 'יַ*2ִי3', p3fs: 'תַּ*2ִי3',
      p1p: 'נַ*2ִי3', p2mp: 'תַּ*2ִי3וּ', p2fp: 'תַּ*2ִי3וּ',
      p3mp: 'יַ*2ִי3וּ', p3fp: 'יַ*2ִי3וּ',
    },
    imperative: { ms: 'הַ*2ֵ3', fs: 'הַ*2ִי3ִי', mp: 'הַ*2ִי3וּ' },
    infinitive: 'לְהַ*2ִי3',
    gerund: 'הַ*2ָ3ָה',
  },
};

// ── ל׳ גרונית (ח, ע) ────────────────────────────────────────────────────────

/**
 * כשלמ״ד הפועל היא ח או ע, תנועת העתיד היא פתח ולא חולם,
 * ובבינוני ובשם הפועל מופיעה פתח גנובה: שׁוֹלֵחַ, יִשְׁלַח, לִשְׁלֹחַ.
 */
const LAMED_GUTTURAL: Partial<Record<Binyan, BinyanTemplates>> = {
  פעל: {
    past: STRONG.פעל.past,
    present: { ms: '1וֹ2ֵ3ַ', fs: '1וֹ2ַ3ַת', mp: '1וֹ2ְ3ִים', fp: '1וֹ2ְ3וֹת' },
    future: {
      p1s: 'אֶ1ְ2ַ3', p2ms: 'תִּ1ְ2ַ3', p2fs: 'תִּ1ְ2ְ3ִי',
      p3ms: 'יִ1ְ2ַ3', p3fs: 'תִּ1ְ2ַ3',
      p1p: 'נִ1ְ2ַ3', p2mp: 'תִּ1ְ2ְ3וּ', p2fp: 'תִּ1ְ2ְ3וּ',
      p3mp: 'יִ1ְ2ְ3וּ', p3fp: 'יִ1ְ2ְ3וּ',
    },
    imperative: { ms: '1ְ2ַ3', fs: '1ִ2ְ-3ִי', mp: '1ִ2ְ-3וּ' },
    infinitive: 'לִ1ְ2ֹ^3ַ',
    passiveParticiple: '1ָ2וּ3ַ',
    gerund: '1ְ2ִי3ָה',
  },
};

// ── ע״ע (כפולים) ────────────────────────────────────────────────────────────

/**
 * בשורש שעי״ן ולמ״ד הפועל שלו זהות, העתיד והציווי מתכווצים:
 * יָסֹב ולא ״יִסְבֹּב״, סֹב ולא ״סְבֹב״. העבר וההווה נשארים כשל השלמים.
 * אומת מול לוחות נטיית הפועל של האקדמיה, שורש סב״ב.
 */
const DOUBLE_AYIN: Partial<Record<Binyan, BinyanTemplates>> = {
  פעל: {
    past: STRONG.פעל.past,
    present: STRONG.פעל.present,
    future: {
      p1s: 'אָ1ֹ^2', p2ms: 'תָּ1ֹ^2', p2fs: 'תָּ1ֹ^*2ִי',
      p3ms: 'יָ1ֹ^2', p3fs: 'תָּ1ֹ^2',
      p1p: 'נָ1ֹ^2', p2mp: 'תָּ1ֹ^*2וּ', p2fp: 'תָּ1ֹ^2ְנָה',
      p3mp: 'יָ1ֹ^*2וּ', p3fp: 'תָּ1ֹ^2ְנָה',
    },
    imperative: { ms: '1ֹ^2', fs: '1ֹ^*2ִי', mp: '1ֹ^*2וּ' },
    infinitive: STRONG.פעל.infinitive,
    passiveParticiple: STRONG.פעל.passiveParticiple,
    gerund: STRONG.פעל.gerund,
  },
};

// ── פ״א ──────────────────────────────────────────────────────────────────────

/**
 * קבוצה סגורה של פעלים שפ״א הפועל שלהם אל״ף והעתיד שלהם בחולם:
 * יֹאמַר, יֹאכַל, יֹאבַד. שאר פעלי פ״א נוהגים כגרוניים רגילים.
 */
const PEY_ALEF_HOLAM_ROOTS = new Set(['אמר', 'אכל', 'אבד', 'אבה', 'אפה']);

const PEY_ALEF: Partial<Record<Binyan, BinyanTemplates>> = {
  פעל: {
    past: STRONG.פעל.past,
    present: STRONG.פעל.present,
    future: {
      p1s: 'אֹ^2ַ3', p2ms: 'תֹּ12ַ3', p2fs: 'תֹּ12ְ3ִי',
      p3ms: 'יֹ12ַ3', p3fs: 'תֹּ12ַ3',
      p1p: 'נֹ12ַ3', p2mp: 'תֹּ12ְ3וּ', p2fp: 'תֹּ12ַ3ְנָה',
      p3mp: 'יֹ12ְ3וּ', p3fp: 'תֹּ12ַ3ְנָה',
    },
    imperative: { ms: '1ֱ2ֹ^3', fs: '1ִ2ְ3ִי', mp: '1ִ2ְ3וּ' },
    infinitive: 'לֶ1ֱ2ֹ^3',
    passiveParticiple: STRONG.פעל.passiveParticiple,
    gerund: STRONG.פעל.gerund,
  },
};

// ── ל״א ──────────────────────────────────────────────────────────────────────

/**
 * האל״ף נחה ואינה נשמעת. בגופים שסיומתם עיצורית התנועה שלפניה
 * מתארכת לצירי: הִמְצֵאתִי ולא ״הִמְצַאְתִּי״.
 * אומת מול לוחות נטיית הפועל של האקדמיה, שורש מצ״א.
 */
const LAMED_ALEF: Partial<Record<Binyan, BinyanTemplates>> = {
  נפעל: {
    past: {
      p1s: 'נִ1ְ2ֵ3תִי', p2ms: 'נִ1ְ2ֵ3תָ', p2fs: 'נִ1ְ2ֵ3ת',
      p3ms: 'נִ1ְ2ָ3', p3fs: 'נִ1ְ2ְ3ָה',
      p1p: 'נִ1ְ2ֵ3נוּ', p2mp: 'נִ1ְ2ֵ3תֶם', p2fp: 'נִ1ְ2ֵ3תֶן',
      p3mp: 'נִ1ְ2ְ3וּ', p3fp: 'נִ1ְ2ְ3וּ',
    },
    present: { ms: 'נִ1ְ2ָ3', fs: 'נִ1ְ2ֵ3ת', mp: 'נִ1ְ2ָ3ִים', fp: 'נִ1ְ2ָ3וֹת' },
    future: STRONG.נפעל.future,
    imperative: STRONG.נפעל.imperative,
    infinitive: STRONG.נפעל.infinitive,
    gerund: STRONG.נפעל.gerund,
  },

  הפעיל: {
    past: {
      p1s: 'הִ1ְ2ֵ3תִי', p2ms: 'הִ1ְ2ֵ3תָ', p2fs: 'הִ1ְ2ֵ3ת',
      p3ms: 'הִ1ְ2ִי3', p3fs: 'הִ1ְ2ִי3ָה',
      p1p: 'הִ1ְ2ֵ3נוּ', p2mp: 'הִ1ְ2ֵ3תֶם', p2fp: 'הִ1ְ2ֵ3תֶן',
      p3mp: 'הִ1ְ2ִי3וּ', p3fp: 'הִ1ְ2ִי3וּ',
    },
    present: STRONG.הפעיל.present,
    future: STRONG.הפעיל.future,
    imperative: STRONG.הפעיל.imperative,
    infinitive: STRONG.הפעיל.infinitive,
    gerund: STRONG.הפעיל.gerund,
  },

  הופעל: {
    past: {
      p1s: 'הֻ^1ְ2ֵ3תִי', p2ms: 'הֻ^1ְ2ֵ3תָ', p2fs: 'הֻ^1ְ2ֵ3ת',
      p3ms: 'הֻ^1ְ2ָ3', p3fs: 'הֻ^1ְ2ְ3ָה',
      p1p: 'הֻ^1ְ2ֵ3נוּ', p2mp: 'הֻ^1ְ2ֵ3תֶם', p2fp: 'הֻ^1ְ2ֵ3תֶן',
      p3mp: 'הֻ^1ְ2ְ3וּ', p3fp: 'הֻ^1ְ2ְ3וּ',
    },
    present: { ms: 'מֻ^1ְ2ָ3', fs: 'מֻ^1ְ2ֵ3ת', mp: 'מֻ^1ְ2ָ3ִים', fp: 'מֻ^1ְ2ָ3וֹת' },
    future: {
      p1s: 'אֻ^1ְ2ָ3', p2ms: 'תֻּ^1ְ2ָ3', p2fs: 'תֻּ^1ְ2ְ3ִי',
      p3ms: 'יֻ^1ְ2ָ3', p3fs: 'תֻּ^1ְ2ָ3',
      p1p: 'נֻ^1ְ2ָ3', p2mp: 'תֻּ^1ְ2ְ3וּ', p2fp: 'תֻּ^1ְ2ֶ3נָה',
      p3mp: 'יֻ^1ְ2ְ3וּ', p3fp: 'תֻּ^1ְ2ֶ3נָה',
    },
  },

  התפעל: {
    past: {
      p1s: 'הִתְ1ַ*2ֵ3תִי', p2ms: 'הִתְ1ַ*2ֵ3תָ', p2fs: 'הִתְ1ַ*2ֵ3ת',
      p3ms: 'הִתְ1ַ*2ֵ3', p3fs: 'הִתְ1ַ*2ְ3ָה',
      p1p: 'הִתְ1ַ*2ֵ3נוּ', p2mp: 'הִתְ1ַ*2ֵ3תֶם', p2fp: 'הִתְ1ַ*2ֵ3תֶן',
      p3mp: 'הִתְ1ַ*2ְ3וּ', p3fp: 'הִתְ1ַ*2ְ3וּ',
    },
    present: { ms: 'מִתְ1ַ*2ֵ3', fs: 'מִתְ1ַ*2ֵ3ת', mp: 'מִתְ1ַ*2ְ3ִים', fp: 'מִתְ1ַ*2ְ3וֹת' },
    future: STRONG.התפעל.future,
    imperative: STRONG.התפעל.imperative,
    infinitive: STRONG.התפעל.infinitive,
    gerund: STRONG.התפעל.gerund,
  },

  פעל: {
    past: {
      p1s: '1ָ2ָ3תִי', p2ms: '1ָ2ָ3תָ', p2fs: '1ָ2ָ3ת',
      p3ms: '1ָ2ָ3', p3fs: '1ָ2ְ3ָה',
      p1p: '1ָ2ָ3נוּ', p2mp: '1ְ2ָ3תֶם', p2fp: '1ְ2ָ3תֶן',
      p3mp: '1ָ2ְ3וּ', p3fp: '1ָ2ְ3וּ',
    },
    present: { ms: '1וֹ2ֵ3', fs: '1וֹ2ֵ3ת', mp: '1וֹ2ְ3ִים', fp: '1וֹ2ְ3וֹת' },
    future: {
      p1s: 'אֶ1ְ2ָ3', p2ms: 'תִּ1ְ2ָ3', p2fs: 'תִּ1ְ2ְ3ִי',
      p3ms: 'יִ1ְ2ָ3', p3fs: 'תִּ1ְ2ָ3',
      p1p: 'נִ1ְ2ָ3', p2mp: 'תִּ1ְ2ְ3וּ', p2fp: 'תִּ1ְ2ְ3וּ',
      p3mp: 'יִ1ְ2ְ3וּ', p3fp: 'יִ1ְ2ְ3וּ',
    },
    imperative: { ms: '1ְ2ָ3', fs: '1ִ2ְ3ִי', mp: '1ִ2ְ3וּ' },
    infinitive: 'לִ1ְ2ֹ^3',
    passiveParticiple: '1ָ2וּ3',
    gerund: '1ְ2ִי3ָה',
  },
};

/**
 * שורשים שהשי״ן שבהם שׂמאלית. ברירת המחדל היא שׁי״ן ימנית, ולכן
 * די ברשימת החריגים. בלי ההבחנה הזאת הניקוד אינו שלם.
 */
const SIN_ROOTS = new Set([
  'עשה', 'נשא', 'שים', 'שמח', 'שרף', 'שחק', 'שכר', 'שנא',
  'שער', 'שרד', 'שכל', 'שגה', 'שיח', 'שרר', 'פשה',
  'שדה', 'נשג', 'שרט', 'שכר', 'שעה', 'שבע',
]);

// ── פ״י ──────────────────────────────────────────────────────────────────────

/**
 * היו״ד נופלת בעתיד ובציווי, ותנועת התחילית היא צירי:
 * יָשַׁב ← יֵשֵׁב, שֵׁב. שם הפועל במשקל לָשֶׁבֶת.
 * אומת מול לוחות נטיית הפועל של האקדמיה, שורש יש״ב.
 */
const PEY_YOD: Partial<Record<Binyan, BinyanTemplates>> = {
  פעל: {
    past: STRONG.פעל.past,
    present: STRONG.פעל.present,
    future: {
      p1s: 'אֵ2ֵ3', p2ms: 'תֵּ2ֵ3', p2fs: 'תֵּ2ְ3ִי',
      p3ms: 'יֵ2ֵ3', p3fs: 'תֵּ2ֵ3',
      p1p: 'נֵ2ֵ3', p2mp: 'תֵּ2ְ3וּ', p2fp: 'תֵּ2ֵ3ְנָה',
      p3mp: 'יֵ2ְ3וּ', p3fp: 'תֵּ2ֵ3ְנָה',
    },
    imperative: { ms: '2ֵ3', fs: '2ְ3ִי', mp: '2ְ3וּ' },
    infinitive: 'לָ2ֶ3ֶת',
    passiveParticiple: STRONG.פעל.passiveParticiple,
    gerund: STRONG.פעל.gerund,
  },
};

/**
 * שורשי פ״י שמקורם בפ״ו.
 *
 * רובם המכריע של שורשי פ״י היו במקורם פ״ו, והוי״ו חוזרת ומופיעה
 * בבניינים הכבדים: יָדַע ← הוֹדִיעַ, יָשַׁב ← הוֹשִׁיב, יָצָא ← הוֹצִיא.
 * לעומתם פ״י מקורית נוטה בצירי־יו״ד: יָטַב ← הֵיטִיב, יָמִין ← הֵימִין.
 * בלי ההבחנה הזאת המנוע ייצר ״הידיע״.
 */
const PEY_YOD_VAV_ROOTS = new Set([
  'ידע', 'ילד', 'יצא', 'ירד', 'ישב', 'יסף', 'יכח', 'ידה', 'ירה',
  'יבל', 'יעל', 'יקר', 'ישט', 'יזל', 'ירש', 'ישע', 'יתר', 'יסד',
  // המפתחות מנורמלים כמו הפלט של normalizeRoot: «יסף» ← «יספ»
].map((root) => normalizeRoot(root).join('')));

/**
 * גוזר תבנית פ״ו מתבנית השלמים: התנועה שלפני אות שורש 1 והשווא שאחריה
 * נבלעים באם קריאה — ״הִ1ְ2ִי3״ הופך ל״הוֹ2ִי3״.
 *
 * בהפעיל האם היא חולם מלא, ובהופעל היא שורוק: הוֹדִיעַ מול הוּדַע.
 */
function toPeyVav(template: string, mater: string): string {
  return template.replace(
    /([\u05D0-\u05EA]\u05BC?)[\u05B0-\u05BC\u05C7]\^?1\u05B0/gu,
    (_m, consonant: string) => consonant + mater,
  );
}

function peyVavTemplates(t: BinyanTemplates, mater: string): BinyanTemplates {
  const section = <K extends string>(map: Partial<Record<K, string>>): Partial<Record<K, string>> => {
    const out: Partial<Record<K, string>> = {};
    for (const [key, value] of Object.entries(map) as [K, string][]) out[key] = toPeyVav(value, mater);
    return out;
  };
  return {
    past: section(t.past),
    present: section(t.present),
    future: section(t.future),
    imperative: t.imperative ? section(t.imperative) : undefined,
    infinitive: t.infinitive ? toPeyVav(t.infinitive, mater) : undefined,
    passiveParticiple: t.passiveParticiple ? toPeyVav(t.passiveParticiple, mater) : undefined,
    gerund: t.gerund ? toPeyVav(t.gerund, mater) : undefined,
  };
}

const HOLAM_MALE = '\u05D5\u05B9';
const SHURUK = '\u05D5\u05BC';

// ── בחירת התבניות ────────────────────────────────────────────────────────────

export type Accuracy = 'full' | 'partial' | 'approx';

interface TemplateChoice {
  templates: BinyanTemplates;
  accuracy: Accuracy;
  note?: string;
}

/**
 * הופך תבנית של גזרת השלמים לתבנית של שורש מרובע.
 *
 * במרובעים העיצור הכפול של הבניינים הכבדים מוחלף בשתי אותיות שורש:
 * שִׁלֵּם ← פִּרְסֵם, מְשַׁלֵּם ← מְפַרְסֵם, שִׁילּוּם ← פִּרְסוּם. שלוש
 * פעולות מספיקות לכך: אות שורש 3 הופכת ל־4, האות הכפולה 2 הופכת לרצף
 * ״2 בשווא ואחריה 3״, והתנועה שהייתה על 2 עוברת אל 3.
 *
 * סימן ה־^ נשמט: החיריק במרובעים סגור בהברה (פִּרְ) ולכן אינו נכתב
 * ביו״ד בכתיב חסר הניקוד — ״פרסם״, ולא ״פירסם״.
 */
function toQuadriliteral(template: string): string {
  return template
    .replace(/\^/g, '')
    .replace(/3/g, '4')
    .replace(/\*?2/g, '2\u05B0\u0033');
}

function quadTemplates(t: BinyanTemplates): BinyanTemplates {
  const section = <K extends string>(map: Partial<Record<K, string>>): Partial<Record<K, string>> => {
    const out: Partial<Record<K, string>> = {};
    for (const [key, value] of Object.entries(map) as [K, string][]) {
      out[key] = toQuadriliteral(value);
    }
    return out;
  };
  return {
    past: section(t.past),
    present: section(t.present),
    future: section(t.future),
    imperative: t.imperative ? section(t.imperative) : undefined,
    infinitive: t.infinitive ? toQuadriliteral(t.infinitive) : undefined,
    passiveParticiple: t.passiveParticiple ? toQuadriliteral(t.passiveParticiple) : undefined,
    gerund: t.gerund ? toQuadriliteral(t.gerund) : undefined,
  };
}

/** הבניינים שמרובעים נוטים בהם: הכבדים בלבד */
const QUAD_BINYANIM = new Set<Binyan>(['פיעל', 'פועל', 'התפעל']);

function chooseTemplates(binyan: Binyan, gizra: Gizra, radicals: string[]): TemplateChoice {
  /*
   * שורש פ״ו בבניינים הכבדים נבדק ראשון, לפני חלוקת הגזרות: ״יצא״ נחשב
   * ל״א ואף על פי כן ההפעיל שלו הוא ״הוציא״ ולא ״היציא״. כשהשורש חלש גם
   * בעמדה נוספת התבנית מכסה רק את הוי״ו, ולכן הדיוק יורד ל־partial.
   */
  if ((binyan === 'הפעיל' || binyan === 'הופעל') && PEY_YOD_VAV_ROOTS.has(radicals.join(''))) {
    const mater = binyan === 'הפעיל' ? HOLAM_MALE : SHURUK;
    const alsoWeak = gizra !== 'פ"י';
    return {
      templates: peyVavTemplates(STRONG[binyan], mater),
      accuracy: alsoWeak ? 'partial' : 'full',
      note: alsoWeak
        ? 'השורש חלש גם בעמדה נוספת; התבנית מכסה את הוי״ו של פ״ו בלבד.'
        : undefined,
    };
  }

  if (gizra === 'שלמים') return { templates: STRONG[binyan], accuracy: 'full' };

  if (gizra === 'מרובעים') {
    if (!QUAD_BINYANIM.has(binyan)) {
      return {
        templates: STRONG[binyan],
        accuracy: 'approx',
        note: `שורש מרובע אינו נוטה בבניין ${binyan}; הצורות נגזרו מגזרת השלמים ואינן אמינות.`,
      };
    }
    return {
      templates: quadTemplates(STRONG[binyan]),
      accuracy: 'partial',
      note: 'שורש מרובע נוטה כבניין הכבד. הדגש הקל בבג״ד כפ״ת אינו מסומן בכל הצורות.',
    };
  }

  if (gizra === 'ל"א') {
    const t = LAMED_ALEF[binyan];
    if (t) return { templates: t, accuracy: 'full' };
    return {
      templates: STRONG[binyan],
      accuracy: 'approx',
      note: 'גזרת ל״א בבניין זה אינה מכוסה בתבניות; הצורות נגזרו מגזרת השלמים.',
    };
  }

  if (gizra === 'ע"ע') {
    const t = DOUBLE_AYIN[binyan];
    if (t) return { templates: t, accuracy: 'full' };
    return {
      templates: STRONG[binyan],
      accuracy: 'partial',
      note:
        'בבניינים הכבדים הכפולים נוטים כשלמים, ואולם חלק מן הצורות ' +
        'מתכווצות בעברית הקלסית. הצורות כאן הן של גזרת השלמים.',
    };
  }

  if (gizra === 'פ"א') {
    const isHolamClass = PEY_ALEF_HOLAM_ROOTS.has(radicals.join(''));
    const t = PEY_ALEF[binyan];
    if (t && isHolamClass) return { templates: t, accuracy: 'full' };
    return {
      templates: STRONG[binyan],
      accuracy: 'partial',
      note: isHolamClass
        ? 'גזרת פ״א בבניין זה נוהגת כגרוניים.'
        : 'פ״א שאינה מקבוצת ״יֹאמַר״ נוהגת כגרונית; החטפים הוחלו אוטומטית.',
    };
  }

  if (gizra === 'גרוניים') {
    const last = radicals[radicals.length - 1];
    if ((last === 'ח' || last === 'ע') && LAMED_GUTTURAL[binyan]) {
      return { templates: LAMED_GUTTURAL[binyan]!, accuracy: 'full' };
    }
    return {
      templates: STRONG[binyan],
      accuracy: 'partial',
      note:
        'בשורש יש אות גרונית. החטפים והוויתור על הדגש הוחלו אוטומטית, ' +
        'אך תנועות התחילית והנטייה עשויות להשתנות בחלק מן הצורות.',
    };
  }

  if (gizra === 'ל"ה') {
    const t = LAMED_HEY[binyan];
    if (t) return { templates: t, accuracy: 'full' };
    return {
      templates: STRONG[binyan],
      accuracy: 'approx',
      note: 'גזרת ל״ה בבניין זה אינה מכוסה בתבניות; הצורות נגזרו מגזרת השלמים.',
    };
  }

  if (gizra === 'ע"ו' || gizra === 'ע"י') {
    const t = hollow(gizra === 'ע"ו' ? 'ו' : 'י')[binyan];
    if (t) return { templates: t, accuracy: 'full' };
    return {
      templates: STRONG[binyan],
      accuracy: 'approx',
      note: 'נחי העי״ן בבניין זה אינם מכוסים בתבניות; הצורות נגזרו מגזרת השלמים.',
    };
  }

  if (gizra === 'פ"י') {
    const t = PEY_YOD[binyan];
    if (t) {
      const lastGuttural = 'אהחע'.includes(radicals[2]);
      return {
        templates: t,
        accuracy: lastGuttural ? 'partial' : 'full',
        note: lastGuttural
          ? 'למ״ד הפועל גרונית, ולכן תנועת הצירי בעתיד מתחלפת בפתח בחלק מן הצורות.'
          : undefined,
      };
    }
    return {
      templates: STRONG[binyan],
      accuracy: 'partial',
      note: 'בבניינים הכבדים פ״י נוהגת כשלמים, למעט היבלעות היו״ד בחלק מן הצורות.',
    };
  }

  if (gizra === 'פ"נ') {
    const t = PEY_NUN[binyan];
    if (t) {
      return {
        templates: t,
        accuracy: 'partial',
        note: 'הנו״ן נבלעת בעתיד ובבניין הפעיל. בציווי ובשם הפועל קיימות בעברית שתי מסורות.',
      };
    }
    return { templates: STRONG[binyan], accuracy: 'partial' };
  }

  return {
    templates: STRONG[binyan],
    accuracy: 'approx',
    note: `גזרת ${gizra} אינה מכוסה בתבניות ייעודיות; הצורות נגזרו מגזרת השלמים וטעונות אימות.`,
  };
}

// ── מטתזה בהתפעל ─────────────────────────────────────────────────────────────

const SIBILANTS = new Set(['ס', 'ש', 'ש', 'צ', 'ז']);
const METATHESIS_LETTER: Record<string, string> = { צ: 'ט', ז: 'ד' };

/**
 * בהתפעל, כשאות השורש הראשונה שורקת, היא מתחלפת בתי״ו של התחילית:
 * הסתדר, השתמש, הצטרף, הזדמן.
 */
function applyMetathesis(segments: Segment[]): Segment[] {
  const taw = segments.findIndex((s) => s.letter === 'ת' && s.radical === undefined);
  if (taw < 0) return segments;
  const first = segments.findIndex((s) => s.radical === 1);
  if (first !== taw + 1) return segments;

  const rootLetter = segments[first].letter;
  if (!SIBILANTS.has(rootLetter)) return segments;

  const out = segments.map((s) => ({ ...s, vowels: [...s.vowels] }));
  const replacement = METATHESIS_LETTER[rootLetter] ?? 'ת';
  // מחליפים את האותיות ומשאירים את הניקוד במקומו
  out[taw].letter = rootLetter;
  out[taw].radical = 1;
  out[first].letter = replacement;
  out[first].radical = undefined;
  // אחרי מטתזה אין דגש בתי״ו של התחילית
  if (replacement !== 'ת') out[first].dagesh = false;
  return out;
}

// ── ממשק ציבורי ──────────────────────────────────────────────────────────────

export interface ConjugationForm {
  key: string;
  label: string;
  plain: string;
  nikud: string;
}

export interface Conjugation {
  root: string[];
  binyan: Binyan;
  gizra: Gizra;
  accuracy: Accuracy;
  note?: string;
  past: ConjugationForm[];
  present: ConjugationForm[];
  future: ConjugationForm[];
  imperative: ConjugationForm[];
  infinitive?: ConjugationForm;
  passiveParticiple?: ConjugationForm;
  gerund?: ConjugationForm;
}

function makeForm(
  key: string,
  label: string,
  template: string,
  radicals: string[],
  binyan: Binyan,
  sin: boolean,
): ConjugationForm {
  if (binyan === 'התפעל') {
    const segments = applyMetathesis(expand(template, radicals));
    return {
      key,
      label,
      plain: render(segments, { nikud: false }),
      nikud: render(segments, { nikud: true, sin }),
    };
  }
  const { plain, nikud } = build(template, radicals, { sin });
  return { key, label, plain, nikud };
}

export function conjugate(rootInput: string, binyan: Binyan): Conjugation {
  const radicals = normalizeRoot(rootInput);
  if (radicals.length < 3 || radicals.length > 4) {
    throw new Error(`שורש חייב למנות שלוש אותיות או ארבע; התקבל «${rootInput}»`);
  }

  const gizra = detectGizra(radicals);
  const sin = SIN_ROOTS.has(radicals.join(''));
  const chosen = chooseTemplates(binyan, gizra, radicals);
  /*
   * שורש חלש בשתי עמדות נוטה לפי תבנית שמכסה רק אחת מהן, ולכן אסור
   * להציג את התוצאה כוודאית גם אם התבנית עצמה מדויקת לגזרה שלה.
   */
  const doublyWeak = isDoublyWeak(radicals);
  const accuracy = doublyWeak && chosen.accuracy === 'full' ? 'approx' : chosen.accuracy;
  const templates = chosen.templates;
  const note = doublyWeak
    ? 'השורש חלש בשתי עמדות, והתבנית מכסה רק אחת מהן. הצורות טעונות אימות.'
    : chosen.note;

  const section = <K extends string>(
    map: Partial<Record<K, string>>,
    labels: Record<K, string>,
  ): ConjugationForm[] =>
    (Object.keys(labels) as K[])
      .filter((key) => map[key] !== undefined)
      .map((key) => makeForm(key, labels[key], map[key]!, radicals, binyan, sin));

  const single = (template: string | undefined, label: string, key: string) =>
    template ? makeForm(key, label, template, radicals, binyan, sin) : undefined;

  return {
    root: radicals,
    binyan,
    gizra,
    accuracy,
    note,
    past: section(templates.past, PERSON_LABELS),
    present: section(templates.present, PRESENT_LABELS),
    future: section(templates.future, PERSON_LABELS),
    imperative: templates.imperative ? section(templates.imperative, IMPERATIVE_LABELS) : [],
    infinitive: single(templates.infinitive, 'שם הפועל', 'infinitive'),
    passiveParticiple: single(templates.passiveParticiple, 'בינוני פעול', 'passiveParticiple'),
    gerund: single(templates.gerund, 'שם הפעולה', 'gerund'),
  };
}

export { finalizeLetters };

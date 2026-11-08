/** עיצוב תוצאות לקריאה אנושית בתוך תשובת הכלי. */

import type { AnalyzeResult } from './engine.js';
import { CATEGORY_LABEL_HE, SEVERITY_LABEL_HE, type Finding } from './text/diagnostics.js';
import type { Conjugation } from './morph/binyanim.js';

const SEVERITY_MARK: Record<string, string> = {
  error: '■',
  warning: '▲',
  suggestion: '·',
  style: '○',
};

/** מספר השורה והעמודה של היסט נתון, לצורכי דיווח */
export function lineAndColumn(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lastBreak = -1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') {
      line++;
      lastBreak = i;
    }
  }
  return { line, column: offset - lastBreak };
}

function formatFinding(text: string, f: Finding, index: number): string {
  const { line, column } = lineAndColumn(text, f.start);
  const mark = SEVERITY_MARK[f.severity] ?? '·';
  const lines = [
    `${mark} [${index}] שורה ${line}:${column} · ${SEVERITY_LABEL_HE[f.severity]} · ${CATEGORY_LABEL_HE[f.category]} · ${f.ruleId}`,
    `    «${f.excerpt}»`,
    `    ${f.message}`,
  ];
  if (f.suggestion) lines.push(`    הצעה: ${f.suggestion}`);
  const authority = f.authority.clause
    ? `${f.authority.source} — ${f.authority.clause}`
    : f.authority.source;
  lines.push(`    מקור: ${authority}`);
  if (f.replacement !== undefined && f.autoFixSafe) lines.push('    ניתן לתיקון אוטומטי');
  return lines.join('\n');
}

export function formatAnalysis(text: string, result: AnalyzeResult, title = 'הגהה'): string {
  const { stats, findings, totalFindings } = result;

  const header = [
    `${title} — ${stats.words} מילים, ${stats.sentences} משפטים, ${stats.characters} תווים`,
    `מרשם: ${result.register} · ${result.rulesRun} כללים הופעלו`,
  ];
  if (result.configSource) header.push(`כללי בית נטענו מ־${result.configSource}`);

  if (findings.length === 0) {
    header.push('', 'לא נמצאו ממצאים.');
    return header.join('\n');
  }

  const summary = Object.entries(stats.bySeverity)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');
  header.push(`נמצאו ${totalFindings} ממצאים (${summary})`);
  if (findings.length < totalFindings) {
    header.push(`מוצגים ${findings.length} הראשונים.`);
  }
  header.push('');

  const byCategory = new Map<string, Finding[]>();
  for (const f of findings) {
    const key = CATEGORY_LABEL_HE[f.category] ?? f.category;
    const list = byCategory.get(key) ?? [];
    list.push(f);
    byCategory.set(key, list);
  }

  const body: string[] = [];
  let index = 1;
  for (const [category, list] of byCategory) {
    body.push(`── ${category} (${list.length}) ──`);
    for (const f of list) {
      body.push(formatFinding(text, f, index++));
      body.push('');
    }
  }

  return [...header, ...body].join('\n').trimEnd();
}

const ACCURACY_NOTE: Record<string, string> = {
  full: 'הצורות נגזרו מתבנית ייעודית לגזרה זו.',
  partial: 'הגזרה מטופלת חלקית — חלק מן הצורות טעונות אימות.',
  approx: 'אין תבנית ייעודית לגזרה זו; הצורות נגזרו מגזרת השלמים וטעונות אימות.',
};

export function formatConjugation(c: Conjugation, nikud: boolean): string {
  const pick = (f: { plain: string; nikud: string }) => (nikud ? f.nikud : f.plain);

  const section = (title: string, forms: Array<{ label: string; plain: string; nikud: string }>) => {
    if (forms.length === 0) return [];
    const rows = forms.map((f) => `  ${f.label.padEnd(8, ' ')} ${pick(f)}`);
    return [`${title}:`, ...rows, ''];
  };

  const out: string[] = [
    `שורש ${c.root.join('־')} · בניין ${c.binyan} · גזרת ${c.gizra}`,
    `דיוק: ${c.accuracy} — ${ACCURACY_NOTE[c.accuracy]}`,
  ];
  if (c.note) out.push(`הערה: ${c.note}`);
  out.push('');

  out.push(...section('עבר', c.past));
  out.push(...section('הווה / בינוני', c.present));
  out.push(...section('עתיד', c.future));
  out.push(...section('ציווי', c.imperative));

  const extras: string[] = [];
  if (c.infinitive) extras.push(`  שם הפועל      ${pick(c.infinitive)}`);
  if (c.passiveParticiple) extras.push(`  בינוני פעול   ${pick(c.passiveParticiple)}`);
  if (c.gerund) extras.push(`  שם הפעולה     ${pick(c.gerund)}`);
  if (extras.length) out.push('צורות נוספות:', ...extras);

  return out.join('\n').trimEnd();
}

#!/usr/bin/env node
/**
 * הרצה ידנית מן הטרמינל, בלי לקוח MCP.
 *
 *   node dist/cli.js "טקסט לבדיקה"
 *   node dist/cli.js --file מסמך.txt --register academic
 *   node dist/cli.js --fix "טקסט לתיקון"
 *   node dist/cli.js --conjugate כתב --binyan פיעל --nikud
 *   node dist/cli.js --lexicon
 */

import { readFileSync } from 'node:fs';
import { analyze } from './engine.js';
import { applyFixes } from './text/fixer.js';
import { formatAnalysis, formatConjugation } from './format.js';
import { conjugate, type Binyan } from './morph/binyanim.js';
import { academyLexiconSummary } from './lexicon/academy.js';
import { idiomsSummary } from './lexicon/idioms.js';
import { placesSummary } from './lexicon/places.js';
import { topicsSummary } from './lexicon/topics.js';
import type { Register } from './text/diagnostics.js';

interface Args {
  text?: string;
  file?: string;
  register?: Register;
  fix: boolean;
  conjugate?: string;
  binyan: Binyan;
  nikud: boolean;
  help: boolean;
  lexicon: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { fix: false, binyan: 'פעל', nikud: false, help: false, lexicon: false };
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--file':
        args.file = argv[++i];
        break;
      case '--register':
        args.register = argv[++i] as Register;
        break;
      case '--fix':
        args.fix = true;
        break;
      case '--conjugate':
        args.conjugate = argv[++i];
        break;
      case '--binyan':
        args.binyan = argv[++i] as Binyan;
        break;
      case '--nikud':
        args.nikud = true;
        break;
      case '--lexicon':
        args.lexicon = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        positional.push(a);
    }
  }
  if (positional.length > 0) args.text = positional.join(' ');
  return args;
}

const USAGE = `
hebrew-editor — הגהה ועריכה לשונית בעברית

  node dist/cli.js "טקסט"                      הגהה
  node dist/cli.js --file doc.txt              הגהת קובץ
  node dist/cli.js --register academic "טקסט"  הגהה במרשם אקדמי
  node dist/cli.js --fix "טקסט"                החלת תיקונים בטוחים
  node dist/cli.js --conjugate כתב --binyan פיעל --nikud
  node dist/cli.js --lexicon                    מצב לקסיקון האקדמיה

בניינים: פעל, נפעל, פיעל, פועל, הפעיל, הופעל, התפעל
`.trim();

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(USAGE);
    return;
  }

  if (args.lexicon) {
    console.log(academyLexiconSummary());
    console.log();
    console.log(idiomsSummary());
    console.log(placesSummary());
    console.log(topicsSummary());
    return;
  }

  if (args.conjugate) {
    console.log(formatConjugation(conjugate(args.conjugate, args.binyan), args.nikud));
    return;
  }

  let text: string | undefined;
  if (args.file) {
    try {
      text = readFileSync(args.file, 'utf8');
    } catch {
      // קובץ חסר או בלתי קריא — הודעה במקום עקבת שגיאה של Node
      process.stderr.write(`[hebrew-editor] לא הצלחתי לקרוא את הקובץ: ${args.file}
`);
      process.exitCode = 1;
      return;
    }
    if (!text.trim()) {
      process.stderr.write(`[hebrew-editor] הקובץ ריק: ${args.file}
`);
      return;
    }
  } else {
    text = args.text;
  }
  if (!text) {
    console.log(USAGE);
    process.exitCode = 1;
    return;
  }

  const result = analyze(text, { register: args.register });

  if (args.fix) {
    const fixed = applyFixes(text, result.findings, { onlySafe: true });
    console.log(fixed.text);
    process.stderr.write(`\n[hebrew-editor] הוחלו ${fixed.applied.length} תיקונים\n`);
    return;
  }

  console.log(formatAnalysis(text, result));
}

main();

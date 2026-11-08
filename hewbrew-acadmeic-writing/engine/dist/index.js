#!/usr/bin/env node
/** נקודת הכניסה: מריץ את השרת מעל stdio. */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { findDuplicateRuleIds } from './rules/index.js';
async function main() {
    const duplicates = findDuplicateRuleIds();
    if (duplicates.length > 0) {
        // מזהה כפול פירושו שכלל אחד מסתיר אחר; עדיף להיכשל מיד
        throw new Error(`מזהי כללים כפולים: ${duplicates.join(', ')}`);
    }
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // אין לכתוב ל־stdout: הוא ערוץ הפרוטוקול
    process.stderr.write('[hebrew-editor] השרת פועל על stdio\n');
}
main().catch((err) => {
    process.stderr.write(`[hebrew-editor] כשל בהפעלת השרת: ${err.message}\n`);
    process.exit(1);
});
//# sourceMappingURL=index.js.map
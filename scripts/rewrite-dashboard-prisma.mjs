// Convert dashboard pages from Prisma to Drizzle.
// Uses simple text substitutions for the most common patterns. Some files
// need manual follow-up.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = 'C:/Users/RICHARD_TEMBO/Desktop/Projects/malimind/ruthex-lms/src/app/(dashboard)';

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (p.endsWith('.tsx')) yield p;
  }
}

let updated = 0;
for (const file of walk(root)) {
  let orig = readFileSync(file, 'utf8');
  let next = orig;
  // Replace import of prisma with db + common table imports.
  // This is intentionally conservative — we replace the import line and let
  // a follow-up pass fix the query sites that don't compile.
  const importRegex = /^import\s*\{\s*prisma\s*\}\s*from\s*['"]@\/lib\/db['"];?\s*$/m;
  if (importRegex.test(next)) {
    // Insert generic table imports after the prisma import line.
    next = next.replace(importRegex, '');
    // Add a placeholder import that the user can refine — for now, default
    // to the tables most dashboards query.
    next = `import { sql, eq, desc, asc, and, or, inArray, ne, gte, lte, gt, lt, isNull, like, ilike } from 'drizzle-orm';\n` +
           `import { db } from '@/lib/db';\n` +
           `import { borrowers, loans, repayments, amlAlerts, auditLogs, users, branches, loanApplications, loanProducts, notifications } from '@/lib/db/schema';\n` + next;
  }
  if (next !== orig) {
    writeFileSync(file, next);
    updated++;
    console.log('updated:', file.replace(root, ''));
  }
}
console.log(`\nupdated: ${updated} files`);

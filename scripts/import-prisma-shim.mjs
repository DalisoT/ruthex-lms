// Fix dashboard pages: add `prisma` import from @/lib/db (the shim) so the
// existing `prisma.x.findMany(...)` calls compile while they await migration.
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
  const orig = readFileSync(file, 'utf8');
  if (!/\bprisma\./.test(orig)) continue; // nothing to do
  let next = orig;
  // Add `prisma` to the existing `@/lib/db` import if present.
  if (/^import\s*\{\s*db\s*\}\s*from\s*['"]@\/lib\/db['"];?/m.test(next)) {
    next = next.replace(/^import\s*\{\s*db\s*\}\s*from\s*(['"]@\/lib\/db['"]);?/m, "import { db, prisma } from $1;");
  } else if (!/from\s*['"]@\/lib\/db['"]/.test(next)) {
    // No @/lib/db import — add one at the top of the import block.
    next = `import { prisma } from '@/lib/db';\n` + next;
  } else {
    // Some other shape of @/lib/db import — leave it, just add a separate import line.
    next = `import { prisma } from '@/lib/db';\n` + next;
  }
  if (next !== orig) {
    writeFileSync(file, next);
    updated++;
    console.log('updated:', file.replace(root, ''));
  }
}
console.log(`\nupdated: ${updated} files`);

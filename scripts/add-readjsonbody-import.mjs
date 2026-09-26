// Add the readJsonBody import to any API route that uses readJsonBody() but
// doesn't yet import it. Runs after fix-req-json.mjs which already swapped
// the body-parsing pattern.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = 'C:/Users/RICHARD_TEMBO/Desktop/Projects/malimind/ruthex-lms/src/app/api';

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (p.endsWith('.ts')) yield p;
  }
}

let changed = 0;
for (const file of walk(root)) {
  const orig = readFileSync(file, 'utf8');
  // If file uses readJsonBody but doesn't import it, inject the import.
  if (orig.includes('await readJsonBody(req)') && !orig.includes("from '@/lib/request-body'")) {
    const next = orig.replace(
      /^(import \{ NextRequest, NextResponse \} from 'next\/server';\r?\n)/m,
      "$1import { readJsonBody } from '@/lib/request-body';\n"
    );
    if (next !== orig) {
      writeFileSync(file, next);
      console.log('added import:', file.replace(root, ''));
      changed++;
    }
  }
}
console.log(`\nfiles updated: ${changed}`);

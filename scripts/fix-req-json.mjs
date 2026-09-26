// Rewrite all `await req.json()` patterns in API routes to use readJsonBody()
// from src/lib/request-body.ts. Fixes the Cloudflare Workers OpenNext issue
// where NextRequest.json() throws "Invalid JSON" on otherwise-valid bodies.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = 'C:/Users/RICHARD_TEMBO/Desktop/Projects/malimind/ruthex-lms/src/app/api';

const sourceA =
  "try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }";
const replacementA =
  "const body = await readJsonBody(req);\n  if (body === null) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });";

const sourceB = "const j = await req.json().catch(() => ({}));";
const replacementB = "const j = (await readJsonBody(req)) ?? {};";

const sourceC = "try { body = await req.json(); } catch { /* allow empty body */ }";
const replacementC = "const body = await readJsonBody(req);";

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (p.endsWith('.ts')) yield p;
  }
}

let changed = 0;
for (const file of walk(root)) {
  let orig = readFileSync(file, 'utf8');
  let next = orig;
  next = next.split(sourceA).join(replacementA);
  next = next.split(sourceB).join(replacementB);
  next = next.split(sourceC).join(replacementC);

  // Clean up the stale `let body: unknown;` line that used to precede
  // try { body = await req.json(); ... } — we now declare const body inline.
  next = next.replace(/^\s*let body: unknown;\s*\r?\n/gm, '');

  // Deduplicate imports of readJsonBody.
  if (next.includes("from '@/lib/request-body'")) {
    // Remove every existing import line for readJsonBody; we'll re-add one clean one.
    next = next.replace(/^import \{ readJsonBody \} from '@\/lib\/request-body';\r?\n/gm, '');
    // Inject once after the last existing `import ... from 'next/server'` line,
    // or as the first import if none exists.
    if (/^import .+ from 'next\/server';/m.test(next)) {
      next = next.replace(
        /^(import .+ from 'next\/server';\r?\n)/m,
        "$1import { readJsonBody } from '@/lib/request-body';\n"
      );
    } else {
      next = "import { readJsonBody } from '@/lib/request-body';\n" + next;
    }
  }

  if (next !== orig) {
    writeFileSync(file, next);
    console.log('updated:', file.replace(root, ''));
    changed++;
  }
}
console.log(`\nfiles changed: ${changed}`);

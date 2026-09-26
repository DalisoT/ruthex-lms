// scripts/annotate-map-any.mjs
//
// Sweep all dashboard pages and add `: any` annotations to .map((NAME) => ...)
// callbacks. The Prisma shim returns StubRow = { [key: string]: any } so TS
// can't infer element types for arrays accessed through that indexer. This
// script keeps the build green while the real Drizzle rewrites happen.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('src/app');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = walk(ROOT);
let touched = 0;
let edits = 0;

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  // Match `.map((IDENT) =>` where IDENT is not already annotated.
  // Preserves existing `(IDENT: TYPE)` annotations untouched.
  const re = /\.map\(\s*\(([A-Za-z_$][A-Za-z0-9_$]*)\)\s*=>/g;
  let local = 0;
  const updated = src.replace(re, (match, name) => {
    local += 1;
    return `.map((${name}: any) =>`;
  });
  if (local > 0) {
    fs.writeFileSync(file, updated, 'utf8');
    touched += 1;
    edits += local;
    console.log(`  ${path.relative(process.cwd(), file)}  (+${local})`);
  }
}

console.log(`\nDone. ${edits} annotation(s) added across ${touched} file(s).`);

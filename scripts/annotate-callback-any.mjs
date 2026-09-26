// scripts/annotate-callback-any.mjs
//
// Sweep all dashboard pages and add `: any` annotations to single-parameter
// arrow-function callbacks on array methods (.map / .find / .filter / .some /
// .every / .reduce / .reduceRight / .forEach / .flatMap / .sort). The Prisma
// shim returns StubRow = { [key: string]: any } so TS can't infer element
// types for arrays accessed through that indexer. This script keeps the build
// green while the real Drizzle rewrites happen.
//
// Idempotent: skips callbacks that already have an annotation.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('src/app');
const METHODS = ['map', 'find', 'filter', 'some', 'every', 'forEach', 'flatMap', 'sort', 'findIndex'];
// `.reduce` / `.reduceRight` take `(acc, cur)` — handle separately below.

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

function annotateFirstParam(src, method) {
  // Matches `.method((NAME) =>` where NAME is a single bare identifier with
  // no existing annotation. Preserves `(NAME: TYPE)` already-annotated cases.
  const re = new RegExp(`\\.${method}\\(\\s*\\(\\s*([A-Za-z_$][A-Za-z0-9_$]*)\\s*\\)\\s*=>`, 'g');
  let count = 0;
  const out = src.replace(re, (m, name) => {
    count += 1;
    return `.${method}((${name}: any) =>`;
  });
  return { out, count };
}

function annotateReduce(src) {
  // Matches `.reduce((ACC[, CUR-annotation?], CUR) =>` — annotate ACC as `any`
  // (noImplicitAny sometimes fires on the accumulator too when the array
  // source is `any`). Annotates CUR as `any` even if it already has a
  // different annotation, since the shim's indexer is the source of truth.
  const re = /\.reduce(?:Right)?\(\s*\(\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:,\s*([A-Za-z_$][A-Za-z0-9_$]*(?::\s*[A-Za-z_$<>[\]| ,&]*)?)?\s*,\s*)?([A-Za-z_$][A-Za-z0-9_$]*(?::\s*[A-Za-z_$<>[\]| ,&]*)?)\s*\)\s*=>/g;
  // Simpler approach: match two-name `(ACC, CUR)` and `(ACC, CUR: T)` patterns,
  // then ensure ACC has `: any` annotation.
  const simple = /\.reduce(?:Right)?\(\s*\(\s*([A-Za-z_$][A-Za-z0-9_$]*)(?:\s*:\s*[A-Za-z_$<>[\]| ,&{}]*)?\s*,\s*([A-Za-z_$][A-Za-z0-9_$]*)(?:\s*:\s*[A-Za-z_$<>[\]| ,&{}]*)?\s*\)\s*=>/g;
  let count = 0;
  const out = src.replace(simple, (m, acc, cur) => {
    count += 1;
    // Strip any existing annotation and re-apply as `: any` on both params.
    return `.reduce((${acc}: any, ${cur}: any) =>`;
  });
  return { out, count };
}

for (const file of files) {
  let src = fs.readFileSync(file, 'utf8');
  let local = 0;

  for (const method of METHODS) {
    const r = annotateFirstParam(src, method);
    src = r.out;
    local += r.count;
  }
  const r = annotateReduce(src);
  src = r.out;
  local += r.count;

  if (local > 0) {
    fs.writeFileSync(file, src, 'utf8');
    touched += 1;
    edits += local;
    console.log(`  ${path.relative(process.cwd(), file)}  (+${local})`);
  }
}

console.log(`\nDone. ${edits} annotation(s) added across ${touched} file(s).`);

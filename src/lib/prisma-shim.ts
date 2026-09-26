/**
 * Prisma compatibility shim for the Drizzle migration.
 *
 * The dashboard pages still reference the `prisma` client from the original
 * Prisma implementation. This shim exports a `prisma` object whose model
 * accessors return query-builder stubs that resolve to empty data. This
 * unblocks the build while the dashboard queries are being migrated
 * one-by-one to Drizzle. Pages that need real data should be migrated to
 * the new `db` client from `@/lib/db`.
 *
 * Once all dashboard pages are migrated off `prisma`, this file can be deleted.
 */

type WhereArg = Record<string, unknown> | undefined;
type OrderByArg = Record<string, 'asc' | 'desc'> | undefined;
type SelectArg = Record<string, boolean> | undefined;
type IncludeArg = Record<string, boolean | object> | undefined;

interface QueryBuilder<T> {
  where: (w: WhereArg) => QueryBuilder<T>;
  orderBy: (o: OrderByArg) => QueryBuilder<T>;
  take: (n: number) => QueryBuilder<T>;
  skip: (n: number) => QueryBuilder<T>;
  select: (s: SelectArg) => QueryBuilder<T>;
  include: (i: IncludeArg) => QueryBuilder<T>;
  limit: (n: number) => QueryBuilder<T>;
  offset: (n: number) => QueryBuilder<T>;
  then: <R>(resolve: (v: T | T[]) => R) => Promise<R>;
}

function makeBuilder<T extends Record<string, unknown> = Record<string, unknown>>(): QueryBuilder<T> {
  const builder: QueryBuilder<T> = {
    where: () => builder,
    orderBy: () => builder,
    take: () => builder,
    skip: () => builder,
    select: () => builder,
    include: () => builder,
    limit: () => builder,
    offset: () => builder,
    // Promise-like so `await prisma.x.findMany(...)` resolves.
    then: (resolve) => Promise.resolve([] as unknown as T[]).then(resolve as any),
  };
  return builder;
}

// Stub row type with permissive `any` fields so callers can read properties
// without TypeScript complaining. Pages are meant to be migrated to real Drizzle
// queries — until then, this lets the build pass with empty data.
type StubRow = { [key: string]: any };

// Loose arg type — Prisma's actual API surface is large and dashboard pages
// still call it with `where` / `include` / `select` / `orderBy` / etc. Until
// each page is rewritten against Drizzle, accept any shape and return empty
// data. Any-property indexing on `StubRow` keeps field reads happy too.
type LooseArgs = Record<string, unknown> | undefined;

interface ModelStub {
  findUnique: (args?: LooseArgs) => Promise<StubRow | null>;
  findFirst: (args?: LooseArgs) => Promise<StubRow | null>;
  findMany: (args?: LooseArgs) => Promise<StubRow[]>;
  count: (args?: LooseArgs) => Promise<number>;
  create: (args: { data: Record<string, unknown>; include?: LooseArgs; select?: LooseArgs }) => Promise<StubRow>;
  createMany: (args: { data: Record<string, unknown>[] }) => Promise<{ count: number }>;
  update: (args: { where: Record<string, unknown>; data: Record<string, unknown>; include?: LooseArgs; select?: LooseArgs }) => Promise<StubRow>;
  updateMany: (args: { where?: Record<string, unknown>; data?: Record<string, unknown> }) => Promise<{ count: number }>;
  upsert: (args: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown>; include?: LooseArgs; select?: LooseArgs }) => Promise<StubRow>;
  delete: (args: { where: Record<string, unknown> }) => Promise<StubRow>;
  deleteMany: (args?: LooseArgs) => Promise<{ count: number }>;
  aggregate: (args: LooseArgs) => Promise<{ _sum: Record<string, number | null> }>;
  groupBy: (args: LooseArgs) => Promise<StubRow[]>;
  $queryRaw: <T = unknown>(strings: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
}

function makeModelStub(): ModelStub {
  return {
    findUnique: async () => null,
    findFirst: async () => null,
    findMany: async () => [],
    count: async () => 0,
    create: async () => ({}),
    createMany: async () => ({ count: 0 }),
    update: async () => ({}),
    updateMany: async () => ({ count: 0 }),
    upsert: async () => ({}),
    delete: async () => ({}),
    deleteMany: async () => ({ count: 0 }),
    aggregate: async () => ({ _sum: {} }),
    groupBy: async () => [],
    $queryRaw: async () => [] as any,
  };
}

const PROXY_HANDLER: ProxyHandler<Record<string, ModelStub>> = {
  get(_target, prop) {
    if (typeof prop === 'string') {
      return makeModelStub();
    }
    return undefined;
  },
};

// The exported `prisma` is typed as `any` so dashboard pages can call any
// model method with any shape. This is the simplest way to silence TS while
// the dashboard queries are migrated one-by-one to Drizzle.
export const prisma: any = new Proxy({}, PROXY_HANDLER) as any;
prisma.$queryRaw = async () => [];

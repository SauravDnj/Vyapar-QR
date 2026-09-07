/**
 * Emits `generated/models.ts` — the type surface the API used to get from
 * `@prisma/client`. Generating it from `schema.prisma` (rather than hand-
 * maintaining 33 interfaces) keeps the types honest when the schema changes.
 *
 *   pnpm --filter api db:generate
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { parseSchema } from './schema/parser';

import type { FieldMeta, SchemaMeta } from './schema/types';

const SCALAR_TS: Record<string, string> = {
  String: 'string',
  Int: 'number',
  Float: 'number',
  Boolean: 'boolean',
  DateTime: 'Date',
  // Decimal is persisted as a JS number: the only consumers call `Number(x)`
  // or `x.toString()`, both of which a number satisfies.
  Decimal: 'number',
  Json: 'Prisma.JsonValue',
  BigInt: 'bigint',
};

function tsType(field: FieldMeta): string {
  let base =
    field.kind === 'scalar' ? (SCALAR_TS[field.type] ?? 'unknown') : field.type;
  if (field.isList) base = `${base}[]`;
  if (field.isOptional) base = `${base} | null`;
  return base;
}

const PRELUDE = `/** Query arguments.
 *
 * Filter and ordering shapes stay \`unknown\`: callers only ever build these
 * objects, never read them back, so \`unknown\` accepts every construction
 * without leaking \`any\` into the rest of the codebase. The JSON engine
 * validates them at runtime and throws on anything it cannot honour.
 */
export interface QueryArgs {
  where?: unknown;
  orderBy?: unknown;
  distinct?: unknown;
  skip?: number;
  take?: number;
  select?: object;
  include?: object;
  data?: unknown;
  create?: unknown;
  update?: unknown;
  by?: unknown;
  _count?: unknown;
  _sum?: unknown;
  _avg?: unknown;
  _min?: unknown;
  _max?: unknown;
  skipDuplicates?: boolean;
}

/** Phantom markers describing a relation's cardinality. Never constructed at
 * runtime — they exist only so the payload types below can tell a to-one from
 * a to-many, and can find the related model's own relation map to recurse into.
 */
export type ToOne<T, R> = { readonly __one: [T, R] };
export type ToOneNullable<T, R> = { readonly __oneNullable: [T, R] };
export type ToMany<T, R> = { readonly __many: [T, R] };

/** Resolves one relation against the argument it was requested with. An
 * argument of \`true\` yields the bare model; a nested \`{ include }\` recurses. */
export type ResolveRelation<Rel, Arg> =
  Rel extends ToMany<infer T, infer R>
    ? Payload<T, R, Arg>[]
    : Rel extends ToOneNullable<infer T, infer R>
      ? Payload<T, R, Arg> | null
      : Rel extends ToOne<infer T, infer R>
        ? Payload<T, R, Arg>
        : Rel;

/**
 * The relations an \`include\`/\`select\` actually asked for, resolved from the
 * argument literal so \`include: { user: true }\` yields \`{ user: User }\` and
 * nested includes resolve to any depth.
 *
 * Known limitation versus Prisma's generated client: a \`select\` widens to the
 * full model rather than only the selected scalars, so reading a field you did
 * not select type-checks but is \`undefined\` at runtime. Relations resolve
 * exactly; only scalar narrowing is approximate.
 */
export type RelationPayload<R, A> = A extends { include: infer I }
  ? { [K in Extract<keyof I, keyof R>]: ResolveRelation<R[K], I[K]> }
  : A extends { select: infer S }
    ? { [K in Extract<keyof S, keyof R>]: ResolveRelation<R[K], S[K]> }
    : unknown;

export type Payload<T, R, A> = T & RelationPayload<R, A>;

/** Every relation of \`R\` resolved to its plain model type. Used by the
 * \`*GetPayload\` aliases, which describe "the model plus whatever relations
 * were loaded" without knowing which ones a given call asked for. */
export type ResolvedRelations<R> = { [K in keyof R]: ResolveRelation<R[K], true> };

/** The subset of the Prisma delegate API the JSON engine implements. */
export interface JsonDelegate<T, R> {
  findMany<A extends QueryArgs = QueryArgs>(args?: A): Promise<Payload<T, R, A>[]>;
  findFirst<A extends QueryArgs = QueryArgs>(args?: A): Promise<Payload<T, R, A> | null>;
  findFirstOrThrow<A extends QueryArgs = QueryArgs>(args?: A): Promise<Payload<T, R, A>>;
  findUnique<A extends QueryArgs = QueryArgs>(args: A): Promise<Payload<T, R, A> | null>;
  findUniqueOrThrow<A extends QueryArgs = QueryArgs>(args: A): Promise<Payload<T, R, A>>;
  create<A extends QueryArgs = QueryArgs>(args: A): Promise<Payload<T, R, A>>;
  createMany(args: QueryArgs): Promise<{ count: number }>;
  update<A extends QueryArgs = QueryArgs>(args: A): Promise<Payload<T, R, A>>;
  updateMany(args: QueryArgs): Promise<{ count: number }>;
  upsert<A extends QueryArgs = QueryArgs>(args: A): Promise<Payload<T, R, A>>;
  delete<A extends QueryArgs = QueryArgs>(args: A): Promise<Payload<T, R, A>>;
  deleteMany(args?: QueryArgs): Promise<{ count: number }>;
  count(args?: QueryArgs): Promise<number>;
  aggregate(args?: QueryArgs): Promise<Record<string, Record<string, number> | number>>;
  /** The row shape depends on \`by\` plus the aggregate selectors, which this
   * type layer does not infer — pass the expected shape explicitly. */
  groupBy<Result = Record<string, unknown>>(args: QueryArgs): Promise<Result[]>;
}
`;

export function generate(schema: SchemaMeta): string {
  const out: string[] = [];

  out.push('/* eslint-disable */');
  out.push('// AUTO-GENERATED by src/jsondb/generate-types.ts — do not edit by hand.');
  out.push('// Regenerate with: pnpm --filter api db:generate');
  out.push('');

  // ── enums: emitted as both a type and a value, matching Prisma ──────────
  for (const [name, members] of schema.enums) {
    out.push(`export type ${name} = ${members.map((m) => `'${m}'`).join(' | ')};`);
    out.push(`export const ${name} = {`);
    for (const member of members) out.push(`  ${member}: '${member}',`);
    out.push('} as const;');
    out.push('');
  }

  // ── model interfaces: scalar and enum fields only ───────────────────────
  for (const model of schema.models.values()) {
    out.push(`export interface ${model.name} {`);
    for (const field of model.fields) {
      if (field.kind === 'object') continue;
      out.push(`  ${field.name}: ${tsType(field)};`);
    }
    out.push('}');
    out.push('');
  }

  // ── relation maps ───────────────────────────────────────────────────────
  // Entries are phantom markers pairing the related model with its own
  // relation map, which is what lets a nested `include` recurse (e.g.
  // `include: { subscription: { include: { plan: true } } }`).
  for (const model of schema.models.values()) {
    out.push(`export interface ${model.name}Relations {`);
    for (const field of model.fields) {
      if (field.kind !== 'object') continue;
      const marker = field.isList
        ? 'ToMany'
        : field.isOptional
          ? 'ToOneNullable'
          : 'ToOne';
      out.push(`  ${field.name}: ${marker}<${field.type}, ${field.type}Relations>;`);
    }
    // `select: { _count: { select: { leads: true } } }` resolves through here.
    out.push('  _count: Record<string, number>;');
    out.push('}');
    out.push('');
  }

  // ── Prisma namespace compatibility shims ────────────────────────────────
  out.push('export namespace Prisma {');
  out.push('  export type JsonValue =');
  out.push('    | string');
  out.push('    | number');
  out.push('    | boolean');
  out.push('    | null');
  out.push('    | JsonValue[]');
  out.push('    | { [key: string]: JsonValue };');
  out.push('  export type InputJsonValue = JsonValue;');
  out.push('  export type JsonObject = { [key: string]: JsonValue };');
  out.push('  /** Decimal columns round-trip as plain numbers in the JSON store. */');
  out.push('  export type Decimal = number;');
  out.push('');
  for (const model of schema.models.values()) {
    for (const suffix of [
      'WhereInput',
      'WhereUniqueInput',
      'CreateInput',
      'UpdateInput',
      'OrderByWithRelationInput',
      'Select',
      'Include',
    ]) {
      out.push(`  export type ${model.name}${suffix} = Record<string, unknown>;`);
    }
    out.push(
      `  export type ${model.name}GetPayload<T = unknown> = ${model.name} & Partial<ResolvedRelations<${model.name}Relations>>;`,
    );
  }
  out.push('');
  out.push('  /**');
  out.push("   * Kept so existing `instanceof` / `err.code === 'P2002'` branches work.");
  out.push('   * The JSON engine throws `JsonDbError`, which carries the same `code`.');
  out.push('   */');
  out.push('  export class PrismaClientKnownRequestError extends Error {');
  out.push('    constructor(');
  out.push('      message: string,');
  out.push('      readonly code: string,');
  out.push('      readonly meta?: Record<string, unknown>,');
  out.push('    ) {');
  out.push('      super(message);');
  out.push("      this.name = 'PrismaClientKnownRequestError';");
  out.push('    }');
  out.push('  }');
  out.push('}');
  out.push('');

  out.push(PRELUDE);

  out.push('/** Delegate property names, as exposed on the client. */');
  out.push('export interface JsonDbDelegates {');
  for (const model of schema.models.values()) {
    out.push(`  ${model.delegate}: JsonDelegate<${model.name}, ${model.name}Relations>;`);
  }
  out.push('}');
  out.push('');

  return out.join('\n');
}

if (require.main === module) {
  const schemaPath =
    process.argv[2] ?? join(__dirname, '..', '..', 'prisma', 'schema.prisma');
  const target = join(__dirname, 'generated', 'models.ts');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, generate(parseSchema(schemaPath)), 'utf8');
   
  console.log(`jsondb: wrote ${target}`);
}

import { randomUUID } from 'node:crypto';

import { NotFoundError, UniqueConstraintError } from './errors';
import { applyDistinct, applyOrderBy, projectRow } from './query/shape';
import { matchesWhere, uniqueKeyOf, type Row } from './query/where';
import { reviveRow, serializeRow } from './serialize';

import type { FieldMeta, ModelMeta, SchemaMeta } from './schema/types';
import type { JsonStore } from './store';

export type Args = Record<string, unknown>;

/** Minimal surface the delegate needs from the client, to avoid a cycle. */
export interface DelegateHost {
  delegateFor(modelName: string): ModelDelegate;
}

function applyAtomicOps(current: unknown, update: unknown): unknown {
  if (
    update === null ||
    typeof update !== 'object' ||
    update instanceof Date ||
    Array.isArray(update)
  ) {
    return update;
  }
  const ops = update as Record<string, unknown>;
  if ('set' in ops) return ops.set;
  const base = typeof current === 'number' ? current : 0;
  if ('increment' in ops) return base + Number(ops.increment);
  if ('decrement' in ops) return base - Number(ops.decrement);
  if ('multiply' in ops) return base * Number(ops.multiply);
  if ('divide' in ops) return base / Number(ops.divide);
  // A plain object on a Json field is a value, not an atomic operation.
  return update;
}

/**
 * One model's worth of the Prisma Client API, backed by a JSON collection.
 * Method names, argument shapes and return shapes match Prisma closely enough
 * that the 41 services above it need no changes.
 */
export class ModelDelegate {
  constructor(
    private readonly model: ModelMeta,
    private readonly schema: SchemaMeta,
    private readonly store: JsonStore,
    private readonly host: DelegateHost,
  ) {}

  private get collection(): string {
    return this.model.delegate;
  }

  // ── relation resolution ────────────────────────────────────────────────

  private async resolveRelation(
    parent: Row,
    fieldName: string,
    nested: Args,
  ): Promise<unknown> {
    if (fieldName === '_count') {
      const select = (nested.select ?? nested) as Args;
      const counts: Record<string, number> = {};
      for (const key of Object.keys(select)) {
        const field = this.model.fieldsByName.get(key);
        if (!field?.backRelation) continue;
        const target = this.schema.models.get(field.backRelation.model);
        const owner = target?.fieldsByName.get(field.backRelation.field);
        if (!target || !owner?.relation) continue;
        const rel = owner.relation;
        const rows = await this.store.load(target.delegate);
        counts[key] = rows.filter((r) =>
          rel.fields.every(
            (fk, i) => r[fk] != null && r[fk] === parent[rel.references[i]],
          ),
        ).length;
      }
      return counts;
    }

    const field = this.model.fieldsByName.get(fieldName);
    if (field?.kind !== 'object') return undefined;

    const targetModel = this.schema.models.get(field.type);
    if (!targetModel) return field.isList ? [] : null;
    const targetDelegate = this.host.delegateFor(targetModel.name);
    const rows = await this.store.load(targetModel.delegate);

    let matched: Row[];
    if (field.relation) {
      // This side holds the foreign key.
      const rel = field.relation;
      matched = rows.filter((r) =>
        rel.fields.every(
          (fk, i) => parent[fk] != null && r[rel.references[i]] === parent[fk],
        ),
      );
    } else if (field.backRelation) {
      const owner = targetModel.fieldsByName.get(field.backRelation.field);
      if (!owner?.relation) return field.isList ? [] : null;
      const rel = owner.relation;
      matched = rows.filter((r) =>
        rel.fields.every(
          (fk, i) => r[fk] != null && r[fk] === parent[rel.references[i]],
        ),
      );
    } else {
      return field.isList ? [] : null;
    }

    const revived = matched.map((r) => reviveRow(r, targetModel));
    const filtered = revived.filter((r) =>
      matchesWhere(r, nested.where as Args | undefined, targetModel),
    );
    const ordered = applyOrderBy(filtered, nested.orderBy, targetModel);
    const skip = (nested.skip as number | undefined) ?? 0;
    const sliced = ordered.slice(
      skip,
      nested.take != null ? skip + (nested.take as number) : undefined,
    );

    const projected: Row[] = [];
    for (const r of sliced) projected.push(await targetDelegate.project(r, nested));

    return field.isList ? projected : (projected[0] ?? null);
  }

  /**
   * Shapes a row per `select`/`include`. Relations are resolved first (they
   * need async store access) and then handed to the synchronous projector.
   */
  async project(row: Row, args: Args): Promise<Row> {
    const select = args.select as Args | undefined;
    const include = args.include as Args | undefined;
    if (!select && !include) {
      return projectRow(row, {}, this.model, this.schema, () => undefined);
    }

    const wanted = new Map<string, Args>();
    for (const [key, value] of Object.entries({ ...select, ...include })) {
      if (!value) continue;
      const field = this.model.fieldsByName.get(key);
      if (field?.kind === 'object' || key === '_count') {
        wanted.set(key, typeof value === 'object' ? (value as Args) : {});
      }
    }

    const resolved = new Map<string, unknown>();
    for (const [key, nested] of wanted) {
      resolved.set(key, await this.resolveRelation(row, key, nested));
    }

    return projectRow(row, { select, include }, this.model, this.schema, (_p, name) =>
      resolved.get(name),
    );
  }

  // ── reads ──────────────────────────────────────────────────────────────

  private async candidates(args: Args): Promise<Row[]> {
    const raw = await this.store.load(this.collection);
    const revived = raw.map((r) => reviveRow(r, this.model));
    const filtered = revived.filter((r) =>
      matchesWhere(r, args.where as Args | undefined, this.model),
    );
    const ordered = applyOrderBy(filtered, args.orderBy, this.model);
    return applyDistinct(ordered, args.distinct);
  }

  async findMany(args: Args = {}): Promise<Row[]> {
    const rows = await this.candidates(args);
    const skip = (args.skip as number | undefined) ?? 0;
    const sliced = rows.slice(
      skip,
      args.take != null ? skip + (args.take as number) : undefined,
    );
    const out: Row[] = [];
    for (const r of sliced) out.push(await this.project(r, args));
    return out;
  }

  async findFirst(args: Args = {}): Promise<Row | null> {
    const rows = await this.findMany({ ...args, take: 1 });
    return rows.length > 0 ? rows[0] : null;
  }

  async findFirstOrThrow(args: Args = {}): Promise<Row> {
    const row = await this.findFirst(args);
    if (!row) throw new NotFoundError(this.model.name);
    return row;
  }

  async findUnique(args: Args): Promise<Row | null> {
    return this.findFirst({
      ...args,
      where: this.flattenUniqueWhere((args.where ?? {}) as Args),
    });
  }

  async findUniqueOrThrow(args: Args): Promise<Row> {
    const row = await this.findUnique(args);
    if (!row) throw new NotFoundError(this.model.name);
    return row;
  }

  /**
   * Turns a composite-unique `where` (`{ clientId_code: { … } }`) into plain
   * field equality the generic matcher understands.
   */
  private flattenUniqueWhere(where: Args): Args {
    const key = uniqueKeyOf(where, this.model);
    if (!key) return where;
    // Drop the composite-unique wrapper keys (`clientId_code`) and replace
    // them with the plain field equality the generic matcher understands.
    const compositeKeys = new Set(
      this.model.uniques.filter((u) => u.length > 1).map((u) => u.join('_')),
    );
    const flat: Args = Object.fromEntries(
      Object.entries(where).filter(([name]) => !compositeKeys.has(name)),
    );
    for (const { field, value } of key) flat[field] = value;
    return flat;
  }

  async count(args: Args = {}): Promise<number> {
    const rows = await this.candidates(args);
    const skip = (args.skip as number | undefined) ?? 0;
    return rows.slice(
      skip,
      args.take != null ? skip + (args.take as number) : undefined,
    ).length;
  }

  /**
   * Prisma's `_count` has two shapes: `true` yields a plain row count, while
   * an object such as `{ _all: true }` or `{ email: true }` yields one count
   * per requested key (`_all` = all rows, a field = rows where it is non-null).
   * Returning a bare number for the object form would silently read back as
   * `undefined` at call sites doing `row._count._all`.
   */
  private static countValue(spec: unknown, bucket: Row[]): number | Record<string, number> {
    if (spec === true) return bucket.length;
    if (spec && typeof spec === 'object') {
      const acc: Record<string, number> = {};
      for (const [field, wanted] of Object.entries(spec as Record<string, unknown>)) {
        if (!wanted) continue;
        acc[field] =
          field === '_all' ? bucket.length : bucket.filter((r) => r[field] != null).length;
      }
      return acc;
    }
    return bucket.length;
  }

  private static reduce(op: string, values: number[]): number | null {
    if (op === '_sum') return values.reduce((a, b) => a + b, 0);
    if (!values.length) return null;
    if (op === '_avg') return values.reduce((a, b) => a + b, 0) / values.length;
    if (op === '_min') return Math.min(...values);
    if (op === '_max') return Math.max(...values);
    return null;
  }

  private static aggregateInto(target: Row, args: Args, bucket: Row[]): void {
    for (const op of ['_sum', '_avg', '_min', '_max'] as const) {
      const spec = args[op] as Args | undefined;
      if (!spec) continue;
      const acc: Row = {};
      for (const field of Object.keys(spec)) {
        if (!spec[field]) continue;
        acc[field] = ModelDelegate.reduce(
          op,
          bucket.map((r) => Number(r[field] ?? 0)),
        );
      }
      target[op] = acc;
    }
  }

  async aggregate(args: Args = {}): Promise<Row> {
    const rows = await this.candidates(args);
    const out: Row = {};
    if (args._count) out._count = ModelDelegate.countValue(args._count, rows);
    ModelDelegate.aggregateInto(out, args, rows);
    return out;
  }

  async groupBy(args: Args): Promise<Row[]> {
    const rows = await this.candidates(args);
    const by = (Array.isArray(args.by) ? args.by : [args.by]) as string[];

    const groups = new Map<string, Row[]>();
    for (const row of rows) {
      const key = JSON.stringify(by.map((f) => row[f] ?? null));
      const bucket = groups.get(key);
      if (bucket) bucket.push(row);
      else groups.set(key, [row]);
    }

    const out: Row[] = [];
    for (const [key, bucket] of groups) {
      const values = JSON.parse(key) as unknown[];
      const entry: Row = {};
      by.forEach((f, i) => {
        entry[f] = values[i];
      });
      if (args._count) entry._count = ModelDelegate.countValue(args._count, bucket);
      ModelDelegate.aggregateInto(entry, args, bucket);
      out.push(entry);
    }
    return applyOrderBy(out, args.orderBy, this.model);
  }

  // ── writes ─────────────────────────────────────────────────────────────

  private buildCreateRow(data: Args): Row {
    const row: Row = {};
    for (const field of this.model.fields) {
      if (field.kind === 'object') continue;

      if (data[field.name] !== undefined) {
        row[field.name] = data[field.name];
        continue;
      }
      if (field.isUpdatedAt || field.default?.kind === 'now') {
        row[field.name] = new Date();
        continue;
      }
      if (field.default) {
        row[field.name] =
          field.default.kind === 'uuid' ? randomUUID() : field.default.value;
        continue;
      }
      row[field.name] = field.isList ? [] : null;
    }
    return row;
  }

  private assertUnique(rows: Row[], candidate: Row, ignoreId?: unknown): void {
    const idName = this.model.idField.name;
    for (const unique of this.model.uniques) {
      if (unique.some((f) => candidate[f] == null)) continue;
      const clash = rows.find(
        (r) =>
          (ignoreId === undefined || r[idName] !== ignoreId) &&
          unique.every((f) => r[f] === candidate[f]),
      );
      if (clash) throw new UniqueConstraintError(this.model.name, unique);
    }
  }

  /**
   * Splits `data` into plain fields and nested relation writes
   * (`agency: { create: {...} }`).
   *
   * Relation keys silently disappearing would be data loss — an agency signup
   * that creates the user but not the agency — so anything here that isn't a
   * supported nested `create` raises instead.
   */
  private splitNestedWrites(data: Args): { scalars: Args; nested: [FieldMeta, Args[]][] } {
    const scalars: Args = {};
    const nested: [FieldMeta, Args[]][] = [];

    for (const [key, value] of Object.entries(data)) {
      const field = this.model.fieldsByName.get(key);
      if (field?.kind !== 'object') {
        scalars[key] = value;
        continue;
      }

      const op = value as { create?: unknown } | null;
      if (!op || typeof op !== 'object' || op.create === undefined) {
        throw new Error(
          `jsondb: unsupported nested write on "${this.model.name}.${key}" — ` +
            'only `{ create: ... }` is implemented',
        );
      }
      if (!field.backRelation) {
        throw new Error(
          `jsondb: nested create on "${this.model.name}.${key}" is not supported — ` +
            'this side holds the foreign key, so create the related row first ' +
            'and assign its id',
        );
      }
      nested.push([field, (Array.isArray(op.create) ? op.create : [op.create]) as Args[]]);
    }

    return { scalars, nested };
  }

  async create(args: Args): Promise<Row> {
    const { scalars, nested } = this.splitNestedWrites((args.data ?? {}) as Args);

    const created = await this.store.mutate(this.collection, (rows) => {
      const stored = serializeRow(this.buildCreateRow(scalars), this.model);
      this.assertUnique(rows, stored);
      return { rows: [...rows, stored], result: stored };
    });

    // Children carry the foreign key, so they're created after the parent and
    // pointed back at it.
    for (const [field, children] of nested) {
      const backRelation = field.backRelation;
      if (!backRelation) continue;
      const targetModel = this.schema.models.get(backRelation.model);
      const owner = targetModel?.fieldsByName.get(backRelation.field);
      if (!targetModel || !owner?.relation) continue;

      const rel = owner.relation;
      const delegate = this.host.delegateFor(targetModel.name);
      for (const child of children) {
        const withKey: Args = { ...child };
        rel.fields.forEach((fk, i) => {
          withKey[fk] = created[rel.references[i]];
        });
        await delegate.create({ data: withKey });
      }
    }

    return this.project(reviveRow(created, this.model), args);
  }

  async createMany(args: Args): Promise<{ count: number }> {
    const items = (Array.isArray(args.data) ? args.data : [args.data]) as Args[];
    return this.store.mutate(this.collection, (rows) => {
      const next = [...rows];
      for (const item of items) {
        const stored = serializeRow(this.buildCreateRow(item), this.model);
        if (args.skipDuplicates) {
          try {
            this.assertUnique(next, stored);
          } catch {
            continue;
          }
        } else {
          this.assertUnique(next, stored);
        }
        next.push(stored);
      }
      return { rows: next, result: { count: next.length - rows.length } };
    });
  }

  private mergeUpdate(existing: Row, data: Args): Row {
    const next: Row = { ...existing };
    for (const field of this.model.fields) {
      if (field.kind === 'object') continue;
      if (data[field.name] !== undefined) {
        next[field.name] = applyAtomicOps(existing[field.name], data[field.name]);
      } else if (field.isUpdatedAt) {
        next[field.name] = new Date();
      }
    }
    return serializeRow(next, this.model);
  }

  async update(args: Args): Promise<Row> {
    const where = this.flattenUniqueWhere((args.where ?? {}) as Args);
    const data = (args.data ?? {}) as Args;

    const updated = await this.store.mutate(this.collection, (rows) => {
      const index = rows.findIndex((r) =>
        matchesWhere(reviveRow(r, this.model), where, this.model),
      );
      if (index === -1) throw new NotFoundError(this.model.name);
      const next = this.mergeUpdate(rows[index], data);
      this.assertUnique(rows, next, rows[index][this.model.idField.name]);
      const copy = [...rows];
      copy[index] = next;
      return { rows: copy, result: next };
    });
    return this.project(reviveRow(updated, this.model), args);
  }

  async updateMany(args: Args): Promise<{ count: number }> {
    const where = (args.where ?? {}) as Args;
    const data = (args.data ?? {}) as Args;
    return this.store.mutate(this.collection, (rows) => {
      let count = 0;
      const next = rows.map((r) => {
        if (!matchesWhere(reviveRow(r, this.model), where, this.model)) return r;
        count++;
        return this.mergeUpdate(r, data);
      });
      return { rows: next, result: { count } };
    });
  }

  async upsert(args: Args): Promise<Row> {
    const where = this.flattenUniqueWhere((args.where ?? {}) as Args);
    const existing = await this.findFirst({ where });
    if (existing) {
      return this.update({ ...args, where, data: (args.update ?? {}) });
    }
    // The unique `where` identifies the row, so its fields seed the create —
    // matching Prisma, where `where` values are implied on the created row.
    const seed: Args = {};
    for (const { field, value } of uniqueKeyOf(where, this.model) ?? []) {
      seed[field] = value;
    }
    return this.create({ ...args, data: { ...seed, ...((args.create ?? {}) as Args) } });
  }

  /** Applies `onDelete: Cascade` / `SetNull` to rows referencing `deleted`. */
  private async cascade(deleted: Row[]): Promise<void> {
    if (!deleted.length) return;

    for (const model of this.schema.models.values()) {
      for (const field of model.fields) {
        const rel = field.relation;
        if (!rel || field.type !== this.model.name) continue;
        if (rel.onDelete !== 'Cascade' && rel.onDelete !== 'SetNull') continue;

        const delegate = this.host.delegateFor(model.name);
        for (const row of deleted) {
          const where: Args = {};
          rel.fields.forEach((fk, i) => {
            where[fk] = row[rel.references[i]];
          });
          if (Object.values(where).some((v) => v == null)) continue;

          if (rel.onDelete === 'Cascade') {
            await delegate.deleteMany({ where });
          } else {
            const data: Args = {};
            rel.fields.forEach((fk) => {
              data[fk] = null;
            });
            await delegate.updateMany({ where, data });
          }
        }
      }
    }
  }

  async delete(args: Args): Promise<Row> {
    const where = this.flattenUniqueWhere((args.where ?? {}) as Args);
    const removed = await this.store.mutate(this.collection, (rows) => {
      const index = rows.findIndex((r) =>
        matchesWhere(reviveRow(r, this.model), where, this.model),
      );
      if (index === -1) throw new NotFoundError(this.model.name);
      const copy = [...rows];
      const [row] = copy.splice(index, 1);
      return { rows: copy, result: row };
    });
    await this.cascade([removed]);
    return this.project(reviveRow(removed, this.model), args);
  }

  async deleteMany(args: Args = {}): Promise<{ count: number }> {
    const where = (args.where ?? {}) as Args;
    const removed = await this.store.mutate(this.collection, (rows) => {
      const keep: Row[] = [];
      const gone: Row[] = [];
      for (const r of rows) {
        if (matchesWhere(reviveRow(r, this.model), where, this.model)) gone.push(r);
        else keep.push(r);
      }
      return { rows: keep, result: gone };
    });
    await this.cascade(removed);
    return { count: removed.length };
  }
}

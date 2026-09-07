import type { Row } from './where';
import type { ModelMeta, SchemaMeta } from '../schema/types';

/** Normalises `orderBy` into the list form and applies it as a stable sort. */
export function applyOrderBy(
  rows: Row[],
  orderBy: unknown,
  model: ModelMeta,
): Row[] {
  if (!orderBy) return rows;
  const clauses = (Array.isArray(orderBy) ? orderBy : [orderBy]) as Record<
    string,
    'asc' | 'desc'
  >[];

  return [...rows].sort((a, b) => {
    for (const clause of clauses) {
      for (const [field, direction] of Object.entries(clause)) {
        const meta = model.fieldsByName.get(field);
        const norm = (v: unknown) => {
          if (v == null) return null;
          if (meta?.type === 'DateTime') return new Date(v as string).getTime();
          if (meta?.type === 'Decimal') return Number(v);
          return v as string | number;
        };
        const av = norm(a[field]);
        const bv = norm(b[field]);
        // Nulls sort last regardless of direction, matching Prisma on MySQL.
        if (av == null && bv == null) continue;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (av === bv) continue;
        const cmp = av < bv ? -1 : 1;
        return direction === 'desc' ? -cmp : cmp;
      }
    }
    return 0;
  });
}

export function applyDistinct(rows: Row[], distinct: unknown): Row[] {
  if (!distinct) return rows;
  const fields = (Array.isArray(distinct) ? distinct : [distinct]) as string[];
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = JSON.stringify(fields.map((f) => row[f] ?? null));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Applies `select` / `include` to a row, recursing into relations.
 *
 * `resolveRelation` is injected rather than imported so this module stays free
 * of the store: the client owns collection access and passes a reader in.
 */
export function projectRow(
  row: Row,
  args: { select?: Record<string, unknown>; include?: Record<string, unknown> },
  model: ModelMeta,
  schema: SchemaMeta,
  resolveRelation: (
    parent: Row,
    fieldName: string,
    model: ModelMeta,
    nested: Record<string, unknown>,
  ) => unknown,
): Row {
  const { select, include } = args;

  let out: Row;
  if (select) {
    out = {};
    for (const [key, value] of Object.entries(select)) {
      if (!value) continue;
      const field = model.fieldsByName.get(key);
      if (field?.kind === 'object') {
        const nested = typeof value === 'object' ? (value as Record<string, unknown>) : {};
        out[key] = resolveRelation(row, key, model, nested);
      } else if (key === '_count') {
        out[key] = resolveRelation(row, '_count', model, value as Record<string, unknown>);
      } else {
        out[key] = row[key];
      }
    }
  } else {
    // Default projection: every scalar/enum field, no relations.
    out = {};
    for (const field of model.fields) {
      if (field.kind !== 'object') out[field.name] = row[field.name];
    }
  }

  if (include) {
    for (const [key, value] of Object.entries(include)) {
      if (!value) continue;
      const nested = typeof value === 'object' ? (value as Record<string, unknown>) : {};
      out[key] = resolveRelation(row, key, model, nested);
    }
  }

  return out;
}

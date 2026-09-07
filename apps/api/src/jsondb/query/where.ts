import type { FieldMeta, ModelMeta } from '../schema/types';

export type Row = Record<string, unknown>;

/**
 * Prisma persists DateTime as a Date; the JSON store persists an ISO string.
 * Comparisons normalise both sides so `{ gte: new Date() }` works against
 * stored strings without every caller having to care.
 */
function comparable(value: unknown, field?: FieldMeta): unknown {
  if (value instanceof Date) return value.getTime();
  if (field?.type === 'DateTime' && typeof value === 'string') {
    return new Date(value).getTime();
  }
  if (field?.type === 'Decimal' && typeof value === 'string') {
    return Number(value);
  }
  return value;
}

const UNSUPPORTED = new Set(['some', 'every', 'none', 'is', 'isNot', 'search']);

function matchCondition(
  actual: unknown,
  condition: unknown,
  field: FieldMeta | undefined,
): boolean {
  // A non-object condition (or a Date/null) is shorthand for `equals`.
  if (
    condition === null ||
    typeof condition !== 'object' ||
    condition instanceof Date ||
    Array.isArray(condition)
  ) {
    return comparable(actual, field) === comparable(condition, field);
  }

  const ops = condition as Record<string, unknown>;
  const insensitive = ops.mode === 'insensitive';
  const str = (v: unknown) => {
    // Only strings and primitives reach here; an object operand would be a
    // caller bug, and stringifying it to '[object Object]' would silently
    // never match rather than failing.
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return insensitive ? v.toLowerCase() : v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    throw new Error(`jsondb: string operator received a non-primitive operand`);
  };

  for (const [op, expected] of Object.entries(ops)) {
    if (op === 'mode') continue;
    if (UNSUPPORTED.has(op)) {
      throw new Error(
        `jsondb: filter operator "${op}" is not supported by the JSON engine`,
      );
    }
    switch (op) {
      case 'equals':
        if (comparable(actual, field) !== comparable(expected, field)) return false;
        break;
      case 'not':
        if (matchCondition(actual, expected, field)) return false;
        break;
      case 'in':
        if (
          !(expected as unknown[]).some(
            (e) => comparable(e, field) === comparable(actual, field),
          )
        ) {
          return false;
        }
        break;
      case 'notIn':
        if (
          (expected as unknown[]).some(
            (e) => comparable(e, field) === comparable(actual, field),
          )
        ) {
          return false;
        }
        break;
      case 'contains':
        if (actual == null || !str(actual).includes(str(expected))) return false;
        break;
      case 'startsWith':
        if (actual == null || !str(actual).startsWith(str(expected))) return false;
        break;
      case 'endsWith':
        if (actual == null || !str(actual).endsWith(str(expected))) return false;
        break;
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte': {
        if (actual == null) return false;
        const a = comparable(actual, field) as number;
        const b = comparable(expected, field) as number;
        if (op === 'gt' && !(a > b)) return false;
        if (op === 'gte' && !(a >= b)) return false;
        if (op === 'lt' && !(a < b)) return false;
        if (op === 'lte' && !(a <= b)) return false;
        break;
      }
      default:
        throw new Error(`jsondb: unknown filter operator "${op}"`);
    }
  }
  return true;
}

export function matchesWhere(
  row: Row,
  where: Record<string, unknown> | undefined,
  model: ModelMeta,
): boolean {
  if (!where) return true;

  for (const [key, condition] of Object.entries(where)) {
    if (condition === undefined) continue;

    if (key === 'AND') {
      const clauses = Array.isArray(condition) ? condition : [condition];
      if (!clauses.every((c) => matchesWhere(row, c as Record<string, unknown>, model))) {
        return false;
      }
      continue;
    }
    if (key === 'OR') {
      const clauses = Array.isArray(condition) ? condition : [condition];
      if (!clauses.some((c) => matchesWhere(row, c as Record<string, unknown>, model))) {
        return false;
      }
      continue;
    }
    if (key === 'NOT') {
      const clauses = Array.isArray(condition) ? condition : [condition];
      if (clauses.some((c) => matchesWhere(row, c as Record<string, unknown>, model))) {
        return false;
      }
      continue;
    }

    const field = model.fieldsByName.get(key);
    if (field?.kind === 'object') {
      throw new Error(
        `jsondb: relation filter on "${model.name}.${key}" is not supported`,
      );
    }
    if (!matchCondition(row[key], condition, field)) return false;
  }
  return true;
}

/** Resolves a `where` that targets a unique constraint, incl. composites. */
export function uniqueKeyOf(
  where: Record<string, unknown>,
  model: ModelMeta,
): { field: string; value: unknown }[] | null {
  for (const unique of model.uniques) {
    if (unique.length === 1) {
      const [name] = unique;
      if (where[name] !== undefined && typeof where[name] !== 'object') {
        return [{ field: name, value: where[name] }];
      }
    } else {
      // Composite uniques arrive nested under their generated key, e.g.
      // `where: { clientId_code: { clientId, code } }`.
      const compositeKey = unique.join('_');
      const nested = where[compositeKey] as Record<string, unknown> | undefined;
      if (nested && typeof nested === 'object') {
        return unique.map((f) => ({ field: f, value: nested[f] }));
      }
      if (unique.every((f) => where[f] !== undefined)) {
        return unique.map((f) => ({ field: f, value: where[f] }));
      }
    }
  }
  return null;
}

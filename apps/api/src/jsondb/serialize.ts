import type { Row } from './query/where';
import type { ModelMeta } from './schema/types';

/**
 * JSON has no Date type, so DateTime fields are persisted as ISO strings and
 * revived as `Date` on the way out — Prisma hands services real `Date`s and a
 * lot of code downstream calls `.getTime()`/`.toISOString()` on them.
 */
export function reviveRow(row: Row, model: ModelMeta): Row {
  const out: Row = { ...row };
  for (const field of model.fields) {
    if (field.kind !== 'scalar') continue;
    const value = out[field.name];
    if (value == null) continue;
    if (field.type === 'DateTime' && typeof value === 'string') {
      out[field.name] = new Date(value);
    } else if (field.type === 'Decimal' && typeof value === 'string') {
      out[field.name] = Number(value);
    }
  }
  return out;
}

/** Inverse of `reviveRow`: Dates down to ISO strings for storage. */
export function serializeRow(row: Row, model: ModelMeta): Row {
  const out: Row = { ...row };
  for (const field of model.fields) {
    if (field.kind !== 'scalar') continue;
    const value = out[field.name];
    if (value instanceof Date) {
      out[field.name] = value.toISOString();
    } else if (field.type === 'Decimal' && value != null) {
      out[field.name] = Number(value);
    }
  }
  return out;
}

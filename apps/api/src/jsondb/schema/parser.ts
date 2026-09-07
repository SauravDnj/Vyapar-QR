import { readFileSync } from 'node:fs';

import type {
  DefaultValue,
  FieldMeta,
  ModelMeta,
  RelationInfo,
  SchemaMeta,
} from './types';

const SCALARS = new Set([
  'String',
  'Int',
  'Float',
  'Boolean',
  'DateTime',
  'Decimal',
  'Json',
  'BigInt',
]);

/** Strips `//` line comments and `/** ... *\/` doc blocks. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function parseDefault(raw: string): DefaultValue | undefined {
  const inner = raw.trim();
  if (inner === 'uuid()' || inner === 'cuid()') return { kind: 'uuid' };
  if (inner === 'now()') return { kind: 'now' };
  if (inner === 'true') return { kind: 'literal', value: true };
  if (inner === 'false') return { kind: 'literal', value: false };
  if (/^-?\d+(\.\d+)?$/.test(inner)) {
    return { kind: 'literal', value: Number(inner) };
  }
  if (inner.startsWith('"')) {
    return { kind: 'literal', value: inner.slice(1, -1) };
  }
  // Bare identifier — an enum member, e.g. `@default(active)`.
  return { kind: 'literal', value: inner };
}

function parseRelation(raw: string): RelationInfo {
  const fields = /fields:\s*\[([^\]]*)\]/.exec(raw)?.[1] ?? '';
  const references = /references:\s*\[([^\]]*)\]/.exec(raw)?.[1] ?? '';
  const onDelete = /onDelete:\s*(\w+)/.exec(raw)?.[1] ?? 'NoAction';
  const split = (s: string) =>
    s
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
  return {
    fields: split(fields),
    references: split(references),
    onDelete: onDelete as RelationInfo['onDelete'],
  };
}

/**
 * Splits a field's attribute tail into individual `@...` attributes, honouring
 * nested parens so `@relation(fields: [a], references: [b])` stays intact.
 */
function splitAttributes(tail: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of tail) {
    if (ch === '@' && depth === 0) {
      if (current.trim()) out.push(current.trim());
      current = '';
      continue;
    }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

function parseField(line: string, enums: Map<string, string[]>): FieldMeta | null {
  const match = /^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/.exec(line.trim());
  if (!match) return null;
  const [, name, type, list, optional, tail = ''] = match;

  const kind = SCALARS.has(type)
    ? 'scalar'
    : enums.has(type)
      ? 'enum'
      : 'object';

  const field: FieldMeta = {
    name,
    type,
    kind,
    isList: Boolean(list),
    isOptional: Boolean(optional),
    isId: false,
    isUnique: false,
    isUpdatedAt: false,
  };

  for (const attr of splitAttributes(tail)) {
    if (attr === 'id') field.isId = true;
    else if (attr === 'unique') field.isUnique = true;
    else if (attr === 'updatedAt') field.isUpdatedAt = true;
    else if (attr.startsWith('default(')) {
      field.default = parseDefault(attr.slice('default('.length, -1));
    } else if (attr.startsWith('relation(')) {
      field.relation = parseRelation(attr.slice('relation('.length, -1));
    }
    // `@map(...)` and `@db.*` are storage-layer concerns MySQL cared about;
    // the JSON store persists by Prisma field name, so they're ignored.
  }
  return field;
}

export function parseSchema(schemaPath: string): SchemaMeta {
  const src = stripComments(readFileSync(schemaPath, 'utf8'));

  const enums = new Map<string, string[]>();
  const enumRe = /enum\s+(\w+)\s*\{([^}]*)\}/g;
  for (let m = enumRe.exec(src); m; m = enumRe.exec(src)) {
    const members = m[2]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('@'));
    enums.set(m[1], members);
  }

  const models = new Map<string, ModelMeta>();
  const modelRe = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  for (let m = modelRe.exec(src); m; m = modelRe.exec(src)) {
    const [, name, body] = m;
    const fields: FieldMeta[] = [];
    const composites: string[][] = [];

    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith('@@')) {
        const uq = /^@@unique\(\[([^\]]*)\]\)/.exec(line);
        if (uq) {
          composites.push(uq[1].split(',').map((p) => p.trim()).filter(Boolean));
        }
        continue;
      }
      const field = parseField(line, enums);
      if (field) fields.push(field);
    }

    const fieldsByName = new Map(fields.map((f) => [f.name, f]));
    const idField = fields.find((f) => f.isId);
    if (!idField) throw new Error(`Model ${name} has no @id field`);

    const uniques: string[][] = [
      [idField.name],
      ...fields.filter((f) => f.isUnique && !f.isId).map((f) => [f.name]),
      ...composites,
    ];

    models.set(name, {
      name,
      delegate: name.charAt(0).toLowerCase() + name.slice(1),
      fields,
      fieldsByName,
      idField,
      uniques,
    });
  }

  // Second pass: a relation field with no `fields:` of its own is the virtual
  // back-reference side. Find the owning field on the related model so
  // `include` can resolve it in both directions.
  for (const model of models.values()) {
    for (const field of model.fields) {
      if (field.kind !== 'object' || field.relation) continue;
      const target = models.get(field.type);
      if (!target) continue;
      const owner = target.fields.find(
        (f) => f.kind === 'object' && f.type === model.name && f.relation,
      );
      if (owner) {
        field.backRelation = { model: target.name, field: owner.name };
      }
    }
  }

  const byDelegate = new Map(
    [...models.values()].map((m) => [m.delegate, m] as const),
  );

  return { models, byDelegate, enums };
}

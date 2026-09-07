/**
 * Metadata describing the Prisma schema, parsed at runtime from
 * `prisma/schema.prisma`. The JSON engine is generic: it drives defaults,
 * relation resolution, `@map` translation and unique-constraint checks off
 * this metadata rather than off 37 hand-written model definitions, so the
 * schema file stays the single source of truth.
 */

export type ScalarKind =
  | 'String'
  | 'Int'
  | 'Float'
  | 'Boolean'
  | 'DateTime'
  | 'Decimal'
  | 'Json'
  | 'BigInt';

export type DefaultValue =
  | { kind: 'uuid' }
  | { kind: 'now' }
  | { kind: 'literal'; value: unknown };

export interface RelationInfo {
  /** Field names on *this* model holding the foreign key(s). */
  fields: string[];
  /** Field names on the *related* model the keys point at. */
  references: string[];
  onDelete: 'Cascade' | 'SetNull' | 'Restrict' | 'NoAction';
}

export interface FieldMeta {
  name: string;
  /** Scalar kind, enum name, or related model name. */
  type: string;
  kind: 'scalar' | 'enum' | 'object';
  isList: boolean;
  isOptional: boolean;
  isId: boolean;
  isUnique: boolean;
  isUpdatedAt: boolean;
  default?: DefaultValue;
  relation?: RelationInfo;
  /**
   * Set on the *virtual* side of a one-to-many / one-to-one back-reference —
   * the side that carries no foreign key of its own. Resolved by looking up
   * the owning side's relation on the related model.
   */
  backRelation?: { model: string; field: string };
}

export interface ModelMeta {
  name: string;
  /** Lowercased first letter — the delegate key, e.g. `landingPage`. */
  delegate: string;
  fields: FieldMeta[];
  fieldsByName: Map<string, FieldMeta>;
  idField: FieldMeta;
  /** Single-field uniques plus `@@unique([...])` composites. */
  uniques: string[][];
}

export interface SchemaMeta {
  models: Map<string, ModelMeta>;
  /** Delegate key -> model, e.g. `landingPage` -> LandingPage. */
  byDelegate: Map<string, ModelMeta>;
  enums: Map<string, string[]>;
}

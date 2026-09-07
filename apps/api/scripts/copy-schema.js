// Copies `prisma/schema.prisma` next to the compiled output.
//
// The JSON engine parses the schema at runtime to learn its models, fields,
// defaults and relations, so the schema is a runtime asset, not just a build
// input. Nest's own asset globs are scoped to `sourceRoot`, which the schema
// sits outside of — hence this explicit step, which keeps `dist/` self-
// contained for a serverless deploy that ships only the build output.
const { copyFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const target = join(root, 'dist', 'prisma');

mkdirSync(target, { recursive: true });
copyFileSync(join(root, 'prisma', 'schema.prisma'), join(target, 'schema.prisma'));

console.log('copied prisma/schema.prisma -> dist/prisma/schema.prisma');

// @ts-check
import { importOrder } from '@qrhub/config/eslint/import-order.mjs';
import { prettierConfig } from '@qrhub/config/eslint/prettier.mjs';
import { typescriptStrict } from '@qrhub/config/eslint/typescript.mjs';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // `scripts/` is plain Node tooling outside the src tsconfig, so the
  // type-aware rules have no project for it.
  { ignores: ['dist', 'eslint.config.mjs', 'scripts'] },
  ...typescriptStrict,
  ...importOrder,
  prettierConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);

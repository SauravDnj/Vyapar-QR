// @ts-check
import { importOrder } from '@vyaparqr/config/eslint/import-order.mjs';
import { prettierConfig } from '@vyaparqr/config/eslint/prettier.mjs';
import { typescriptStrict } from '@vyaparqr/config/eslint/typescript.mjs';
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

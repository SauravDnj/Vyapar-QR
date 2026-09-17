// @ts-check
import { importOrder } from '@vyaparqr/config/eslint/import-order.mjs';
import { prettierConfig } from '@vyaparqr/config/eslint/prettier.mjs';
import { typescriptStrict } from '@vyaparqr/config/eslint/typescript.mjs';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'eslint.config.mjs'] },
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

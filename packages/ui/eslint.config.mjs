// @ts-check
import { importOrder } from '@qrhub/config/eslint/import-order.mjs';
import { prettierConfig } from '@qrhub/config/eslint/prettier.mjs';
import { typescriptStrict } from '@qrhub/config/eslint/typescript.mjs';
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

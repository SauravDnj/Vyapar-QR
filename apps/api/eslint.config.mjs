// @ts-check
import { importOrder } from '@qrhub/config/eslint/import-order.mjs';
import { prettierConfig } from '@qrhub/config/eslint/prettier.mjs';
import { typescriptStrict } from '@qrhub/config/eslint/typescript.mjs';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'dist'],
  },
  ...typescriptStrict,
  ...importOrder,
  prettierConfig,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      // NestJS modules/providers are frequently empty classes carrying only a decorator.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },
);

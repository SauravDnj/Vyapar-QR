// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

/** Strict, type-checked TypeScript rules. Consumers must add their own
 * languageOptions.parserOptions.projectService/tsconfigRootDir. */
export const typescriptStrict = tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
);

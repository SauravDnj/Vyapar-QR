// @ts-check
import prettierConfig from 'eslint-config-prettier';

/** Disables ESLint stylistic rules that conflict with Prettier. Formatting
 * itself is handled by running Prettier directly, not through ESLint. */
export { prettierConfig };

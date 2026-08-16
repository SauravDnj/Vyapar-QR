// @ts-check
import importPlugin from 'eslint-plugin-import';

const importOrderRuleConfig = {
  settings: {
    'import/resolver': {
      typescript: { alwaysTryTypes: true },
    },
  },
  rules: {
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    'import/no-unresolved': 'off',
  },
};

/** Consistent import grouping/ordering, resolved via TypeScript paths.
 * Registers the `import` plugin — use only where it isn't already registered. */
export const importOrder = [importPlugin.flatConfigs.recommended, importOrderRuleConfig];

/** Same rules, without registering the `import` plugin — for consumers
 * (e.g. eslint-config-next) that already register it themselves. */
export const importOrderRules = [importOrderRuleConfig];

import globals from 'globals';
import pluginJs from '@eslint/js';
import html from 'eslint-plugin-html';
import jsdoc from 'eslint-plugin-jsdoc';
import unusedImports from 'eslint-plugin-unused-imports';
import security from 'eslint-plugin-security';
import importPlugin from 'eslint-plugin-import';
import complexity from 'eslint-plugin-complexity';
import a11y from 'eslint-plugin-jsx-a11y';

export default [
  {
    ignores: ['dist/**', '.wrangler/**', 'node_modules/**', '.wrangler/**', '**/*.config.js']
  },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  jsdoc.configs['flat/recommended'],
  {
    files: ['**/*.js'],
    plugins: {
      html,
      jsdoc,
      'unused-imports': unusedImports,
      security,
      import: importPlugin,
      complexity,
      'jsx-a11y': a11y,
    },
    rules: {
      indent: ['error', 2, { SwitchCase: 1 }],
      'max-len': ['off', { code: 150 }],
      'no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' }
      ],
      'jsdoc/require-jsdoc': ['warn', {
        require: {
          FunctionExpression: true,
          MethodDefinition: true,
          ArrowFunctionExpression: false,
        },
        publicOnly: true,
      }],
      'security/detect-object-injection': 'error',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-unsafe-regex': 'error',
      'import/no-unresolved': 'error',
      'import/no-cycle': 'error',
      'complexity': ['warn', 10],
      'jsx-a11y/alt-text': 'warn',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'no-var': 'error',
      'prefer-const': 'error',
      'eqeqeq': ['error', 'always'],
      'radix': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'prefer-template': 'warn',
      'object-shorthand': 'warn',
      'curly': ['error', 'all'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    }
  },
  // Node CLI scripts: console output is intentional
  {
    files: ['scripts/*.js'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off' },
  },
];

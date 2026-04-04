import globals from 'globals';
import pluginJs from '@eslint/js';
import html from 'eslint-plugin-html';

export default [
    { languageOptions: { globals: globals.browser } },
    pluginJs.configs.recommended,
    {
        ignores: ['dist/**'],
        plugins: {
            html
        },
        rules: {
            'max-len': ['off', { 'code': 150 }]
        }
    }
];

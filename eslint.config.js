import globals from 'globals';
import pluginJs from '@eslint/js';
import html from 'eslint-plugin-html';

export default [
    {
        ignores: ['dist/**', '.wrangler/**']
    },
    { languageOptions: { globals: globals.browser } },
    pluginJs.configs.recommended,
    {
        plugins: {
            html
        },
        rules: {
            'max-len': ['off', { 'code': 150 }]
        }
    }
];

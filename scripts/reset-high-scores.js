#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SQL_RESET_HIGH_SCORES = 'DELETE FROM game_scores; DELETE FROM game_runs;';

const printUsage = () => {
    console.log('Usage: npm run d1:reset-high-scores -- --env <local|preview|production>');
};

const parseEnvArg = (argv) => {
    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];

        if (token === '--env' || token === '-e') {
            return argv[i + 1] || null;
        }

        if (token.startsWith('--env=')) {
            return token.slice('--env='.length);
        }
    }

    return null;
};

const normaliseEnvironment = (value) => {
    const env = String(value || '').trim().toLowerCase();

    if (env === 'prod') return 'production';
    return env;
};

const targetFromEnvironment = (environment) => {
    switch (environment) {
        case 'local':
            return {
                dbName: 'wallabyfest-guests-preview',
                wranglerArgs: ['--local']
            };
        case 'preview':
            return {
                dbName: 'wallabyfest-guests-preview',
                wranglerArgs: ['--remote', '--env', 'preview']
            };
        case 'production':
            return {
                dbName: 'wallabyfest-guests',
                wranglerArgs: ['--remote', '--env', 'production']
            };
        default:
            return null;
    }
};

const selectedEnvironment = normaliseEnvironment(parseEnvArg(process.argv.slice(2)));
const target = targetFromEnvironment(selectedEnvironment);

if (!target) {
    console.error('Missing or invalid environment. Use local, preview, or production.');
    printUsage();
    process.exit(1);
}

const args = [
    'd1',
    'execute',
    target.dbName,
    ...target.wranglerArgs,
    '--command',
    SQL_RESET_HIGH_SCORES
];

console.log(`Resetting high scores in ${selectedEnvironment}...`);

const result = spawnSync('wrangler', args, {
    stdio: 'inherit'
});

if (result.error) {
    console.error(result.error.message);
    process.exit(1);
}

if (result.status !== 0) {
    process.exit(result.status ?? 1);
}

if (selectedEnvironment === 'local') {
    const seedFile = resolve(__dirname, 'seed-local-scores.sql');
    const seedArgs = [
        'd1',
        'execute',
        target.dbName,
        '--local',
        '--file',
        seedFile
    ];

    console.log('Seeding local high scores...');

    const seedResult = spawnSync('wrangler', seedArgs, {
        stdio: 'inherit'
    });

    if (seedResult.error) {
        console.error(seedResult.error.message);
        process.exit(1);
    }

    process.exit(seedResult.status ?? 1);
}

process.exit(0);

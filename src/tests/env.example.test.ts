import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('env example types', () => {
    beforeAll(() => {
        fs.cpSync(path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '.env.test'), {
            filter: (src) => {
                return !src.includes('.env.example');
            }
        });
    });

    afterAll(() => {
        fs.cpSync(path.resolve(process.cwd(), '.env.test'), path.resolve(process.cwd(), '.env'), {
            filter: (src) => {
                return !src.includes('.env.example');
            }
        });
        fs.rmSync(path.resolve(process.cwd(), '.env.test'));
    });

    test('loads environment variables from .env file', async () => {
        const env = await import('$lib/server/utils/env');
        expect(env.default.ENVIRONMENT).toBe('dev');
    });
});

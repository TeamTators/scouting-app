/* eslint-disable @typescript-eslint/no-explicit-any */
import path from 'path';
import { str } from '../src/lib/server/utils/env';
import configSchema from '../src/lib/server/utils/config';
import { openJSON } from '../src/lib/server/utils/files';
import { z } from 'zod';
import { prompt } from '../cli/utils';

export default async () => {
    const configPath = str('CONFIG_PATH', true);
    const configRes = await openJSON(path.resolve(process.cwd(), configPath), z.record(z.unknown()));
    let config: any = {};
    if (configRes.isOk()) {
        config = configRes.value;
    }
    const exampleConfig = await openJSON(path.resolve(process.cwd(), 'config.example.json'), configSchema).unwrap();

    const result = configSchema.safeParse(config);
    if (result.success) {
        console.log('Config is valid');
        return true;
    }

    // Recursively prompt for missing/invalid values
    const promptValue = async (exampleValue: any, currentValue: any, path: string): Promise<any> => {
        if (Array.isArray(exampleValue)) {
            // Prompt for array length
            let arr = Array.isArray(currentValue) ? currentValue : [];
            const exampleLength = exampleValue.length;
            const length = parseInt(String(await prompt({
                message: `Enter array length for "${path}" (example length: ${exampleLength}):`,
                clear: true,
            }).unwrap()), 10);
            arr = arr.slice(0, length);
            for (let i = 0; i < length; i++) {
                arr[i] = await promptValue(exampleValue[0], arr[i], `${path}[${i}]`);
            }
            return arr;
        } else if (typeof exampleValue === 'object' && exampleValue !== null) {
            // Prompt for each key in object
            const obj = typeof currentValue === 'object' && currentValue !== null ? currentValue : {};
            for (const key of Object.keys(exampleValue)) {
                obj[key] = await promptValue(exampleValue[key], obj[key], `${path}.${key}`);
            }
            return obj;
        } else {
            // Prompt for primitive value
            const value = await prompt({
                message: `Invalid config at path "${path}". Please enter a valid value (example: ${JSON.stringify(exampleValue)}):`,
                clear: true,
            }).unwrap();
            // Try to cast to correct type
            switch (typeof exampleValue) {
                case 'number':
                    return Number(value);
                case 'boolean':
                    return ['true', '1', 'yes', 'y'].includes(String(value).toLowerCase());
                case 'string':
                    return String(value);
                default:
                    return value;
            }
        }
    };

    // Walk through all issues and fix them
    for (const issue of result.error.issues) {
        const keys = issue.path;
        let current = config;
        let example = exampleConfig;
        for (let i = 0; i < keys.length - 1; i++) {
            current = (current as any)[keys[i]] = (current as any)[keys[i]] || {};
            example = (example as any)[keys[i]];
        }
        const key = keys[keys.length - 1];
        (current as any)[key] = await promptValue((example as any)[key], (current as any)[key], keys.join('.'));
    }

    // Save the fixed config
    const fs = await import('fs');
    await fs.promises.writeFile(path.resolve(process.cwd(), configPath), JSON.stringify(config, null, 2));
    console.log('Config updated and saved.');
    return true;
};

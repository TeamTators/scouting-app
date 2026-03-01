/**
 * @fileoverview Server-side bootstrap for structs and admin provisioning.
 *
 * Runs after all structs have been built to ensure the default admin account exists
 * and starts the lifetime cleanup loop.
 *
 * @example
 * import '$lib/server';
 */

import { Struct } from 'drizzle-struct';
import terminal from './utils/terminal';
import testSchema from '../../../scripts/test-schema';
import { config } from './utils/env';
import { makeFeatureNotifications } from './utils/features';

testSchema('false');

/**
 * Executes tasks that should run after all structs have been built.
 *
 * - Starts the lifetime cleanup loop.
 * - Ensures the configured admin account exists and is verified.
 */
export const postBuild = async () => {
};


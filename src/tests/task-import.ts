/**
 * @fileoverview Helper module used by task runner tests.
 * @description
 * Exposes a small function used to verify dynamic task execution.
 */

import terminal from '../lib/server/utils/terminal';

// Used for the run-task.test.ts unit test
/**
 * Echoes the provided string to the terminal and returns it.
 * @param str - String to log and return.
 * @returns The same string passed in.
 */
export const test = (str: string) => {
	terminal.log(str);
	return str;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test, vi } from 'vitest';
import { refresh_supabase_session } from '$lib/server/utils/supabase-session';

describe('refresh_supabase_session', () => {
	test('uses a single getUser call without pre-fetching session in SSR middleware', async () => {
		const getSession = vi.fn();
		const refreshSession = vi.fn();
		const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });

		const result = await refresh_supabase_session({
			auth: {
				getSession,
				refreshSession,
				getUser
			}
		} as any);

		expect(getSession).not.toHaveBeenCalled();
		expect(refreshSession).not.toHaveBeenCalled();
		expect(getUser).toHaveBeenCalledTimes(1);
		expect(result.user).toEqual({ id: 'user-1' });
		expect(result.error).toBeNull();
	});
});

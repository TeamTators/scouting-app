/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test, vi } from 'vitest';
import { refresh_supabase_session } from '$lib/server/utils/supabase-session';

describe('refresh_supabase_session', () => {
	test('fetches the session and refreshes expired auth before returning the user', async () => {
		const getSession = vi.fn().mockResolvedValue({
			data: { session: { access_token: 'expired' } },
			error: null
		});
		const refreshSession = vi.fn().mockResolvedValue({
			data: { session: { access_token: 'fresh' } },
			error: null
		});
		const getUser = vi
			.fn()
			.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Auth session missing' } })
			.mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null });

		const result = await refresh_supabase_session({
			auth: {
				getSession,
				refreshSession,
				getUser
			}
		} as any);

		expect(getSession).toHaveBeenCalledTimes(1);
		expect(refreshSession).toHaveBeenCalledTimes(1);
		expect(getUser).toHaveBeenCalledTimes(2);
		expect(result.user).toEqual({ id: 'user-1' });
		expect(result.error).toBeNull();
	});

	test('returns null user when no session exists', async () => {
		const getSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
		const refreshSession = vi.fn();
		const getUser = vi.fn();

		const result = await refresh_supabase_session({
			auth: {
				getSession,
				refreshSession,
				getUser
			}
		} as any);

		expect(getSession).toHaveBeenCalledTimes(1);
		expect(refreshSession).not.toHaveBeenCalled();
		expect(getUser).not.toHaveBeenCalled();
		expect(result.user).toBeNull();
		expect(result.error).toBeNull();
	});
});

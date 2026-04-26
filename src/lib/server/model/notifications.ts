/**
 * @fileoverview Global notification service for broadcasting notifications to all users.
 * Provides utilities for creating and distributing system-wide notifications across the application.
 */
import type { Icon } from '$lib/types/icons';
import { attemptAsync } from 'ts-utils';
import supabase from '../services/supabase';

/**
 * Broadcasts a global notification to all user accounts in the system.
 * Asynchronously inserts notification records for every profile in the database.
 * @async
 * @param {Object} notif - Notification configuration object.
 * @param {string} notif.title - Display title of the notification.
 * @param {string} notif.message - Main message body of the notification.
 * @param {'info'|'warning'|'danger'|'success'} notif.severity - Severity level affecting styling and urgency.
 * @param {Icon} notif.icon - Icon configuration object with name and type properties.
 * @param {string} [notif.link] - Optional URL to navigate to when notification is clicked.
 * @returns {ResultPromise<void, Error>} Resolves when all notifications are created, or rejects if account fetch fails.
 * @example
 * const res = await globalNotification({
 *   title: 'System Maintenance',
 *   message: 'Scheduled maintenance starting at 2:00 AM',
 *   severity: 'warning',
 *   icon: { name: 'warning', type: 'alert' },
 *   link: '/maintenance-info'
 * }).unwrap();
 */
export const globalNotification = (notif: {
	title: string;
	message: string;
	severity: 'info' | 'warning' | 'danger' | 'success';
	icon: Icon;
	link?: string;
}) => {
	return attemptAsync(async () => {
		const { data: accounts, error: accountsError } = await supabase.from('profile').select('id');
		if (accountsError) throw accountsError;

		if (!accounts) throw new Error('No accounts found');
		const { error } = await supabase.from('account_notification').insert(
			accounts.map((a) => ({
				account_id: a.id,
				icon: notif.icon.name,
				icon_type: notif.icon.type,
				message: notif.message,
				link: notif.link,
				title: notif.title,
				severity: notif.severity
			}))
		);

		if (error) throw error;
	});
};

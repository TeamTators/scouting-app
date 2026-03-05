import type { Icon } from "$lib/types/icons";
import { attemptAsync } from "ts-utils";
import supabase from "../services/supabase";

export const globalNotification = (notif: {
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'danger' | 'success';
    icon: Icon;
    link?: string;
}) => {
    return attemptAsync(async () => {
        const { data: accounts, error: accountsError} = await supabase.from('profile').select('id');
        if (accountsError) throw accountsError;

        if (!accounts) throw new Error('No accounts found');
        const { error } = await supabase.from('account_notification').insert(accounts.map(a => ({
            account_id: a.id,
            archived: false,
            icon: notif.icon.name,
            icon_type: notif.icon.type,
            message: notif.message,
            link: notif.link,
            title: notif.title,
            severity: notif.severity,
            read: false,
        })));

        if (error) throw error;
    });
};
<!--
@component
Notification card with read/unread and delete actions.

**Props**
- `notification`: `Account.AccountNotificationData` — Notification model.

**Example**
```svelte
<Notification {notification} />
```
-->
<script lang="ts">
	import type { SupaStructData } from '$lib/services/supabase/supastruct.svelte';

	interface Props {
		notification: SupaStructData<'core', 'account_notification'>;
	}

	const { notification }: Props = $props();

	const read = () => {
		notification.update({
			read: true
		});
	};

	const unread = () => {
		notification.update({
			read: false
		});
	};

	const remove = () => {
		notification.delete();
	};
</script>

<div class="card mb-3 {!notification.raw.read ? 'border-' + notification.raw.severity : ''}">
	<div class="card-body layer-2">
		<div class="d-flex align-items-center mb-2">
			{#if notification.raw.icon}
				<i class="material-icons text-{notification.raw.severity} pe-2">{notification.raw.icon}</i>
			{/if}
			<h5 class="card-title mb-0">{notification.raw.title}</h5>

			{#if notification.raw.link}
				<a
					href={notification.raw.link}
					onclick={read}
					target="_blank"
					class="btn btn-outline-{notification.raw.severity} btn-sm ms-auto"
				>
					<i class="material-icons"> open_in_new </i>
					Open Link
				</a>
			{/if}
		</div>
		<p class="card-text">{notification.raw.message}</p>
		<div class="d-flex justify-content-between align-items-center">
			{#if notification.raw.read}
				<button class="btn btn-outline-secondary btn-sm" onclick={unread}>
					<i class="material-icons">mark_email_unread</i> Mark as Unread
				</button>
			{:else}
				<button class="btn btn-outline-success btn-sm" onclick={read}>
					<i class="material-icons">mark_email_read</i> Mark as Read
				</button>
			{/if}
			<button type="button" class="btn btn-outline-danger btn-sm" onclick={remove}>
				<i class="material-icons">delete</i> Delete
			</button>
		</div>
	</div>
</div>

<!--
@component
Notifications offcanvas panel with unread count binding.

**Props**
- `notifs`: `number` — Unread notifications count (bindable).

**Example**
```svelte
<Notifications bind:notifs />
```
-->
<script lang="ts">
	import { mount } from 'svelte';
	import Notification from '../account/Notification.svelte';
	import { rawModal } from '$lib/utils/prompts';
	import NotificationHistory from '../account/NotificationHistory.svelte';
	import { SupaStructData } from '$lib/services/supabase/supastruct.svelte';

	const id = 'notifications';

	interface Props {
		notifications: SupaStructData<'core', 'account_notification'>[];
	}

	let { notifications }: Props = $props();
</script>

<div class="offcanvas offcanvas-end" tabindex="-1" {id} aria-labelledby="{id}Label">
	<div class="offcanvas-header layer-1">
		<h5 class="offcanvas-title" id="{id}Label">My Notifications</h5>
		<button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
	</div>
	<div class="offcanvas-body layer-1">
		<ul class="list-unstyled">
			{#each notifications as notification}
				<Notification {notification} />
			{/each}
			<li class="w-100">
				<button
					type="button"
					class="btn btn-secondary w-100"
					onclick={() => {
						const m = rawModal('Popup History', [], (body) =>
							mount(NotificationHistory, {
								target: body,
								props: {
									test: false
								}
							})
						);

						m.show();
					}}
				>
					<i class="material-icons">visibility</i> View Popup History
				</button>
			</li>
		</ul>
	</div>
	<!-- <button type="button" class="btn btn-success" onclick={test}> Create Test Notification </button> -->
</div>

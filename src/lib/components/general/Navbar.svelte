<!--
@component
Top navigation bar with stack controls, theme toggle, account menu, and notifications.

**Props**
- `title`: `string` — Brand/title text.

**Example**
```svelte
<Navbar title="Dashboard" />
```
-->
<script lang="ts">
	import SideNav from './SideNav.svelte';
	import Notifications from './Notifications.svelte';
	// import { Stack } from '$lib/utils/stack';
	import ThemeSwitch from './ThemeSwitch.svelte';
	import { SupaStructData } from '$lib/services/supabase/supastruct.svelte';
	import Online from '$lib/components/general/Online.svelte';
	import { Navbar } from '$lib/nav/index.svelte';
	import { rawModal } from '$lib/utils/prompts.svelte';
	import { mount } from 'svelte';
	import QuickSettings from '$lib/components/account/QuickSettings.svelte';
	import { type Client } from '$lib/services/supabase/supastruct.svelte';

	interface Props {
		title: string;
		account: SupaStructData<'core', 'profile'> | null;
		notifications: SupaStructData<'core', 'account_notification'>[];
		show_side_nav?: boolean;
		supabase: Client;
	}

	const {
		title,
		account,
		notifications,
		show_side_nav: _show_side_nav,
		supabase
	}: Props = $props();

	let notifs = $state(0);
</script>

<nav class="navbar navbar-expand-lg layer-1">
	<div class="d-flex justify-content-between w-100">
		<div class="start d-flex align-items-center">
			{#if Navbar.getSections().length}
				<button
					class="btn"
					type="button"
					data-bs-toggle="offcanvas"
					data-bs-target="#pages"
					aria-controls="pages"
				>
					<i class="material-icons"> menu </i>
				</button>
			{/if}
			<a
				class="
					navbar-brand
					ps-3
				"
				href="/">{title}</a
			>
		</div>
		<div class="end d-flex align-items-center">
			<Online />
			<!-- <button type="button" class="btn stack-btn" disabled={!$prev} onclick={() => Stack.undo()}>
				<i class="material-icons">undo</i>
			</button>
			<button type="button" class="btn stack-btn" disabled={!$next} onclick={() => Stack.redo()}>
				<i class="material-icons">redo</i>
			</button> -->
			<div class="dropdown">
				<div
					class="dropdown-menu animate__animated animate__fadeInDown animate__faster"
					style="
							position: fixed;
							top: 52px;
							left: calc(100% - 160px);
							width:	min-content;
						"
				>
					<div class="container">
						<div class="row mb-3 px-5">
							<div class="dropdown-icon">
								<ThemeSwitch />
							</div>
							<div class="dropdown-icon">
								<button
									type="button"
									class="btn"
									onclick={() => {
										const m = rawModal(
											'Quick Settings',
											[
												{
													color: 'gray',
													onClick: () => m.hide(),
													text: 'Close'
												},
												{
													color: 'primary',
													onClick: () => {},
													text: 'Save'
												}
											],
											(body) =>
												mount(QuickSettings, {
													target: body,
													props: {
														account,
														supabase
													}
												})
										);

										m.show();
									}}
								>
									<i class="material-icons"> settings </i>
								</button>
							</div>
						</div>
						<div class="row">
							<ul class="list-unstyled mb-0">
								{#if !account}
									<li>
										<a class="dropdown-item" href="/account/sign-in">
											<i class="material-icons">login</i>
											Sign In</a
										>
									</li>
								{:else}
									<li>
										Signed in as {account.raw.username}
									</li>
									<li>
										<a class="dropdown-item" href="/account/sign-out">
											<i class="material-icons">logout</i>
											Sign Out</a
										>
									</li>
								{/if}
							</ul>
						</div>
					</div>
				</div>
			</div>
			{#if account && notifications.length}
				<button
					class="me-5 btn position-relative"
					type="button"
					data-bs-toggle="offcanvas"
					data-bs-target="#notifications"
					aria-controls="notifications"
				>
					<i class="material-icons"> notifications </i>
					{#if notifs}
						<span
							class="position-absolute badge rounded-pill bg-danger animate__animated animate__bounce animate__delay-2s animate__repeat-2"
						>
							{notifs}
							<span class="visually-hidden">unread messages</span>
						</span>
					{/if}
				</button>
			{/if}
		</div>
	</div>
</nav>
<SideNav id="pages" name={title} />

{#if account}
	<Notifications {notifications} />
{/if}

<!-- <style>
	.stack-btn {
		background: transparent;
		border: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
		outline: inherit;
	}

	.stack-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style> -->

<style>
	.dropdown-icon {
		cursor: pointer;
		width: min-content;
		aspect-ratio: 1 / 1 !important;
		transition: all 0.3s ease;
		padding: 6px;
		border-radius: 50%;
	}

	.dropdown-icon:hover {
		background-color: color-mix(in srgb, var(--bs-gray) 50%, var(--bs-primary) 20%);
		transform: scale(1.1);
	}

	.dropdown-icon button {
		padding: 0px;
		aspect-ratio: 1 / 1;
		width: min-content;
		margin: 0;
	}

	.navbar {
		position: sticky;
		top: 0px;
		z-index: 1000;
	}
</style>

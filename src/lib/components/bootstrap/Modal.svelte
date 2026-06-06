<!--
@component
Bootstrap modal wrapper rendered via a portal.

**Props**
- `title`: `string` — Modal title text.
- `body`: `Snippet` — Main content.
- `buttons`?: `Snippet` — Footer button content.
- `show`?: `boolean` — Show immediately on mount.
- `size`?: `'sm' | 'md' | 'lg' | 'xl'` — Modal size (default: `'md'`).

**Exports**
- `on(event)`: subscribe to `'show' | 'hide'` events.
- `once(event)`: subscribe once to `'show' | 'hide'`.
- `off(event)`: unsubscribe.
- `show()`: open the modal.
- `hide()`: close the modal.

**Example**
```svelte
<Modal title="Confirm">
	{#snippet body()}
		<p>Are you sure?</p>
	{/snippet}
	{#snippet buttons()}
		<button class="btn btn-primary" onclick={confirm}>OK</button>
	{/snippet}
</Modal>
```
-->
<script lang="ts">
	import { Random } from 'ts-utils/math';
	import { onMount, type Snippet } from 'svelte';
	import { SimpleEventEmitter } from 'ts-utils/event-emitter';
	import Portal from 'svelte-portal';

	const id = Random.uuid();

	const em = new SimpleEventEmitter<'hide' | 'show'>();

	interface Props {
		title: string;
		body: Snippet;
		buttons?: Snippet;
		show?: boolean;
		size?: 'sm' | 'md' | 'lg' | 'xl';
	}

	let self: HTMLDivElement;

	const { title, body, buttons, show: doShow, size = 'md' }: Props = $props();

	const getModal = async () => {
		return import('bootstrap').then((bs) => {
			return bs.Modal.getInstance(self) || new bs.Modal(self);
		});
	};

	export const on = em.on.bind(em);
	export const once = em.once.bind(em);

	export const show = async () => {
		em.emit('show');
		const modal = await getModal();
		modal.show();
	};

	export const hide = async () => {
		em.emit('hide');
		const modal = await getModal();
		modal.hide();
	};

	export const off = em.off.bind(em);

	onMount(() => {
		const onshow = () => em.emit('show');
		const onhide = () => em.emit('hide');

		self.addEventListener('hidden.bs.modal', onhide);

		self.addEventListener('shown.bs.modal', onshow);

		if (doShow) {
			show();
		}

		return () => {
			self.removeEventListener('hidden.bs.modal', onhide);
			self.removeEventListener('shown.bs.modal', onshow);
		};
	});
</script>

<Portal target="body">
	<div
		bind:this={self}
		{id}
		class="modal fade custom-modal"
		aria-modal="true"
		role="dialog"
		tabindex="-1"
	>
		<div class="modal-dialog modal-{size}">
			<div class="modal-content custom-modal-content layer-1">
				<div class="modal-header custom-modal-header">
					<h5 class="modal-title custom-modal-title">{title}</h5>
					<button
						class="custom-modal-close"
						aria-label="Close"
						data-bs-dismiss="modal"
						type="button"
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 16 16"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 1 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z"
								fill="currentColor"
							/>
						</svg>
					</button>
				</div>
				<div class="modal-body custom-modal-body">
					{@render body()}
				</div>
				{#if buttons}
					<div class="modal-footer custom-modal-footer">
						{@render buttons()}
					</div>
				{/if}
			</div>
		</div>
	</div>
</Portal>

<style>
	.custom-modal .modal-dialog {
		max-width: 420px;
		margin: 2.5rem auto;
	}
	.custom-modal-content {
		border-radius: 12px;
		box-shadow:
			0 8px 32px rgba(31, 35, 40, 0.18),
			0 1.5px 4px rgba(31, 35, 40, 0.04);
		border: 1px solid var(--layer-3);
		background: var(--layer-1);
		color: var(--text-layer-0);
		overflow: hidden;
		padding: 0;
	}
	.custom-modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 18px 24px 12px 24px;
		border-bottom: 1px solid var(--layer-2);
		background: var(--layer-2);
		color: var(--text-layer-0);
	}
	.custom-modal-title {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--text-layer-0);
		margin: 0;
	}
	.custom-modal-close {
		background: none;
		border: none;
		padding: 4px;
		margin-left: 8px;
		color: var(--text-layer-2);
		border-radius: 4px;
		transition:
			background 0.15s,
			color 0.15s;
		cursor: pointer;
	}
	.custom-modal-close:hover {
		background: var(--layer-3);
		color: var(--text-layer-0);
	}
	.custom-modal-body {
		padding: 20px 24px 16px 24px;
		color: var(--text-layer-1);
		font-size: 1rem;
		background: var(--layer-1);
	}
	.custom-modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		padding: 12px 24px 18px 24px;
		border-top: 1px solid var(--layer-2);
		background: var(--layer-2);
		color: var(--text-layer-0);
	}
	@media (max-width: 600px) {
		.custom-modal .modal-dialog {
			max-width: 98vw;
			margin: 1.5rem auto;
		}
		.custom-modal-content {
			border-radius: 8px;
		}
		.custom-modal-header,
		.custom-modal-body,
		.custom-modal-footer {
			padding-left: 12px;
			padding-right: 12px;
		}
	}
</style>

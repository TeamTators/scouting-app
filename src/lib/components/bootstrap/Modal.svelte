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
		width?: string;
		blur?: boolean;
		resizable?: boolean;
		overlay?: boolean;
	}

	type ModalSize = NonNullable<Props['size']>;

	let self = $state<HTMLDivElement | undefined>(undefined);
	let dialogEl = $state<HTMLDivElement | undefined>(undefined);
	let titleBarEl = $state<HTMLDivElement | undefined>(undefined);

	const {
		title,
		body,
		buttons,
		show: doShow,
		size,
		width,
		blur,
		resizable = false,
		overlay = true
	}: Props = $props();

	let isOpen = $state(false);
	let isMounted = $state(false);
	let isDragging = $state(false);
	let isResizing = $state(false);
	let resizeDirection = $state<'right' | 'bottom' | 'corner' | null>(null);
	let dragX = $state(0);
	let dragY = $state(0);
	let modalWidth = $state<number | null>(null);
	let modalHeight = $state<number | null>(null);

	let dragStartMouseX = 0;
	let dragStartMouseY = 0;
	let dragStartX = 0;
	let dragStartY = 0;
	let resizeStartMouseX = 0;
	let resizeStartMouseY = 0;
	let resizeStartWidth = 0;
	let resizeStartHeight = 0;
	let resizeStartDragX = 0;
	let resizeStartDragY = 0;

	const MIN_MODAL_WIDTH = 280;
	const MIN_MODAL_HEIGHT = 180;
	const VIEWPORT_PADDING = 24;

	export const on = em.on.bind(em);
	export const once = em.once.bind(em);

	export const show = async () => {
		if (isOpen) return;
		isOpen = true;
		em.emit('show');
	};

	export const hide = async () => {
		isOpen = false;
		isDragging = false;
		isResizing = false;
		resizeDirection = null;
		em.emit('hide');
	};

	export const off = em.off.bind(em);

	const onBackdropClick = (event: MouseEvent) => {
		if (!overlay) return;
		if (resizable) return;
		if (event.target === self) {
			hide();
		}
	};

	const onOverlayKeyDown = (event: KeyboardEvent) => {
		if (event.key === 'Escape' && isOpen) {
			hide();
		}
	};

	const onWindowKeyDown = (event: KeyboardEvent) => {
		if (event.key === 'Escape' && isOpen) {
			hide();
		}
	};

	const onPointerMove = (event: PointerEvent) => {
		if (!resizable) {
			if (!isDragging) return;

			dragX = dragStartX + (event.clientX - dragStartMouseX);
			dragY = dragStartY + (event.clientY - dragStartMouseY);
			return;
		}

		if (isResizing) {
			const maxWidth = Math.max(MIN_MODAL_WIDTH, window.innerWidth - VIEWPORT_PADDING * 2);
			const maxHeight = Math.max(MIN_MODAL_HEIGHT, window.innerHeight - VIEWPORT_PADDING * 2);

			if (resizeDirection === 'right' || resizeDirection === 'corner') {
				const nextWidth = resizeStartWidth + (event.clientX - resizeStartMouseX);
				const clampedWidth = Math.min(maxWidth, Math.max(MIN_MODAL_WIDTH, nextWidth));
				modalWidth = clampedWidth;
				dragX = resizeStartDragX + (clampedWidth - resizeStartWidth) / 2;
			}

			if (resizeDirection === 'bottom' || resizeDirection === 'corner') {
				const nextHeight = resizeStartHeight + (event.clientY - resizeStartMouseY);
				const clampedHeight = Math.min(maxHeight, Math.max(MIN_MODAL_HEIGHT, nextHeight));
				modalHeight = clampedHeight;
				dragY = resizeStartDragY + (clampedHeight - resizeStartHeight) / 2;
			}

			return;
		}

		if (!isDragging) return;

		dragX = dragStartX + (event.clientX - dragStartMouseX);
		dragY = dragStartY + (event.clientY - dragStartMouseY);
	};

	const stopDragging = () => {
		isDragging = false;
	};

	const stopResizing = () => {
		isResizing = false;
		resizeDirection = null;
	};

	const onTitlePointerDown = (event: PointerEvent) => {
		if (event.button !== 0) return;
		if (!titleBarEl) return;
		if (isResizing) return;
		if (event.target instanceof Element && event.target.closest('.custom-modal-close')) {
			return;
		}

		event.preventDefault();
		isDragging = true;
		dragStartMouseX = event.clientX;
		dragStartMouseY = event.clientY;
		dragStartX = dragX;
		dragStartY = dragY;
		titleBarEl.setPointerCapture(event.pointerId);
	};

	const onTitlePointerUp = (event: PointerEvent) => {
		if (!titleBarEl) return;
		if (titleBarEl.hasPointerCapture(event.pointerId)) {
			titleBarEl.releasePointerCapture(event.pointerId);
		}
		stopDragging();
	};

	const onResizePointerDown = (direction: 'right' | 'bottom' | 'corner', event: PointerEvent) => {
		if (!resizable) return;
		if (event.button !== 0) return;
		if (!dialogEl) return;

		event.preventDefault();
		event.stopPropagation();

		const bounds = dialogEl.getBoundingClientRect();
		resizeStartWidth = bounds.width;
		resizeStartHeight = bounds.height;
		resizeStartDragX = dragX;
		resizeStartDragY = dragY;
		resizeStartMouseX = event.clientX;
		resizeStartMouseY = event.clientY;
		resizeDirection = direction;
		isResizing = true;
	};

	const sizeClassMap: Record<ModalSize, string> = {
		sm: 'custom-modal-sm',
		md: 'custom-modal-md',
		lg: 'custom-modal-lg',
		xl: 'custom-modal-xl'
	};

	const currentSizeClass = $derived(size ? sizeClassMap[size] : '');
	const transformStyle = $derived(`translate3d(${dragX}px, ${dragY}px, 0)`);
	const widthStyle = $derived(resizable && modalWidth !== null ? `${modalWidth}px` : width);
	const heightStyle = $derived(resizable && modalHeight !== null ? `${modalHeight}px` : undefined);

	onMount(() => {
		isMounted = true;
		window.addEventListener('keydown', onWindowKeyDown);
		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', stopDragging);
		if (resizable) {
			window.addEventListener('pointerup', stopResizing);
		}

		if (doShow) {
			show();
		}

		let animation = true;
		const update_state = () => {
			if (!animation) return;

			// ensure the modal is within the viewport
			if (dialogEl) {
				const rect = dialogEl.getBoundingClientRect();
				const viewportWidth = window.innerWidth;
				const viewportHeight = window.innerHeight;

				if (rect.right > viewportWidth) {
					dragX -= rect.right - viewportWidth;
				}
				if (rect.bottom > viewportHeight) {
					dragY -= rect.bottom - viewportHeight;
				}
				if (rect.left < 0) {
					dragX -= rect.left;
				}
				if (rect.top < 0) {
					dragY -= rect.top;
				}
			}

			requestAnimationFrame(update_state);
		};

		requestAnimationFrame(update_state);

		return () => {
			animation = false;
			window.removeEventListener('keydown', onWindowKeyDown);
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup', stopDragging);
			if (resizable) {
				window.removeEventListener('pointerup', stopResizing);
			}
		};
	});
</script>

<Portal target="body">
	{#if isMounted}
		<div
			bind:this={self}
			{id}
			class="custom-modal-overlay"
			class:blur
			class:no-overlay={!overlay}
			class:open={isOpen}
			aria-modal="true"
			role="dialog"
			tabindex="-1"
			onclick={onBackdropClick}
			onkeydown={onOverlayKeyDown}
		>
			<div
				bind:this={dialogEl}
				class="custom-modal-shell {currentSizeClass}"
				style:transform={transformStyle}
				style:width={widthStyle}
				style:height={heightStyle}
			>
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					bind:this={titleBarEl}
					class="custom-modal-header"
					onpointerdown={onTitlePointerDown}
					onpointerup={onTitlePointerUp}
				>
					<h5 class="custom-modal-title">{title}</h5>
					<button
						class="custom-modal-close"
						aria-label="Close"
						type="button"
						onpointerdown={(event) => event.stopPropagation()}
						onclick={hide}
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
				<div class="custom-modal-body">
					{@render body()}
				</div>
				{#if buttons}
					<div class="custom-modal-footer">
						{@render buttons()}
					</div>
				{/if}
				{#if resizable}
					<button
						type="button"
						class="custom-modal-resize-handle custom-modal-resize-handle-right"
						aria-label="Resize modal width"
						onpointerdown={(event) => onResizePointerDown('right', event)}
					></button>
					<button
						type="button"
						class="custom-modal-resize-handle custom-modal-resize-handle-bottom"
						aria-label="Resize modal height"
						onpointerdown={(event) => onResizePointerDown('bottom', event)}
					></button>
					<button
						type="button"
						class="custom-modal-resize-handle custom-modal-resize-handle-corner"
						aria-label="Resize modal"
						onpointerdown={(event) => onResizePointerDown('corner', event)}
					></button>
				{/if}
			</div>
		</div>
	{/if}
</Portal>

<style>
	.custom-modal-overlay {
		position: fixed;
		inset: 0;
		display: none;
		place-items: center;
		padding: 1.5rem;
		z-index: 1080;
		background: color-mix(in oklab, var(--layer-3) 80%, transparent);
		transition: opacity 180ms ease;
		opacity: 0;
		pointer-events: none;
	}
	.custom-modal-overlay.blur {
		backdrop-filter: blur(4px);
	}
	.custom-modal-overlay.open {
		opacity: 1;
		pointer-events: auto;
		display: grid;
	}
	.custom-modal-overlay.no-overlay {
		background: transparent;
		pointer-events: none;
	}
	.custom-modal-overlay.no-overlay.open {
		pointer-events: none;
	}
	.custom-modal-overlay.no-overlay.blur {
		backdrop-filter: none;
	}
	.custom-modal-shell {
		position: relative;
		width: min(100%, 42rem);
		max-height: calc(100dvh - 3rem);
		background: color-mix(in oklab, var(--layer-1) 100%, transparent);
		display: flex;
		flex-direction: column;
		border-radius: 12px;
		border-radius: 12px;
		box-shadow:
			0 4px 6px rgba(194, 194, 194, 0.1),
			0 1px 3px rgba(0, 0, 0, 0.08);
		border: 1px solid var(--layer-3);
		will-change: transform;
		pointer-events: auto;
		overflow: hidden;
		animation: modal-in 180ms ease;
	}
	.custom-modal-sm {
		width: min(100%, 24rem);
	}
	.custom-modal-md {
		width: min(100%, 34rem);
	}
	.custom-modal-lg {
		width: min(100%, 46rem);
	}
	.custom-modal-xl {
		width: min(100%, 58rem);
	}
	.custom-modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.7rem 1rem;
		border-bottom: 1px solid var(--layer-2);
		background:
			radial-gradient(
				120% 120% at 0% 0%,
				color-mix(in oklab, var(--layer-3) 40%, transparent),
				transparent 65%
			),
			var(--layer-2);
		cursor: move;
		user-select: none;
		touch-action: none;
	}
	.custom-modal-title {
		font-size: 1.05rem;
		font-weight: 650;
		margin: 0;
		color: var(--text-layer-0);
	}
	.custom-modal-close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.9rem;
		height: 1.9rem;
		background: transparent;
		border: none;
		border-radius: 8px;
		color: var(--text-layer-2);
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
		flex: 1 1 auto;
		min-height: 0;
		overflow: auto;
		padding: 0.9rem 1rem;
		background: var(--layer-1);
		color: var(--text-layer-1);
		font-size: 1rem;
	}
	.custom-modal-resize-handle {
		position: absolute;
		border: none;
		background: transparent;
		padding: 0;
		margin: 0;
		z-index: 2;
	}
	.custom-modal-resize-handle-right {
		top: 0.5rem;
		right: 0;
		height: calc(100% - 1rem);
		width: 8px;
		cursor: ew-resize;
	}
	.custom-modal-resize-handle-bottom {
		left: 0.5rem;
		bottom: 0;
		width: calc(100% - 1rem);
		height: 8px;
		cursor: ns-resize;
	}
	.custom-modal-resize-handle-corner {
		right: 0;
		bottom: 0;
		width: 16px;
		height: 16px;
		cursor: nwse-resize;
		background:
			linear-gradient(
				135deg,
				transparent 48%,
				var(--layer-3) 49%,
				var(--layer-3) 51%,
				transparent 52%
			),
			linear-gradient(
				135deg,
				transparent 62%,
				var(--layer-3) 63%,
				var(--layer-3) 65%,
				transparent 66%
			);
	}
	.custom-modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-top: 1px solid var(--layer-2);
		background: var(--layer-2);
		color: var(--text-layer-0);
	}

	@keyframes modal-in {
		from {
			opacity: 0;
			transform: translateY(10px) scale(0.985);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@media (max-width: 600px) {
		.custom-modal-overlay {
			padding: 0.75rem;
		}
		.custom-modal-shell {
			width: min(100%, 100vw);
			max-height: calc(100dvh - 1.5rem);
			border-radius: 8px;
		}
		.custom-modal-header,
		.custom-modal-body,
		.custom-modal-footer {
			padding-left: 0.8rem;
			padding-right: 0.8rem;
		}
	}
</style>

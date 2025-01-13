<script lang="ts">
	import { Random } from 'ts-utils/math';
	import { onMount, type Snippet } from 'svelte';
	import { SimpleEventEmitter } from 'ts-utils/event-emitter';

	const id = Random.uuid();

	const em = new SimpleEventEmitter<'hide' | 'show'>();

	interface Props {
		title: string;
		body: Snippet;
		buttons: Snippet;
		show?: boolean;
	}

	let self: HTMLDivElement;

	const { title, body, buttons, show: doShow }: Props = $props();

	const getModal = async () => {
		return import('bootstrap').then((bs) => {
			return bs.Modal.getInstance(self) || new bs.Modal(self);
		});
	};

	export const on = em.on.bind(em);
	export const once = em.once.bind(em);

	export const show = async () => {
		const modal = await getModal();
		modal.show();
	};

	export const hide = async () => {
		const modal = await getModal();
		modal.hide();
	};

	onMount(() => {
		self.addEventListener('hidden.bs.modal', () => {
			em.emit('hide');
		});

		self.addEventListener('shown.bs.modal', () => {
			em.emit('show');
		});

		if (doShow) {
			show();
		}
	});
</script>

<div bind:this={self} {id} class="modal fade" aria-modal="true" role="dialog" tabindex="-1">
	<div class="modal-dialog">
		<div class="modal-content">
			<div class="modal-header">
				<h5 class="modal-title">{title}</h5>
				<button
					class="btn-close close-modal"
					aria-label="Close"
					data-bs-dismiss="modal"
					type="button"
				></button>
			</div>
			<div class="modal-body">
				{@render body()}
			</div>
			<div class="modal-footer">
				{@render buttons()}
			</div>
		</div>
	</div>
</div>

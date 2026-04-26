<!--
@component
File upload modal backed by Uppy dashboard.

**Props**
- `multiple`?: `boolean` — Allow multiple file selection.
- `message`?: `string` — Button and modal title.
- `bucket`: `string` — Supabase storage bucket name.
- `path`?: `string` — Optional folder path in the bucket.
- `allowedFileTypes`?: `string[]` — Restrict file types.
- `allowLocal`?: `boolean` — Allow local file selection.
- `btnClasses`?: `string` — Button CSS classes.

**Exports**
- `on(event, handler)`: subscribe to `'load' | 'error'` events.
- `getUppy()`: return the Uppy instance.
- `show()`: open the modal.

**Example**
```svelte
<FileUploader bucket="avatars" path="profiles" />
```
-->
<script lang="ts" generics="M extends Meta, B extends Body">
	import Uppy, { type Body, type Meta, type UppyOptions } from '@uppy/core';
	import Dashboard from '@uppy/svelte/dashboard';
	import { EventEmitter } from 'ts-utils/event-emitter';

	import '@uppy/core/css/style.min.css';
	import '@uppy/dashboard/css/style.min.css';
	import '@uppy/image-editor/css/style.min.css';
	import Modal from '../bootstrap/Modal.svelte';
	import type { Icon } from '$lib/types/icons';
	import I from '../general/Icon.svelte';
	import supabase from '$lib/services/supabase';

	type UploadResult = {
		url: string;
		path: string;
	};

	const emitter = new EventEmitter<{
		load: UploadResult;
		error: string;
	}>();

	// listen to the 'load' event for the picture to be received
	export const on = emitter.on.bind(emitter);
	interface Props {
		bucket: string;
		path?: string;
		message?: string;
		uppyOpts?: UppyOptions<M, B>;
		allowLocal?: boolean;

		btn?: {
			text?: string;
			classes?: string;
			icon?: Icon;
			style?: string;
		}
	}

	const {
		bucket,
		path,
		message = 'Upload File',
		uppyOpts: opts,
		btn,
	}: Props = $props();

	let modal: Modal;

	const uppy = $derived(new Uppy<M, B>(opts));

	export const getUppy = () => uppy;


	const uploadDirectly = async (fileIDs: string[]) => {
		for (const fileID of fileIDs) {
			const file = uppy.getFile(fileID);
			if (!file) continue;

			const objectPath = [path ?? opts?.meta?.path, file.name].filter(Boolean).join('/');
			const contentType = file.type || 'application/octet-stream';

			try {
				const { data, error } = await supabase.storage
					.from(bucket)
					.upload(objectPath, file.data as Blob, {
						contentType,
						upsert: true
					});

				if (error) {
					console.error('Upload error:', error);
					emitter.emit('error', error.message || 'Upload failed');
					continue;
				}

				const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(data.path);
				emitter.emit('load', {
					url: publicData.publicUrl,
					path: data.path
				});
			} catch (err) {
				console.error('Unexpected error during upload:', err);
				emitter.emit('error', 'Unexpected error during upload');
			}
		}
	};

	$effect(() => {

		uppy.addUploader(uploadDirectly);

		return () => {
			uppy.removeUploader(uploadDirectly);
		};
	});
</script>

<button type="button" class={btn?.classes || ''} onclick={() => modal.show()}>
	{#if btn?.icon}
		<I icon={btn.icon} />
	{:else}
		<i class="material-icons">add</i>
	{/if}
	{btn?.text || message}
</button>

<Modal title={message} size="lg" bind:this={modal}>
	{#snippet body()}
		<div class="container-fluid">
			<Dashboard
				{uppy}
				props={{
					theme: 'dark',
					proudlyDisplayPoweredByUppy: false,
					inline: true,
					autoOpen: 'imageEditor',
					disabled: false,
				}}
			/>
		</div>
	{/snippet}
	{#snippet buttons()}{/snippet}
</Modal>

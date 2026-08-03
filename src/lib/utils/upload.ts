import { type Client } from '$lib/services/supabase/supastruct.svelte';
import Dashboard from '@uppy/svelte/dashboard';
import Uppy, {
	type Body,
	type Meta,
	type UppyOptions,
	type BasePlugin,
	type PluginOpts
} from '@uppy/core';
import { attemptAsync } from 'ts-utils';
import { rawModal } from '$lib/utils/prompts';
import { mount } from 'svelte';
import '@uppy/core/css/style.min.css';
import '@uppy/dashboard/css/style.min.css';
import '@uppy/image-editor/css/style.min.css';

type PluginClass<M extends Meta, B extends Body> =
	new (uppy: Uppy<M, B>, opts?: Record<string, unknown>) => BasePlugin<PluginOpts, M, B>;
type PluginConfig<M extends Meta, B extends Body> = {
	plugin: PluginClass<M, B>;
	opts?: Record<string, unknown>;
};
type PluginEntry<M extends Meta, B extends Body> = PluginClass<M, B> | PluginConfig<M, B>;
type PictureUploadConfig<M extends Meta, B extends Body, O extends UppyOptions<M, B>> = {
	bucket: string;
	client: Client;
	opts: Partial<O>;
	plugins?: PluginEntry<M, B>[];
};
export const upload = <M extends Meta, B extends Body, O extends UppyOptions<M, B>>(config: PictureUploadConfig<M, B, O>) => {
	return attemptAsync(async () => {
		return new Promise<{
		id: string;
		path: string;
		fullPath: string;
	}[]>((resolve, rej) => {
		const uppy = new Uppy({
			...config.opts
		});

		if (config.plugins) {
			const uppyWithDynamicPlugins = uppy as unknown as {
				use: (plugin: PluginClass<M, B>, opts?: Record<string, unknown>) => void;
			};

			for (const pluginEntry of config.plugins) {
				if (typeof pluginEntry === 'function') {
					uppyWithDynamicPlugins.use(pluginEntry);
					continue;
				}

				uppyWithDynamicPlugins.use(pluginEntry.plugin, pluginEntry.opts);
			}
		}

		uppy.addUploader(async (files) => {
			const res = await Promise.all(
				files.map(async (file_id) => {
					const file = uppy.getFile(file_id);
					if (!file) return null;
					const object_path = [config.opts?.meta?.path, Date.now() + '_' + file.name].filter(Boolean).join('/');
					const content_type = file.type || 'application/octet-stream';

					try {
						const { data, error } = await config.client.storage
							.from(config.bucket)
							.upload(object_path, file.data as Blob, {
								contentType: content_type,
								upsert: true
							});

						if (error) {
							throw error;
						}
						return data;
					} catch (err) {
						console.error('Upload error:', err);
						uppy.emit('error', new Error(`Failed to upload ${file.name}: ${err}`));
						alert(`Failed to upload ${file.name}: ${err}`);
						return null;
					}
				})
			);

			if (res.length === 0) {
				rej('No files were uploaded.');
				return;
			}

			resolve(res.filter(Boolean));
			uppy.clear();
			modal.hide();
		});

		const modal = rawModal(
			'Upload Picture',
			[
				{
					text: 'Cancel',
					onClick: () => {
						modal.hide();
						uppy.cancelAll();
					},
					color: 'gray'
				}
			],
			(body) => {
				return mount(Dashboard, {
					target: body,
					props: {
						props: {
							theme: 'dark',
							proudlyDisplayPoweredByUppy: false,
							inline: true,
							disabled: false
						},
						uppy
					}
				});
			}
		);

		modal.show();

		modal.on('hide', () => {
			uppy.cancelAll();
			resolve([]);
		});
	})
	});
};

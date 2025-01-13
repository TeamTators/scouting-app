import { Loop } from 'ts-utils/loop';
import { attemptAsync, type Result } from 'ts-utils/check';
import { Stream } from 'ts-utils/stream';
import { v4 as uuid } from 'uuid';
export namespace Requests {
	const metadata: Record<string, string> = {};
	let requests: ServerRequest[] = [];

	class RequestError extends Error {
		constructor(
			public readonly status: number,
			public readonly message: string,
			config: GetConfig | PostConfig
		) {
			super(message + JSON.stringify(config));
			this.name = 'RequestError';
		}
	}

	new Loop(() => {
		requests = requests.filter((r) => {
			return r.time + 1000 * 60 * 5 > Date.now();
		});
	}, 1000 * 60);

	class ServerRequest<T extends 'get' | 'post' = 'get' | 'post', Return = unknown> {
		public readonly time = Date.now();
		public promise?: Promise<Result<Return>>;
		public response?: Result<Return>;
		constructor(
			public readonly url: string,
			public readonly method: T,
			public readonly config: T extends 'get' ? GetConfig : PostConfig
		) {}

		send() {
			const sending = requests.find((r) => r.id === this.id);
			if (sending && sending.promise) return sending.promise as Promise<Result<Return>>;

			this.promise = attemptAsync<Return>(async () => {
				const result = await fetch(this.url, {
					method: this.method.toUpperCase(),
					headers: {
						...(this.config?.headers ?? {}),
						...metadata,
						'Content-Type': 'application/json',
						Accept: this.config.expectStream ? 'text/event-stream' : 'application/json'
					},
					body:
						this.method === 'post' ? JSON.stringify((this.config as PostConfig).body) : undefined
				});

				if (!result.ok) {
					throw new RequestError(result.status, `Request failed: ${this.url}`, this.config);
				}

				if (this.config.expectStream) {
					const stream = new Stream();
					const reader = result.body?.getReader();
					if (reader) {
						const decoder = new TextDecoder();
						let buffer = '';
						reader.read().then(({ done, value }) => {
							try {
								if (done) return;
								buffer += decoder.decode(value, { stream: true });
								const parts = buffer.split('\n\n');
								buffer = parts.pop() ?? '';
								for (const part of parts) {
									if (part === 'end') {
										stream.end();
										reader.cancel();
										return;
									}
									stream.add(JSON.parse(part));
								}
							} catch (error) {
								console.error(error);
							}
						});
					}
					return stream;
				}

				return result.json();
			});

			this.promise.then((r) => (this.response = r));

			return this.promise;
		}

		get id() {
			return `${this.url}${this.method}${JSON.stringify(Object.entries(this.config).sort((a, b) => a[0].localeCompare(b[0])))}`;
		}
	}

	export type GetConfig = {
		expectStream: boolean;
		headers?: Record<string, string>;
		cache?: boolean;
	};
	export const get = async <T = unknown>(url: string, config: GetConfig) => {
		const sr = new ServerRequest<'get', T>(url, 'get', config);
		requests.push(sr);
		return sr.send();
	};

	export type PostConfig = {
		expectStream: boolean;
		headers?: Record<string, string>;
		body: unknown;
		cache?: boolean;
	};
	export const post = async <T = unknown>(url: string, config: PostConfig) => {
		const sr = new ServerRequest<'post', T>(url, 'post', config);
		requests.push(sr);
		return sr.send();
	};

	export const setMeta = (key: string, value: string) => {
		metadata.key = value;
	};
}

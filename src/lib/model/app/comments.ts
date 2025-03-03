import type { Writable } from 'svelte/store';
import { App } from './app';

type C = Record<string, string>;

export class Comments implements Writable<C> {
	public comments: C = {};

	constructor(public readonly app: App) {}

	private readonly subscribers = new Set<(value: C) => void>();

	public subscribe(run: (value: C) => void): () => void {
		this.subscribers.add(run);
		run(this.comments);
		return () => this.subscribers.delete(run);
	}

	public inform() {
		this.subscribers.forEach((run) => run(this.comments));
	}

	public set(value: C): void {
		this.comments = value;
		this.inform();
	}

	public update(fn: (value: C) => C): void {
		this.set(fn(this.comments));
	}

	init() {
		return () => {};
	}
}

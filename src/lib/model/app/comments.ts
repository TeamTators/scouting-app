import type { Writable } from 'svelte/store';
import { App } from './app';

type C = Comment[];

export class Comment implements Writable<[string, string]> {
	public readonly subscribers = new Set<(value: [string, string]) => void>();

	constructor(public readonly data: [string, string], public readonly color: string) {}

	get key() {
		return this.data[0];
	}

	get value() {
		return this.data[1];
	}

	set value(value: string) {
		this.data[1] = value;
		this.inform();
	}

	public subscribe(run: (value: [string, string]) => void): () => void {
		this.subscribers.add(run);
		run(this.data);
		return () => this.subscribers.delete(run);
	}

	public set(value: [string, string]): void {
		this.data[0] = value[0];
		this.data[1] = value[1];
		this.inform();
	}

	public update(fn: (value: [string, string]) => [string, string]): void {
		this.set(fn(this.data));
	}

	inform() {
		this.subscribers.forEach((run) => run(this.data));
	}
}

export class Comments implements Writable<C> {
	public comments: C = [];

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

	public addComment(key: string, color: string) {
		this.comments.push(new Comment([key, ''], color));
		this.inform();
	}

	init() {
		this.addComment('Algae', 'warning');
		this.addComment('Auto', 'success');
		this.addComment('Teleop', 'primary');
		this.addComment('Overall', 'info');
		return () => {

			// the thermonuclear approach. this just doesn't want to work correctly.
			this.comments.forEach(comment => comment.subscribers.clear());
			this.set([]);
			this.subscribers.clear();
		};
	}

	serialize() {
		return Object.fromEntries(this.comments.map(c => c.data));
	}

	get(key: string) {
		return this.comments.find(c => c.key === key);
	}
}

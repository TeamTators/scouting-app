import { App } from './app';
import { WritableArray, WritableBase } from '$lib/writables';

export class Comment extends WritableBase<[string, string]> {
	public readonly subscribers = new Set<(value: [string, string]) => void>();

	constructor(
		data: [string, string],
		public readonly color: string
	) {
		super(data);
	}

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
}

export class Comments extends WritableArray<Comment> {
	constructor(public readonly app: App) {
		super([]);
	}

	public addComment(key: string, color: string) {
		const c = new Comment([key, ''], color);
		this.data.push(c);
		this.inform();
		this.pipe(c);
		return c;
	}

	init() {
		this.addComment('Auto', 'success');
		this.addComment('Teleop', 'primary');
		this.addComment('Overall', 'info');
		return () => {
			this.data = [];
			this.inform();
		};
	}

	serialize() {
		return Object.fromEntries(this.data.map((c) => c.data));
	}

	get(key: string) {
		return this.data.find((c) => c.key === key);
	}

	reset() {
		// go through all comments and remove their values
		for (const comment of this.data) {
			comment.value = '';
		}
	}
}

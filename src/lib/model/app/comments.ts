import { App } from './app';
import { WritableArray, WritableBase } from '$lib/services/writables';

export class Comment extends WritableBase<{
	key: string;
	value: string;
	color: string;
	show: boolean;
}> {
	constructor(key: string, color: string, show: boolean) {
		super({
			key,
			value: '',
			color,
			show
		});
	}

	get key() {
		return this.data.key;
	}

	get value() {
		return this.data.value;
	}

	set value(value: string) {
		this.data.value = value;
		this.inform();
	}
}

export class Comments extends WritableArray<Comment> {
	constructor(public readonly app: App) {
		super([]);
	}

	public addComment(key: string, color: string, show: boolean) {
		const c = new Comment(key, color, show);
		this.data.push(c);
		this.inform();
		this.pipe(c);
		return c;
	}

	init() {
		this.addComment('Auto', 'success', true);
		this.addComment('Teleop', 'primary', true);
		this.addComment('Overall', 'info', true);
		return () => {
			this.data = [];
			this.inform();
		};
	}

	serialize() {
		return Object.fromEntries(this.data.map((c) => [c.key, c.value]));
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

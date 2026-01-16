import { writable } from 'svelte/store';
import type { App } from './app';
import { WritableArray, WritableBase } from '$lib/utils/writables';
import type { Comment } from './comments';

type C =
	| {
			value: boolean;
			name: string;
			doSlider: true;
			type: 'success' | 'primary' | 'warning' | 'danger';
			render: boolean;
			slider: number;
			values: [string, string, string, string, string];
			color: [string, string, string, string, string];
			alert: false | string;
			doComment: boolean;
			comment?: Comment;
	  }
	| {
			value: boolean;
			name: string;
			doSlider: false;
			type: 'success' | 'primary' | 'warning' | 'danger';
			render: boolean;
			slider: 0;
			alert: false | string;
			doComment: boolean;
			comment?: Comment;
	  };

export class Check extends WritableBase<C> {}

export class Checks extends WritableArray<Check> {
	constructor(public readonly app: App) {
		super([]);
	}

	addCheck(
		type: 'success' | 'primary' | 'warning' | 'danger',
		check:
			| {
					name: string;
					slider: [string, string, string, string, string];
					color: [string, string, string, string, string];
					alert: false | string;
					doComment: boolean;
			  }
			| {
					name: string;
					alert: false | string;
					doComment: boolean;
			  }
			| string
	) {
		let c: Check;
		if (typeof check === 'string') {
			c = new Check({
				name: check,
				doSlider: false,
				value: false,
				type,
				render: true,
				slider: 0,
				doComment: false,
				alert: false
			});
		} else {
			let comment: Comment | undefined;
			if (check.doComment) {
				comment = this.app.comments.addComment(check.name, type, false);
			}

			if ('slider' in check) {
				c = new Check({
					name: check.name,
					doSlider: true,
					value: false,
					type,
					render: true,
					slider: 0,
					values: check.slider,
					color: check.color,
					alert: check.alert,
					doComment: check.doComment,
					comment
				});
			} else {
				c = new Check({
					name: check.name,
					doSlider: false,
					value: false,
					type,
					render: true,
					slider: 0,
					alert: check.alert,
					doComment: check.doComment,
					comment
				});
			}
			this.onAllUnsubscribe(
				c.subscribe((data) => {
					if (data.value && data.doComment && data.comment) {
						comment?.update((c) => ({
							...c,
							show: true
						}));
					} else {
						comment?.update((c) => ({
							...c,
							show: false
						}));
					}
				})
			);
		}

		this.update((checks) => {
			checks.push(c);
			return checks;
		});

		this.writables[type].update((checks) => {
			checks.push(c);
			return checks;
		});

		this.pipe(c);

		return this;
	}

	get(check: string) {
		return this.data.find((c) => c.data.name === check);
	}

	public readonly writables = {
		success: writable<Check[]>([]),
		primary: writable<Check[]>([]),
		warning: writable<Check[]>([]),
		danger: writable<Check[]>([])
	};

	serialize() {
		const checks: string[] = [];
		const sliders: Record<
			string,
			{
				value: number;
				text: string;
				color: string;
			}
		> = {};

		for (const check of this.data) {
			if (check.data.value && check.data.render) checks.push(check.data.name);
			if (check.data.doSlider && check.data.value && check.data.render)
				sliders[check.data.name] = {
					value: check.data.slider,
					text: check.data.values[check.data.slider],
					color: check.data.color[check.data.slider]
				};
		}

		return { checks, sliders };
	}

	setCheck(name: string, value: boolean) {
		this.update((checks) => {
			const check = checks.find((c) => c.data.name === name);
			if (!check) return checks;
			check.data.value = value;
			check.inform();
			return checks;
		});
	}

	reset() {
		for (const check of this.data) {
			check.data.value = false;
			check.data.slider = 0;
			check.inform();
		}
	}
}

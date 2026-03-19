/**
 * @fileoverview Check and slider models used for structured post-match scouting input.
 */

import { writable } from 'svelte/store';
import type { App } from './app';
import { WritableArray, WritableBase } from '$lib/services/writables';
import type { Comment } from './comments';

/**
 * Check record union representing plain checks and slider-backed checks.
 */
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

/**
 * Single mutable check entry.
 *
 * @extends {WritableBase<C>}
 */
export class Check extends WritableBase<C> {}

/**
 * Collection of structured checks grouped by severity style.
 *
 * @extends {WritableArray<Check>}
 * @example
 * checks.addCheck('warning', 'tippy');
 */
export class Checks extends WritableArray<Check> {
	/**
	 * Creates check collection.
	 *
	 * @param {App} app - Owning app instance.
	 */
	constructor(public readonly app: App) {
		super([]);
	}

	/**
	 * Adds a check definition.
	 *
	 * @param {'success' | 'primary' | 'warning' | 'danger'} type - Visual severity bucket.
	 * @param {(| {
	 * 	name: string;
	 * 	slider: [string, string, string, string, string];
	 * 	color: [string, string, string, string, string];
	 * 	alert: false | string;
	 * 	doComment: boolean;
	 * } | {
	 * 	name: string;
	 * 	alert: false | string;
	 * 	doComment: boolean;
	 * } | string} check - Check definition or simple check name.
	 * @returns {this} Current checks collection for chaining.
	 * @example
	 * checks.addCheck('success', {
	 *   name: 'climbed',
	 *   slider: ['Very Slow', 'Slow', 'Medium', 'Fast', 'Very Fast'],
	 *   color: ['red', 'orange', 'yellow', 'green', 'blue'],
	 *   alert: false,
	 *   doComment: false
	 * });
	 */
	addCheck(
type: 'success' | 'primary' | 'warning' | 'danger',
check:{
name: string;
slider: [string, string, string, string, string];
color: [string, string, string, string, string];
alert: false | string;
doComment: boolean;
render?: boolean;
defaultValue?: boolean;
}
| {
name: string;
alert: false | string;
doComment: boolean;
render?: boolean;
defaultValue?: boolean;
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
value: check.defaultValue ?? false,
type,
render: check.render ?? true,
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
value: check.defaultValue ?? false,
type,
render: check.render ?? true,
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

	/**
	 * Returns a check by display name.
	 *
	 * @param {string} check - Check name.
	 * @returns {Check | undefined} Matching check.
	 */
	get(check: string) {
		return this.data.find((c) => c.data.name === check);
	}

	/**
	 * Writables grouped by style/severity.
	 *
	 * @type {{
	 * 	success: import('svelte/store').Writable<Check[]>;
	 * 	primary: import('svelte/store').Writable<Check[]>;
	 * 	warning: import('svelte/store').Writable<Check[]>;
	 * 	danger: import('svelte/store').Writable<Check[]>;
	 * }}
	 */
	public readonly writables = {
		success: writable<Check[]>([]),
		primary: writable<Check[]>([]),
		warning: writable<Check[]>([]),
		danger: writable<Check[]>([])
	};

	/**
	 * Serializes selected checks and slider values.
	 *
	 * @returns {{
	 * 	checks: string[];
	 * 	sliders: Record<string, { value: number; text: string; color: string }>;
	 * }} Serialized check payload.
	 * @example
	 * const { checks, sliders } = checksModel.serialize();
	 */
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

	/**
	 * Sets check boolean value by name.
	 *
	 * @param {string} name - Check name.
	 * @param {boolean} value - Desired checked value.
	 * @returns {void}
	 */
	setCheck(name: string, value: boolean) {
		this.update((checks) => {
			const check = checks.find((c) => c.data.name === name);
			if (!check) return checks;
			check.data.value = value;
			check.inform();
			return checks;
		});
	}

	/**
	 * Resets all checks and sliders to default values.
	 *
	 * @returns {void}
	 */
	reset() {
		for (const check of this.data) {
			check.data.value = false;
			check.data.slider = 0;
			check.inform();
		}
	}
}

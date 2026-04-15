/**
 * @fileoverview Comment models used by scouting checks and summary submission.
 */

import { App } from './app';
import { WritableArray, WritableBase } from '$lib/services/writables';

/**
 * Single editable comment entry.
 *
 * @extends {WritableBase<{ key: string; value: string; color: string; show: boolean }>}
 * @example
 * const c = new Comment('Auto', 'success', true);
 * c.value = 'Fast exit from zone';
 */
export class Comment extends WritableBase<{
	key: string;
	value: string;
	color: string;
	show: boolean;
	placeholder: string;
}> {
	/**
	 * Creates a comment entry.
	 *
	 * @param {string} key - Label/category key.
	 * @param {string} color - UI color token.
	 * @param {boolean} show - Whether comment should be shown by default.
	 */
	constructor(key: string, color: string, show: boolean, placeholder: string) {
		super({
			key,
			value: '',
			color,
			show,
			placeholder,
		});
	}

	/**
	 * Category key for this comment.
	 *
	 * @type {string}
	 */
	get key() {
		return this.data.key;
	}

	/**
	 * Current comment value.
	 *
	 * @type {string}
	 */
	get value() {
		return this.data.value;
	}

	/**
	 * Updates comment value and notifies subscribers.
	 *
	 * @type {string}
	 */
	set value(value: string) {
		this.data.value = value;
		this.inform();
	}
}

/**
 * Collection of comments for a scouting run.
 *
 * @extends {WritableArray<Comment>}
 * @example
 * const comments = new Comments(app);
 * comments.init();
 */
export class Comments extends WritableArray<Comment> {
	/**
	 * Creates the comments collection.
	 *
	 * @param {App} app - Owning app instance.
	 */
	constructor(public readonly app: App) {
		super([]);
	}

	/**
	 * Adds a new comment row and wires it into writable piping.
	 *
	 * @param {string} key - Label/category key.
	 * @param {string} color - UI color token.
	 * @param {boolean} show - Whether this comment should be visible initially.
	 * @returns {Comment} Newly created comment.
	 * @example
	 * comments.addComment('Defense', 'warning', false);
	 */
	public addComment(key: string, color: string, show: boolean, placeholder: string) {
		const c = new Comment(key, color, show, placeholder);
		this.data.push(c);
		this.inform();
		this.pipe(c);
		return c;
	}

	/**
	 * Initializes default comment categories.
	 *
	 * @returns {() => void} Cleanup callback that clears all comments.
	 * @example
	 * const dispose = comments.init();
	 * dispose();
	 */
	init() {
		this.addComment('Auto', 'success', true, 'What kind of path did the robot take?');
		this.addComment('Teleop', 'primary', true, 'How did the robot perform during teleop?');
		this.addComment('Overall', 'info', true, 'Any additional comments or observations?');
		return () => {
			this.data = [];
			this.inform();
		};
	}

	/**
	 * Serializes comments to key/value object.
	 *
	 * @returns {Record<string, string>} Serialized comments.
	 * @example
	 * const payload = comments.serialize();
	 */
	serialize() {
		return Object.fromEntries(this.data.map((c) => [c.key, c.value]));
	}

	/**
	 * Returns a comment by key.
	 *
	 * @param {string} key - Comment key to find.
	 * @returns {Comment | undefined} Matching comment, if found.
	 */
	get(key: string) {
		return this.data.find((c) => c.key === key);
	}

	/**
	 * Clears all comment values.
	 *
	 * @returns {void}
	 */
	reset() {
		// go through all comments and remove their values
		for (const comment of this.data) {
			comment.value = '';
		}
	}
}

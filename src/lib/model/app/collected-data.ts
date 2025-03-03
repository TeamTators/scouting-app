import type { App } from './app';
import { Checks } from './checks';
import { Comments } from './comments';

export class CollectedData {
	public readonly checks: Checks;
	public readonly comments: Comments;

	constructor(public readonly app: App) {
		this.checks = new Checks(app);
		this.comments = new Comments(app);
	}

	init() {
		const offChecks = this.checks.init();
		const offComments = this.comments.init();

		return () => {
			offChecks();
			offComments();
		};
	}
}

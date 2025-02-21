import type { App } from "./app";
import { Checks } from "./checks";

export class CollectedData {
    public readonly checks: Checks;

    constructor(
        public readonly app: App,
    ) {
        this.checks = new Checks(app);
    }

    init() {
        this.checks.init();
    }
}
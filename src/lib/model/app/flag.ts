import { WritableBase } from "$lib/services/writables";
import type { App } from "./app";

export class ReviewFlag extends WritableBase<{
    flagged: boolean;
    reason: string;
}> {
    constructor(public readonly app: App) {
        super({
            flagged: false,
            reason: '',
        });
    }

    reset() {
        this.set({
            flagged: false,
            reason: '',
        });
    }

    serialize() {
        return {
            ...this.data,
        }
    } 
}
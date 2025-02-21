import type { Writable } from "svelte/store";
import type { App } from "./app";

export class Checks implements Writable<Set<string>> {

    public readonly data = new Set<string>();

    constructor(
        public readonly app: App,
    ) {}

    private readonly subscribers = new Set<(value: Set<string>) => void>();

    public subscribe(run: (value: Set<string>) => void): () => void {
        this.subscribers.add(run);
        run(this.data);
        return () => this.subscribers.delete(run);
    }

    public set(value: Set<string>): void {
        this.data.clear();
        value.forEach((v) => this.data.add(v));
        this.subscribers.forEach((run) => run(this.data));
    }

    public update(updater: (value: Set<string>) => Set<string>): void {
        this.set(updater(this.data));
    }

    public init() {}
}
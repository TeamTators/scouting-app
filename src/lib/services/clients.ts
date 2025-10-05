import { TabletState } from "$lib/types/tablet-state.js";
import { attemptAsync } from "ts-utils/check";
import { Random } from "ts-utils/math";
import { sse } from "./sse.js";
import { z } from 'zod';
import { writable } from "svelte/store";

export namespace State {
    export const id =(() => {
        let id = localStorage.getItem('tablet-id');
        if (!id) {
            id = Random.uuid();
            localStorage.setItem('tablet-id', id);
        }
        return id;
    })();

    export const sendState = (state: TabletState) => attemptAsync(async () => {
        return fetch(`/api/state/${id}/${state}?url=${location.pathname}`, {
            method: 'POST',
        });
    });

    export const tablets = writable<{
        id: string;
        state: TabletState;
        url: string;
    }[]>([]);

    export const initState = () => {};

    sse.on('tablet-state', (data) => {
        const parsed = z.object({
            id: z.string(),
            state: z.string(),
            url: z.string().url(),
        }).parse(data);
        if (Object.keys(TabletState).includes(parsed.state)) {
            tablets.update(t => {
                const existing = t.find(i => i.id === parsed.id);
                if (existing) {
                    existing.state = parsed.state as TabletState;
                    existing.url = parsed.url;
                } else {
                    t.push({
                        id: parsed.id,
                        state: parsed.state as TabletState,
                        url: parsed.url,
                    });
                }
                return t;
            });
        }
    });
}
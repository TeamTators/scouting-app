import { attempt, attemptAsync } from 'ts-utils/check';
import { Requests } from '../utils/requests';
import { EventEmitter } from 'ts-utils/event-emitter';
import { sse } from '../utils/sse';
import { Loop } from 'ts-utils/loop';
import { z } from 'zod';

export type TabletState = {
    matchNumber: number;
    compLevel: 'pr' | 'qm' | 'qf' | 'sf' | 'f' | string; // added "string" because svelte doesn't like ts inside of elements
    teamNumber: number;
    groupNumber: number;
    scoutName: string;
    preScouting: boolean;
};

export const TabletStateSchema = z.object({
    matchNumber: z.number().int(),
    compLevel: z.string(),
    teamNumber: z.number().int(),
    groupNumber: z.number().int(),
    scoutName: z.string(),
    preScouting: z.boolean(),
});

type TabletEvents = {
    update: TabletState;
    destroy: Tablet;
};

type GlobalEvents = {
    'new-tablet': Tablet;
    update: Tablet[];
    'delete-tablet': Tablet;
    refresh: void;
};

type TabletSafe = {
    state: TabletState;
    id: string;
};

export class Tablet {
    public readonly em = new EventEmitter<TabletEvents>();

    on = this.em.on.bind(this.em);
    off = this.em.off.bind(this.em);
    emit = this.em.emit.bind(this.em);
    once = this.em.once.bind(this.em);

    abstracted: TabletState;

    constructor(
        public readonly id: string,
        public state: TabletState
    ) {
        this.abstracted = JSON.parse(JSON.stringify(state)) as TabletState; // copy with no dependencies
    }

    get group() {
        return this.state.groupNumber + 1;
    }

    set group(group: number) {
        this.state.groupNumber = group - 1;
        this.reset();
    }

    get abstractedGroup() {
        return this.abstracted.groupNumber + 1;
    }

    set abstractedGroup(group: number) {
        this.abstracted.groupNumber = group - 1;
    }

    changeState(state: Partial<TabletState>) {
        return Requests.post('/api/tablet/change-state', {
            body: {
                ...this.state,
                ...state,
                id: this.id
            },
            expectStream: false,
            parser: z.unknown(),
        });
    }

    abort() {
        return Requests.post('/api/tablet/abort', {
            body: {
                id: this.id
            },
            expectStream: false,
            parser: z.unknown(),
        });
    }

    submit() {
        return Requests.post('/api/tablet/submit', {
            body: {
                id: this.id
            },
            expectStream: false,
            parser: z.unknown(),
        });
    }

    destroy() {
        this.emit('destroy', this);
    }

    reset() {
        this.abstracted = JSON.parse(JSON.stringify(this.state)) as TabletState;
    }
}

export class State {
    public static readonly em = new EventEmitter<GlobalEvents>();

    static on = State.em.on.bind(State.em);
    static off = State.em.off.bind(State.em);
    static emit = State.em.emit.bind(State.em);
    static once = State.em.once.bind(State.em);

    static readonly tablets = new Map<string, Tablet>();

    static pullState() {
        return attemptAsync(async () => {
            State.tablets.forEach(t => t.destroy());
            State.tablets.clear();

            const tablets = (
                await Requests.get<TabletSafe[]>('/api/tablet/pull-state', {
                    expectStream: false,
                    parser: z.array(z.object({
                        state: TabletStateSchema,
                        id: z.string(),
                    })),
                })
            ).unwrap();
            return tablets.map(t => {
                const tab = new Tablet(t.id, t.state);
                State.tablets.set(tab.id, tab);
                return tab;
            });
        });
    }

    static newTablet(id: string, state: TabletState) {
        return attempt(() => {
            const t = new Tablet(id, state);
            State.emit('new-tablet', t);
            return t;
        });
    }

    static updateTablet(id: string, state: TabletState) {
        return attempt(() => {
            const t = State.tablets.get(id);
            if (!t) throw new Error('Tablet not found');
            t.state = state;
            t.reset(); // update abstract
            t.emit('update', state);
        });
    }

    static deleteTablet(id: string) {
        return attempt(() => {
            const t = State.tablets.get(id);
            if (!t) throw new Error('Tablet not found');
            t.destroy();
            State.tablets.delete(id);
        });
    }

    static refresh() {
        State.tablets.clear();
        State.emit('refresh', undefined);
    }
}

Object.assign(window, { State });

sse.on('update-tablet', (data) => {
    const parsed = z.object({
        state: TabletStateSchema,
        id: z.string(),
    }).safeParse(data);
    if (!parsed.success) return console.error('Failed to parse tablet update', parsed.error);
    console.log('Recieved tablet update!', parsed.data.id);
    const { id, state } = parsed.data;
    State.updateTablet(id, state);
});

sse.on('new-tablet', () => {
    State.refresh();
});

sse.on('delete-tablet', () => {
    State.refresh();
});

new Loop(State.refresh, 1000 * 5).start();

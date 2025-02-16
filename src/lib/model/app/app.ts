/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @fileoverview App class
 * @description This contains the main class for the app, which is responsible for running the match and keeping track of the state of the robot over time. The data is collected every 250ms, and the app will run for 150 seconds, so there will be 600 ticks in total.
 */

import { ActionState, AppObject } from './app-object';
import { Point2D } from 'math/point'
import { EventEmitter } from 'ts-utils/event-emitter';
import { ButtonCircle } from './button-circle';
import { Canvas } from 'canvas/canvas';
import { Path } from 'canvas/path';
import { Img } from 'canvas/image';
import { Border } from 'canvas/border';
import { Polygon } from 'canvas/polygon';
import { Circle } from 'canvas/circle';
import { Color } from 'colors/color';
import { attemptAsync, Result } from 'ts-utils/check';
import { Container } from 'canvas/container';
import {
    TraceArray,
    Action,
    TraceParse,
    Zones,
    Match
} from 'tatorscout/trace';
// import { generate2024App } from './2024-app';
// import { ServerRequest } from '../../utilities/requests';
// import { alert, confirm } from '../../utilities/notifications';
import { sse } from '../../utils/sse';
import { Assignment } from 'tatorscout/scout-groups';
import {
    type CompLevel,
    matchSort,
    TBAEvent,
    TBAMatch,
    TBATeam
} from 'tatorscout/tba';
import { Icon } from 'canvas/material-icons';
import { SVG } from 'canvas/svg';
import { downloadText, loadFileContents } from '../../utils/downloads';
import { sleep } from 'ts-utils/sleep';
// import { socket } from '../../utilities/socket';
import { Random } from 'ts-utils/math';
import { Tick } from './tick';
import { MatchData } from './match-data';
import { Loop } from 'ts-utils/loop';
import { type TabletState } from '../admin';
import { generate2025App } from './2025-app';

/**
 * Description placeholder
 * @date 1/25/2024 - 4:59:07 PM
 */
const round = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Point including time
 * @date 1/9/2024 - 3:08:20 AM
 *
 * @export
 * @typedef {Point}
 */
export type Point = [...Point2D, number]; // x, y, path (time is the index of the tick)

/**
 * Data collected at a given point in time
 * @date 1/9/2024 - 3:08:20 AM
 *
 * @export
 * @typedef {CollectedData}
 */
export type CollectedData<actions = string> = ActionState<any, actions> | null;

/**
 * Section of the match
 * @date 1/9/2024 - 3:08:20 AM
 *
 * @typedef {Section}
 */
export type Section = 'auto' | 'teleop' | 'endgame' | 'end';

type UploadStatusId =
    | 'data parse error'
    | 'server error'
    | 'not uploaded'
    | 'success';

type UploadStatus = {
    id: string;
    status: UploadStatusId;
    match: Match;
};

const SAVED_MATCH_VERSION = 0;

/**
 * Events emitted by the app
 * @date 1/9/2024 - 3:08:20 AM
 *
 * @typedef {AppEvents}
 */
type AppEvents = {
    section: Section | undefined;
    error: Error;
    stop: void;
    end: void;
    stopped: void;
    tick: Tick;
    second: number;
    restart: void;
    destroy: void;
    action: {
        alliance: 'red' | 'blue' | null;
        action: string;
        point: Point2D;
    };
};

export type EventData = {
    assignments: Assignment;
    matches: TBAMatch[];
    teams: TBATeam[];
    eventKey: string;
    event: TBAEvent;
};

class FieldOrientation {
    public static get() {
        const d = window.localStorage.getItem('fieldOrientation');
        if (!d) return new FieldOrientation();
        const data = JSON.parse(d) as {
            flipX: boolean;
            flipY: boolean;
        };
        return new FieldOrientation(data.flipX, data.flipY);
    }

    constructor(
        private $flipX = true,
        private $flipY = true
    ) {}

    private save() {
        window.localStorage.setItem(
            'fieldOrientation',
            JSON.stringify({
                flipX: this.$flipX,
                flipY: this.$flipY
            })
        );
    }

    public get flipX() {
        return this.$flipX;
    }

    public set flipX(flipX: boolean) {
        this.$flipX = flipX;
        this.save();
    }

    public get flipY() {
        return this.$flipY;
    }

    public set flipY(flipY: boolean) {
        this.$flipY = flipY;
        this.save();
    }
}

type Area = {
    area: Polygon | Circle;
    color: Color;
    condition: (shape: Polygon) => boolean;
};

type GlobalEvents = {
    'change-name': string;
    'new-event': EventData;
    'select-match': MatchData;
};

/**
 * The full scouting app, including the canvas and all the buttons
 * @date 1/9/2024 - 3:08:20 AM
 *
 * @export
 * @class App
 * @typedef {App}
 */
export class App<
    a extends Action = Action,
    z extends Zones = Zones,
    p extends TraceParse = TraceParse
> {
    public static button(classes: string[], html: string | Node) {
        const b = document.createElement('button');
        if (typeof html === 'string') {
            b.innerHTML = html;
        } else {
            b.appendChild(html);
        }
        b.classList.add('btn', 'p-1', ...classes);
        return b;
    }

    private static readonly emitter = new EventEmitter<GlobalEvents>();

    public static on<E extends keyof GlobalEvents>(
        event: E,
        listener: (data: GlobalEvents[E]) => void
    ) {
        App.emitter.on(event, listener);
    }

    public static off<E extends keyof GlobalEvents>(
        event: E,
        listener: (data: GlobalEvents[E]) => void
    ) {
        App.emitter.off(event, listener);
    }

    public static emit<E extends keyof GlobalEvents>(
        event: E,
        data: GlobalEvents[E]
    ) {
        App.emitter.emit(event, data);
    }

    public static once<E extends keyof GlobalEvents>(
        event: E,
        listener: (data: GlobalEvents[E]) => void
    ) {
        App.emitter.once(event, listener);
    }

    private static $eventData?: EventData;

    public static matchData = MatchData.get();
    public static $scoutName = window.localStorage.getItem('scoutName') || '';
    public static $preScouting =
        window.localStorage.getItem('preScouting') === 'true';

    public static $events: TBAEvent[] = JSON.parse(
        window.localStorage.getItem('events') || '[]'
    );

    public static get events() {
        return App.$events;
    }

    public static set events(events: TBAEvent[]) {
        App.$events = events;
        window.localStorage.setItem('events', JSON.stringify(events));
        App.updateState();
    }

    public static get preScouting() {
        return App.$preScouting;
    }

    public static set preScouting(preScouting: boolean) {
        App.$preScouting = preScouting;
        window.localStorage.setItem('preScouting', preScouting.toString());
        App.updateState();
    }

    public static get scoutName() {
        return App.$scoutName;
    }

    public static set scoutName(scoutName: string) {
        App.$scoutName = scoutName;
        window.localStorage.setItem('scoutName', scoutName);
        App.emit('change-name', scoutName);
        App.updateState();
    }

    public static get group() {
        return App.matchData.group;
    }

    public static current?: App<any, any, any>;
    public static build(
        year: 2024 | 2025,
        alliance: 'red' | 'blue' | null = null
    ) {
        switch (year) {
            case 2024:
                return generate2024App(alliance);
            case 2025:
                return generate2025App(alliance);
        }
    }

    public static actionAnimation(
        icon: HTMLElement,
        alliance: 'red' | 'blue' | null
    ) {
        icon = icon.cloneNode() as HTMLElement;
        icon.classList.add('animate__animated', 'animate__bounceIn');
        icon.style.position = 'absolute';
        const { current } = App;
        if (!current) return;

        const point = current.currentLocation;
        if (!point) return;

        const { target, xOffset, yOffset } = current;
        if (!target) return;

        icon.style.left = `calc(${point[0] * current.width + xOffset}px - 30px)`;
        icon.style.top = `calc(${point[1] * current.height + yOffset}px - 30px)`;
        icon.style.zIndex = '1000';
        // icon.style.transform = 'translate(-50%, -50%)';

        icon.style.color = (() => {
            switch (alliance) {
                case 'red':
                    return Color.fromBootstrap('red');
                case 'blue':
                    return Color.fromBootstrap('blue');
                default:
                    return Color.fromBootstrap('dark');
            }
        })().toString('rgba');

        target.appendChild(icon);

        const onEnd = async () => {
            icon.removeEventListener('animationend', onEnd);

            icon.classList.remove('animate__bounceIn', 'animate__animated');
            await sleep(500);
            icon.classList.add('animate__animated', 'animate__bounceOut');
            icon.addEventListener('animationend', () => {
                icon.remove();
            });
        };

        icon.addEventListener('animationend', onEnd);
    }

    static cache(): {
        trace: TraceArray;
        tick: number;
        location: Point2D;
    } | null {
        const data = window.localStorage.getItem('app');
        if (!data) return null;
        return JSON.parse(data);
    }

    static restore(app: App) {
        const d = App.cache();
        if (!d) return;
        const { trace, location, tick } = d;
        const { currentTick } = app;

        app.build();
        // simulate ticks
        for (let i = 0; i < app.ticks.length; i++) {
            const tick = app.ticks[i];
            const p = trace.find(p => p[0] === i);
            if (!p) continue;

            try {
                app.currentTick = tick;
                tick.point = [p[1], p[2]];
                app.currentLocation = tick.point;
                const obj = app.appObjects[p[3] as number] as AppObject<
                    unknown,
                    Action
                >;
                obj.change(app.currentLocation);
            } catch (e) {
                console.error(e);
            }
        }

        app.currentLocation =
            location !== undefined ? location : app.currentLocation;
        app.currentTick = tick !== undefined ? app.ticks[tick] : currentTick;
    }

    static save(app: App) {
        window.localStorage.setItem(
            'app',
            JSON.stringify({
                trace: app.pull(),
                tick: app.currentTick?.index,
                location: app.currentLocation
            })
        );
    }

    static clearCache() {
        window.localStorage.removeItem('app');
    }

    static async uploadFromJSON() {
        return attemptAsync(async () => {
            const files = await loadFileContents();
            if (files.isErr()) throw files.error;
            const data = files.value
                .map(d => {
                    try {
                        const data = JSON.parse(d.text) as Match;
                        if (!data.trace) throw new Error('Data is not correct');
                        return data;
                    } catch (e) {
                        console.error(e);
                        return null;
                    }
                })
                .filter(Boolean) as Match[];

            App.upload(...data);
        });
    }

    static getFromLocalStorage() {
        return JSON.parse(
            window.localStorage.getItem(
                SAVED_MATCH_VERSION + '-savedMatches'
            ) || '[]'
        ) as UploadStatus[];
    }

    static saveToLocalStorage(...matches: Match[]) {
        const saved = JSON.parse(
            window.localStorage.getItem(
                SAVED_MATCH_VERSION + '-savedMatches'
            ) || '[]'
        ) as UploadStatus[];

        const ids: string[] = [];

        saved.push(
            ...matches.map(m => {
                const id = Random.uuid();
                ids.push(id);
                return {
                    id,
                    match: m,
                    status: 'not uploaded' as UploadStatus['status']
                };
            })
        );

        window.localStorage.setItem(
            SAVED_MATCH_VERSION + '-savedMatches',
            JSON.stringify(saved)
        );

        return ids;
    }

    static updateLocalStorage(id: string, status: UploadStatusId) {
        const saved = JSON.parse(
            window.localStorage.getItem(
                SAVED_MATCH_VERSION + '-savedMatches'
            ) || '[]'
        ) as UploadStatus[];

        const index = saved.findIndex(s => s.id === id);
        if (index === -1) return;

        saved[index].status = status;

        window.localStorage.setItem(
            SAVED_MATCH_VERSION + '-savedMatches',
            JSON.stringify(saved)
        );
    }

    static deleteFromLocalStorage(...ids: string[]) {
        const saved = JSON.parse(
            window.localStorage.getItem(
                SAVED_MATCH_VERSION + '-savedMatches'
            ) || '[]'
        ) as UploadStatus[];

        window.localStorage.setItem(
            SAVED_MATCH_VERSION + '-savedMatches',
            JSON.stringify(saved.filter(s => !ids.includes(s.id)))
        );
    }

    static async uploadFromLocalStorage() {
        return attemptAsync(async () => {
            const saved = App.getFromLocalStorage();
            const results = await Promise.all(
                saved.map(async m => {
                    if (m.status === 'data parse error') return false; // don't try to upload if the data is bad, it may need to be changed manually
                    const d = await ServerRequest.post('/submit', m.match);
                    return d.isOk();
                })
            );

            const failed = saved.filter((_, i) => !results[i]);

            window.localStorage.setItem(
                SAVED_MATCH_VERSION + '-savedMatches',
                JSON.stringify([...saved, ...failed])
            );

            return results;
        });
    }

    static async upload(
        ...matches: Match[]
    ): Promise<Result<UploadStatusId[]>> {
        return attemptAsync(async () => {
            return await Promise.all(
                matches.map(async m => {
                    const d = await ServerRequest.post('/submit', m);
                    if (d.isOk()) return 'success';

                    if (d.error.message.includes('invalid'))
                        return 'data parse error';
                    return 'server error';
                })
            );
        });
    }

    public static async getEventData(key?: string): Promise<Result<EventData>> {
        return attemptAsync(async () => {
            // console.log(!key, App.$eventData);
            if (!key && !!App.$eventData) return App.$eventData;
            // console.log('Requesting event data');
            const res = await ServerRequest.post<EventData>('/event-data', {
                key: key || ''
            });
            if (res.isOk()) {
                const prev = App.$eventData;
                App.$eventData = res.value;
                if (prev?.eventKey !== res.value.eventKey) {
                    res.value.matches = res.value.matches.sort(matchSort);
                    App.emit('new-event', res.value);
                }
                return res.value;
            }
            alert('Error getting scout groups');
            throw res.error;
        });
    }

    public static updateState() {
        return ServerRequest.post('/api/tablet/update', {
            compLevel: App.matchData.compLevel,
            groupNumber: App.matchData.group,
            matchNumber: App.matchData.matchNumber,
            teamNumber: App.matchData.teamNumber,
            scoutName: App.scoutName,
            preScouting: App.preScouting
        });
    }

    // ▄▀▀ ▄▀▄ █▄ █ ▄▀▀ ▀█▀ ▄▀▄ █▄ █ ▀█▀ ▄▀▀
    // ▀▄▄ ▀▄▀ █ ▀█ ▄█▀  █  █▀█ █ ▀█  █  ▄█▀
    /**
     * All the sections of the match
     * @date 1/9/2024 - 3:08:20 AM
     *
     * @public
     * @static
     * @readonly
     * @type {{
     *         [key in Section]: [number, number]
     *     }}
     */
    public static readonly sections: {
        [key in Section]: [number, number];
    } = {
        // [sectionName]: [start, end]
        auto: [0, 15],
        teleop: [16, 135],
        endgame: [136, 150],
        end: [151, 160] // goes a hair over if the user is a little late
    };

    /**
     * The number of ticks per second
     * @date 1/9/2024 - 3:33:17 AM
     *
     * @public
     * @static
     * @readonly
     * @type {4}
     */
    public static readonly ticksPerSecond = 4;

    /**
     * Duration of a tick in ms
     * @date 1/9/2024 - 3:33:17 AM
     *
     * @public
     * @static
     * @readonly
     * @type {number}
     */
    public static get tickDuration() {
        return 1000 / App.ticksPerSecond;
    }

    /**
     * Description placeholder
     * @date 1/25/2024 - 4:59:07 PM
     *
     * @private
     * @type {?HTMLDivElement}
     */
    private $target?: HTMLDivElement;

    public readonly parsed: Partial<p> = {};

    private clicking = false;

    /**
     * Creates an instance of App.
     * @date 1/9/2024 - 3:08:20 AM
     *
     * @constructor
     * @param {HTMLDivElement} target
     */
    constructor(
        public readonly year: number,
        public readonly icons: Partial<{
            [key in Action]: Icon | SVG | Img;
        }>
    ) {
        if (App.current) {
            App.current.destroy();
        }
        App.current = this;
        this.canvas.ctx.canvas.style.position = 'absolute';

        this.background = new Img(`/public/pictures/${this.year}field.png`, {
            x: 0,
            y: 0,
            width: 1,
            height: 1
        });

        this.path.properties.line = {
            color: Color.fromName('black').toString('rgba'),
            width: 1
        };

        // this.canvas.add(this.background, this.path);

        this.clicking = false;

        const click = () => {
            this.clicking = true;

            setTimeout(unclick, App.tickDuration);
        };
        const unclick = () => (this.clicking = false);

        // this.buttonCircle.on('click', click);
        this.buttonCircle.on('mousedown', click);
        this.buttonCircle.on('mouseup', unclick);
        this.buttonCircle.on('touchstart', click);
        this.buttonCircle.on('touchend', unclick);
        this.buttonCircle.on('touchcancel', unclick);

        this.setView();

        this.canvas.data = this;

        for (const [action, icon] of Object.entries(this.icons)) {
            this.icons[action as keyof typeof this.icons] = icon.clone();
        }

        // if (App.cache()) {
        //     choose(
        //         'You have a cached match. Would you like to restore it or destroy it?',
        //         'Restore cached',
        //         'Delete cached',
        //     ).then((res) => {
        //         switch (res) {
        //             case 'Delete cached':
        //                 App.clearCache();
        //                 break;
        //             case 'Restore cached':
        //                 App.restore(this as App<any, any, any>);
        //                 break;
        //             case null:
        //                 App.clearCache();
        //                 break;
        //         }
        //     });
        // }

        document.querySelectorAll('.cover').forEach(c => c.remove());

        this.cover.classList.add('cover');
    }

    /**
     * Description placeholder
     * @date 1/25/2024 - 4:59:07 PM
     *
     * @type {*}
     */
    get target() {
        return this.$target;
    }

    /**
     * Description placeholder
     * @date 1/25/2024 - 4:59:07 PM
     *
     * @type {*}
     */
    set target(target: HTMLDivElement | undefined) {
        this.$target = target;
        if (target) {
            target.style.position = 'relative';
            target.classList.add('no-scroll');
            target.style.height = 'calc(100vh - 42px)';
            target.style.width = '100%';
            this.setView();

            if (!this.currentTick) {
                this.cover.style.position = 'absolute';
                this.cover.style.width = '100%';
                this.cover.style.height = '100%';
                this.cover.style.zIndex = '1000';
                this.cover.style.backgroundColor = Color.fromBootstrap('dark')
                    .setAlpha(0.75)
                    .toString('rgba');
                this.cover.style.display = 'block';
                this.cover.classList.add('no-select');
                this.cover.innerHTML = `
                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 2em;">
                        <h4>
                            Match <span class="text-primary">${App.matchData.compLevel}${App.matchData.matchNumber}</span> is ready, please take this time to locate where your robot (<span class="text-primary">${App.matchData.teamNumber}</span>) is on the field.
                            <br>
                            <br>
                            Click anywhere to start
                            <br>
                            <br>
                            <small>If there is an error with the team/match/comp level, it's recommended you change it after the match is over so you don't miss anything.</small>
                        </h4>
                    </div>
                `;
                target.appendChild(this.cover);
            }

            this.cancel.classList.add('btn', 'btn-secondary');
            this.cancel.style.position = 'absolute';
            this.cancel.style.bottom = '10px';
            this.cancel.style.right = '10px';
            this.cancel.style.zIndex = '100';
            this.cancel.innerHTML = 'Cancel';
            this.cancel.onclick = async () => {
                const confirmed = await confirm(
                    'Are you sure you want to cancel?'
                );
                if (!confirmed) return;
                App.abort();
                this.emit('restart', undefined);
            };
            target.appendChild(this.cancel);
        }
    }

    private readonly cover = document.createElement('div');

    private readonly cancel = document.createElement('button');

    private static readonly $fieldOrientation = FieldOrientation.get();

    static get flipX() {
        return App.$fieldOrientation.flipX;
    }

    static set flipX(flip: boolean) {
        App.$fieldOrientation.flipX = flip;

        // it's possible to flip in the middle of a match, so we need to update the tick's location data

        if (App.current) {
            for (const t of App.current.ticks) {
                t.point = t.point
                    ? [flip ? 1 - t.point[0] : t.point[0], t.point[1]]
                    : null;
            }
        }
    }

    static get flipY() {
        return App.$fieldOrientation.flipY;
    }

    static set flipY(flip: boolean) {
        App.$fieldOrientation.flipY = flip;

        // it's possible to flip in the middle of a match, so we need to update the tick's location data

        if (App.current) {
            for (const t of App.current.ticks) {
                t.point = t.point
                    ? [t.point[0], flip ? 1 - t.point[1] : t.point[1]]
                    : null;
            }
        }
    }

    static get rotate() {
        return App.flipX && App.flipY;
    }

    static set rotate(rotate: boolean) {
        App.flipX = rotate;
        App.flipY = rotate;
    }

    /**
     * Description placeholder
     * @date 1/25/2024 - 4:59:07 PM
     *
     * @private
     */
    private setView() {
        const { target } = this;
        if (!target) return;

        this.background.mirror.x = App.flipX;
        this.background.mirror.y = App.flipY;

        for (const zone of Object.values(this.areas)) {
            (zone as Area).area.properties.mirror = {
                x: App.flipX,
                y: App.flipY
            };
        }

        if (this.border) {
            this.border.properties.mirror = {
                x: App.flipX,
                y: App.flipY
            };
        }

        if (target.clientWidth > target.clientHeight * 2) {
            const xOffset = (target.clientWidth - target.clientHeight * 2) / 2;
            this.canvas.ctx.canvas.width = target.clientHeight * 2;
            this.canvas.ctx.canvas.height = target.clientHeight;
            this.height = target.clientHeight;
            this.width = target.clientHeight * 2;
            this.canvas.ctx.canvas.style.top = '0px';
            this.canvas.ctx.canvas.style.left = `${xOffset}px`;
            this.xOffset = xOffset;
            this.yOffset = 0;

            for (const o of this.gameObjects) {
                const { element, viewCondition } = o;
                let { x, y } = o;

                x = App.flipY ? 1 - x : x; // flip around y axis
                y = App.flipX ? 1 - y : y; // flip around x axis

                element.style.left = `${x * this.canvas.width + xOffset}px`;
                element.style.top = `${y * this.canvas.height}px`;

                if (viewCondition && this.currentTick) {
                    if (viewCondition(this.currentTick)) {
                        element.style.display = 'block';
                    } else {
                        element.style.display = 'none';
                    }
                }
            }
        } else {
            const yOffset = (target.clientHeight - target.clientWidth / 2) / 2;
            this.canvas.ctx.canvas.width = target.clientWidth;
            this.canvas.ctx.canvas.height = target.clientWidth / 2;
            this.height = target.clientWidth / 2;
            this.width = target.clientWidth;
            this.canvas.ctx.canvas.style.top = `${yOffset}px`;
            this.canvas.ctx.canvas.style.left = '0px';
            this.xOffset = 0;
            this.yOffset = yOffset;

            for (const o of this.gameObjects) {
                const { element, viewCondition } = o;
                let { x, y } = o;

                x = App.flipX ? 1 - x : x; // flip around y axis
                y = App.flipY ? 1 - y : y; // flip around x axis

                element.style.left = `${x * this.canvas.width}px`;
                element.style.top = `${y * this.canvas.height + yOffset}px`;

                if (viewCondition && this.currentTick) {
                    if (viewCondition(this.currentTick)) {
                        element.style.display = 'block';
                    } else {
                        element.style.display = 'none';
                    }
                }
            }
        }

        // flip x and y axis based on field orientation
        // const { background } = this;
        // background.properties
    }

    // █ █ ▄▀▄ █▀▄ █ ▄▀▄ ██▄ █   ██▀ ▄▀▀
    // ▀▄▀ █▀█ █▀▄ █ █▀█ █▄█ █▄▄ █▄▄ ▄█▀
    /**
     * The current time in the match
     * @date 1/9/2024 - 3:08:20 AM
     *
     * @public
     * @type {number}
     */
    public currentTime = 0; // ms
    /**
     * The time the match started (date)
     * @date 1/9/2024 - 3:08:20 AM
     *
     * @public
     * @type {number}
     */
    public startTime = 0; // ms
    /**
     * The current tick of the match
     * @date 1/9/2024 - 3:08:20 AM
     *
     * @public
     * @type {(Tick | undefined)}
     */
    public currentTick: Tick<a> | undefined = undefined;
    /**
     * The current location of the robot [x, y]
     * @date 1/9/2024 - 3:08:20 AM
     *
     * @public
     * @type {(Point2D | undefined)}
     */
    public currentLocation: Point2D | undefined = undefined;
    /**
     * Description placeholder
     * @date 1/25/2024 - 4:59:07 PM
     *
     * @public
     * @type {number}
     */
    public xOffset = 0;
    /**
     * Description placeholder
     * @date 1/25/2024 - 4:59:07 PM
     *
     * @public
     * @type {number}
     */
    public yOffset = 0;
    /**
     * Description placeholder
     * @date 1/25/2024 - 4:59:07 PM
     *
     * @public
     * @type {number}
     */
    public width = 0;
    /**
     * Description placeholder
     * @date 1/25/2024 - 4:59:07 PM
     *
     * @public
     * @type {number}
     */
    public height = 0;

    // █▀▄ █▀▄ ▄▀▄ █   █ ▄▀▄ ██▄ █   ██▀ ▄▀▀
    // █▄▀ █▀▄ █▀█ ▀▄▀▄▀ █▀█ █▄█ █▄▄ █▄▄ ▄█▀
    /**
     * Whether the robot is drawing or not
     * @date 1/9/2024 - 3:08:20 AM
     *
     * @public
     * @readonly
     * @type {Path}
     */
    public readonly path: Path = new Path([]);
    /**
     * The circle of buttons surrounding the robot
     * @date 1/9/2024 - 3:08:20 AM
     *
     * @public
     * @readonly
     * @type {*}
     */
    public readonly buttonCircle = new ButtonCircle<a>(this as unknown as App);

    public readonly appObjects: AppObject<any, a>[] = [];

    get appObjectData() {
        const output = {} as {
            [key: string]: unknown;
        };
        for (const action of this.appObjects) {
            output[action.name] = action.state;
        }
        return output;
    }

    /**
     * All the game objects and their respective locations on the field
     * @date 1/9/2024 - 3:08:20 AM
     *
     * @public
     * @readonly
     * @type {{
     *         x: number;
     *         y: number;
     *         object: AppObject;
     *     }[]}
     */
    public readonly gameObjects: {
        x: number;
        y: number;
        object: AppObject<any, a>;
        element: HTMLElement;
        alliance: 'red' | 'blue' | null;
        viewCondition?: (tick: Tick<a>) => boolean;
    }[] = [];

    public readonly areas = {} as {
        [key in z]: Area;
    };

    /**
     * Whether the robot is drawing or not
     * @date 1/9/2024 - 3:08:20 AM
     *
     * @public
     * @readonly
     * @type {Img}
     */
    public readonly background: Img;

    /**
     * The border of the field
     * @date 1/9/2024 - 3:23:58 AM
     *
     * @public
     * @type {?Border}
     */
    private $border?: Border;
    /**
     * The areas of the field (Any area that is of significance)
     * @date 1/9/2024 - 3:23:58 AM
     *
     * @public
     * @readonly
     * @type {(Polygon | Circle)[]}
     */
    // public readonly areas: (Polygon | Circle)[] = [];

    /**
     * Sets the border of the field
     * @date 1/9/2024 - 3:23:58 AM
     *
     * @param {Point2D[]} points
     * @param {Color} color
     * @returns {*}
     */
    setBorder(points: Point2D[], color: Color) {
        if (this.border) throw new Error('Border already set');
        const b = new Border(points);
        b.properties.doDraw = () =>
            this.currentLocation ? b.isIn(this.currentLocation) : false;
        b.properties.fill = {
            color: color.toString('rgba')
        };

        this.canvas.add(b);
        this.border = b;
        return b;
    }

    /**
     * Adds an area to the field
     * @date 1/9/2024 - 3:23:58 AM
     *
     * @param {Point2D[]} points
     * @param {Color} color
     * @returns {*}
     */
    addArea(
        zone: z,
        points: Point2D[],
        color: Color,
        condition: (shape: Polygon) => boolean
    ) {
        const p = new Polygon(points);

        p.properties.doDraw = () => {
            const draw = condition(p);

            return draw;
        };
        p.properties.fill = {
            color: color.toString('rgba')
        };
        p.properties.line = {
            color: 'transparent'
        };

        // p.fade(5);

        this.canvas.add(p);
        // this.areas.push(p);

        this.areas[zone] = {
            area: p,
            color: color,
            condition: condition
        };

        return p;
    }

    /**
     * The canvas element
     * @date 1/9/2024 - 3:08:20 AM
     *
     * @public
     * @readonly
     * @type {*}
     */
    public readonly canvasEl = document.createElement('canvas');
    /**
     * The canvas object
     * @date 1/9/2024 - 3:08:20 AM
     *
     * @public
     * @readonly
     * @type {*}
     */
    public readonly canvas = new Canvas<App<a, z>>(
        this.canvasEl.getContext('2d')!,
        {
            events: [
                'click',
                'mousedown',
                'mouseup',
                'touchstart',
                'touchend',
                'touchcancel'
            ]
        }
    );
    /**
     * Whether the app has been built or not
     * @date 1/9/2024 - 3:08:20 AM
     *
     * @private
     * @type {boolean}
     */
    private built = false;

    /**
     * Event emitter for the app
     * @date 1/9/2024 - 3:08:20 AM
     *
     * @private
     * @readonly
     * @type {EventEmitter<keyof AppEvents>}
     */
    private readonly emitter = new EventEmitter<AppEvents>();

    /**
     * All the ticks of the match
     * @date 1/9/2024 - 3:08:20 AM
     *
     * @public
     * @readonly
     * @type {Tick[]}
     */
    public ticks: Tick<a>[] = [];

    /**
     * Description placeholder
     * @date 1/25/2024 - 4:59:07 PM
     *
     * @public
     * @type {boolean}
     */
    public isDrawing = false;

    private paused?: Promise<void>;

    public pause(): () => void {
        this.paused = new Promise((res, rej) => {});
        return () => {
            if (this.paused) Promise.resolve(this.paused);
        };
    }

    /**
     * Launch the app
     * @date 1/9/2024 - 3:08:20 AM
     *
     * @public
     * @param {() => void} cb The callback to run every tick
     * @returns {void) => void}
     */
    public launch(cb?: (tick: Tick) => void) {
        this.stop();
        this.off('stop');
        const { cover } = this;
        this.build();
        this.startTime = Date.now();
        this.currentTime = this.startTime;
        this.currentTick = this.ticks[0];

        let i = 0;
        const loop = new Loop(() => {
            const now = Date.now();
            const { section } = this;
            this.currentTick = this.currentTick?.next();
            console.log('Tick:', this.currentTick);
            if (this.section !== section)
                this.emit('section', this.section || undefined);

            if (!loop.active) this.emit('stopped', undefined);
            if (!this.currentTick) return this.emit('end', undefined);
            this.currentTime = now - this.startTime;
            this.emit('tick', this.currentTick);
            if (this.currentLocation)
                this.currentTick.point = this.currentLocation;

            if (i % 4 === 0) this.emit('second', this.currentTick.second);

            try {
                const s = Date.now();
                cb?.(this.currentTick);
                if (Date.now() - s > 250)
                    console.warn('Callback took too long');
            } catch (error) {
                this.emitter.emit('error', error as Error);
                return this.stop();
            }

            App.save(this as App<any, any, any>);
            i++;
        }, App.tickDuration);

        this.on('stop', () => {
            loop.stop();
            this.currentTick = undefined;
        });

        // adaptive loop to be as close to 250ms as possible
        // MAIN EVENT LOOP
        // const run = async (t: Tick | undefined, i: number) => {
        //     // console.log(t);
        //     const start = Date.now();

        //     const { section } = this;
        //     this.currentTick = t;
        //     if (this.section !== section) {
        //         this.emit('section', this.section ?? undefined);
        //     }

        //     if (!t) return this.emit('end');
        //     if (!active) return this.emit('stopped');
        //     this.emit('tick', t);
        //     this.currentTime = start - this.startTime;
        //     if (this.currentLocation) t.point = this.currentLocation;

        //     if (i % 4 === 0) {
        //         this.emit('second', t.second);
        //     }

        //     try {
        //         const s = Date.now();
        //         cb?.(t);
        //         if (Date.now() - s > 250) {
        //             console.warn('Callback took too long');
        //         }
        //     } catch (error) {
        //         this.$emitter.emit('error', error);
        //         return this.stop();
        //     }

        //     const end = Date.now();
        //     const duration = end - start;
        //     const delay = App.tickDuration - duration;

        //     // there could be a major delay if the callback takes too long, so we need to account for that
        //     setTimeout(
        //         () => run(this.currentTick?.next(), i++),
        //         // I don't understand why I need to multiply this by 2, but evidently I need to???
        //         Math.max(0, delay) // * 2,
        //     );
        //     App.save(this as App<any, any, any>);
        // };

        const start = (e: MouseEvent | TouchEvent) => {
            const [x, y] = this.canvas.getXY(e);
            cover.style.display = 'none';
            // run(this.currentTick || this.ticks[0], 0);
            loop.start();
            const newEvent = new Event('mousedown');
            Object.defineProperties(newEvent, {
                clientX: { value: x },
                clientY: { value: y },
                touches: { value: [{ clientX: x, clientY: y }] }
            });
            this.canvasEl.dispatchEvent(newEvent);
            cover.removeEventListener('mousedown', start);
            cover.removeEventListener('touchstart', start);
        };

        cover.addEventListener('mousedown', start);
        cover.addEventListener('touchstart', start);

        this._stop = () => {
            cover.removeEventListener('mousedown', start);
            cover.removeEventListener('touchstart', start);
            loop.stop();
        };
    }

    private _stop = () => {};

    /**
     * The current section of the match
     * @date 1/9/2024 - 3:08:20 AM
     *
     * @public
     * @readonly
     * @type {(Section | null)}
     */
    public get section(): Section | null {
        if (!this.currentTick) return null;
        for (const [section, range] of Object.entries(App.sections)) {
            const [start, end] = range as number[];
            if (
                this.currentTick.second >= start &&
                this.currentTick.second <= end
            ) {
                return section as Section;
            }
        }
        return null;
    }

    /**
     * Description placeholder
     * @date 1/25/2024 - 4:59:07 PM
     *
     * @public
     * @type {(Border | undefined)}
     */
    public get border(): Border | undefined {
        return this.$border;
    }

    /**
     * Description placeholder
     * @date 1/25/2024 - 4:59:07 PM
     *
     * @public
     * @type {*}
     */
    public set border(b: Border | undefined) {
        if (this.$border) this.canvas.remove(this.$border);
        this.$border = b;
        if (b) this.canvas.add(b);
    }

    // ms since start
    /**
     * The time since the match started (in ms)
     * @date 1/9/2024 - 3:08:20 AM
     *
     * @public
     * @readonly
     * @type {number}
     */
    public get time() {
        return this.currentTime - this.startTime;
    }

    /**
     * The state of all the game objects
     * @date 1/9/2024 - 3:08:19 AM
     *
     * @readonly
     * @type {{
     *         [key: string]: unknown;
     *     }}
     */
    get state(): {
        [key: string]: unknown;
    } {
        const output: {
            [key: string]: unknown;
        } = {};
        for (const action of this.gameObjects) {
            output[action.object.name] = action.object.state;
        }
        return output;
    }

    /**
     * The state of all the game objects
     * @date 1/9/2024 - 3:08:19 AM
     *
     * @public
     */
    public stop() {
        this.emit('stop', undefined);
        this._stop();
    }

    emit = this.emitter.emit.bind(this.emitter);
    on = this.emitter.on.bind(this.emitter);
    off = this.emitter.off.bind(this.emitter);
    once = this.emitter.once.bind(this.emitter);

    /**
     * The time left in the match
     * @date 1/9/2024 - 3:08:19 AM
     *
     * @public
     * @readonly
     * @type {[number, number]}
     */
    public get timeLeft(): [number, number] {
        // [minutes, seconds]
        const left = 150 - this.time;
        return [Math.floor(left / 60), left % 60];
    }

    /**
     * Add a game object to the app
     * @date 1/9/2024 - 3:08:19 AM
     *
     * @template [T=unknown]
     * @param {number} x
     * @param {number} y
     * @param {AppObject<T>} object
     * @param {HTMLElement} button
     * @param {?(state: T) => string} [convert]
     * @returns {string) => void}
     */
    addAppObject<T = unknown>(
        point: Point2D,
        object: AppObject<T, a>,
        button: HTMLElement,
        convert?: (state: T) => string,
        alliance: 'red' | 'blue' | null = null,
        viewCondition?: (tick: Tick) => boolean
    ) {
        const [x, y] = point;
        this.gameObjects.push({
            x,
            y,
            object,
            element: button,
            alliance,
            viewCondition
        });
        if (!button.innerHTML) button.innerText = object.name;
        const defaultHTML = button.innerHTML;
        button.style.position = 'absolute';
        button.style.zIndex = '100';
        button.style.transform = 'translate(-50%, -50%)';

        object.listen((state, event) => {
            switch (event) {
                case 'new':
                    this.currentTick?.set(state);
                    break;
                case 'undo':
                    this.currentTick?.clear();
                    break;
            }

            const content = convert ? convert(state.state) : state;

            button.innerHTML = `${defaultHTML}${content ? `: ${content}` : ''}`;
        });

        button.addEventListener('click', () => {
            object.change(this.currentLocation);
            this.emit('action', {
                action: object.name,
                alliance,
                point: this.currentLocation || [-1, -1]
            });
        });

        // if the button is held down, change the state
        let interval: NodeJS.Timeout | undefined = undefined;
        const start = () => {
            if (interval) end();
            interval = setTimeout(() => {
                object.undo();
            }, 1000);
        };
        const end = () => {
            if (interval) clearTimeout(interval);
        };

        button.addEventListener('contextmenu', e => {
            e.preventDefault();
        });

        button.addEventListener('mousedown', start);
        button.addEventListener('touchstart', start);
        button.addEventListener('mouseup', end);
        button.addEventListener('touchend', end);
        button.addEventListener('touchcancel', end);
        button.addEventListener('mouseleave', end);
        button.addEventListener('touchleave', end);

        this.appObjects.push(object);
    }
    /**
     * Resets every state in the app
     * @date 1/9/2024 - 3:08:19 AM
     *
     * @public
     * @returns {Function} Stops the app
     */
    public async build(): Promise<undefined | (() => void)> {
        const { target } = this;

        if (!target) {
            console.error('No target');
            return;
        }

        // if (App.current) {
        //     App.current.stop();
        // }

        // target.innerHTML = '';

        this.cover.style.display = 'block';
        this.canvas.clearDrawables();
        this.canvas.add(this.background, this.path, this.buttonCircle);

        let quitView = false;

        const view = () => {
            if (quitView) return;
            this.setView();
            requestAnimationFrame(view);
        };

        requestAnimationFrame(view);

        this.currentLocation = undefined;
        this.currentTime = 0;
        this.currentTick = undefined;
        this.built = true;
        this.ticks = new Array(160 * App.ticksPerSecond)
            .fill(null)
            .map(
                (_, i) =>
                    new Tick<a>(i * App.tickDuration, i, this as App<any, any>)
            );
        this.canvasEl.parentElement?.removeChild(this.canvasEl); // if app was previously build
        target.appendChild(this.canvasEl);
        target.append(this.cover);

        const currentAlliance = await App.matchData.getAlliance();

        for (const o of this.gameObjects) {
            const { element, alliance } = o;
            let appended = false;
            const append = () => {
                if (appended) return;
                target.appendChild(element);
                appended = true;
            };
            if (alliance === null) append();
            if (alliance === currentAlliance) append();
            if (currentAlliance === null) append();
        }

        this.setListeners();
        const stopAnimation = this.canvas.animate();

        const stop = () => {
            this.built = false;
            stopAnimation();
            quitView = true;
            this.emit('stop', undefined);
        };

        this.on('stop', stopAnimation);

        return stop;
    }

    /**
     * Set the listeners for the app
     * @date 1/9/2024 - 3:08:19 AM
     *
     * @public
     */
    public setListeners() {
        const push = (x: number, y: number) => {
            if (!this.isDrawing) return;
            this.path.add([x, y]);
            this.currentLocation = [x, y];
            setTimeout(() => {
                this.path.points.shift();
            }, 1000); // clear after 1 second
        };

        const down = (x: number, y: number) => {
            if (this.clicking) return;
            this.isDrawing = true;
            push(x, y);
        };
        const move = (x: number, y: number) => {
            if (this.clicking) return;
            push(x, y);
        };
        const up = (x: number, y: number) => {
            if (this.clicking) return;
            this.isDrawing = false;
            push(x, y);
        };

        this.canvasEl.addEventListener('mousedown', e => {
            // e.preventDefault();
            const [[x, y]] = this.canvas.getXY(e);
            down(x, y);
        });

        this.canvasEl.addEventListener('mousemove', e => {
            // e.preventDefault();

            const [[x, y]] = this.canvas.getXY(e);
            move(x, y);
        });

        this.canvasEl.addEventListener('mouseup', e => {
            // e.preventDefault();

            const [[x, y]] = this.canvas.getXY(e);
            up(x, y);
        });

        this.canvasEl.addEventListener('touchstart', e => {
            // e.preventDefault();

            const [[x, y]] = this.canvas.getXY(e);
            down(x, y);
        });

        this.canvasEl.addEventListener('touchmove', e => {
            e.preventDefault();

            const [[x, y]] = this.canvas.getXY(e);
            move(x, y);
        });

        this.canvasEl.addEventListener('touchend', _e => {
            // e.preventDefault();

            this.isDrawing = false;
            // const [[x, y]] = this.canvas.getXY(e);
            // up(x, y);
        });

        this.canvasEl.addEventListener('touchcancel', e => {
            e.preventDefault();

            this.isDrawing = false;
            // const [[x, y]] = this.canvas.getXY(e);
            // up(x, y);
        });
    }

    /**
     * Use this to get the location of points for your polygons. This is not to be used in the actual app, but rather to help you develop.
     * @date 1/9/2024 - 3:33:17 AM
     *
     * @public
     * @returns {*}
     */
    public clickPoints() {
        const em = new EventEmitter<{ point: Point2D }>();

        this.canvasEl.addEventListener('click', e => {
            const [p] = this.canvas.getXY(e);
            em.emit('point', p);
        });

        return em;
    }

    /**
     * Description placeholder
     * @date 1/25/2024 - 4:59:07 PM
     *
     * @returns {TraceArray}
     */
    pull(): TraceArray {
        return this.ticks
            .map((t, i) => {
                let p = t.point;
                if (p) {
                    p = [
                        App.flipX ? 1 - p[0] : p[0],
                        App.flipY ? 1 - p[1] : p[1]
                    ];
                } else {
                    p = [-1, -1];
                }
                const [x, y] = p;
                return [i, round(x), round(y), t.get()?.action.abbr ?? 0];
            })
            .filter((p, i, a) => {
                if (p[3] !== 0) return true;
                if (i !== 0) {
                    if (a[i - 1][1] === p[1] && a[i - 1][2] === p[2]) {
                        return false;
                    }
                }
                return p[1] !== -1 && p[2] !== -1;
            }) as TraceArray;
    }

    changeSection(section: Section) {
        const tick = this.ticks.find(t => t.section === section);
        if (!tick) return console.error('No tick found');
        this.currentTick = tick;
    }

    /**
     * Description placeholder
     * @date 1/25/2024 - 4:59:07 PM
     *
     * @param {HTMLCanvasElement} canvas
     * @returns {Result<Container>}
     */
    getRecap(canvas: Canvas): Promise<Result<Container>> {
        canvas.clearDrawables();
        // canvas.adaptable = true;
        canvas.ratio = 2;
        canvas.width = canvas.ctx.canvas.parentElement?.clientWidth || 0;
        canvas.height = (canvas.ctx.canvas.parentElement?.clientWidth || 0) / 2;

        return attemptAsync(async () => {
            const img = new Img(`/public/pictures/${this.year}field.png`);
            img.options.height = 1;
            img.options.width = 1;
            img.options.x = 0;
            img.options.y = 0;

            img.mirror = {
                x: App.flipX,
                y: App.flipY
            };

            const container = new Container();

            const currentAlliance = await App.matchData.getAlliance();

            // this corrects for field orientation flipping, but this is an issue because it's not the same that the user sees on the previous screen
            const d: TraceArray = this.pull().map(p => {
                const [i, x, y, a] = p;
                return [i, App.flipX ? 1 - x : x, App.flipY ? 1 - y : y, a];
            });

            container.children = d.map((p, i, a) => {
                const [_i, x, y, action] = p;

                const color = Color.fromBootstrap(
                    currentAlliance === 'red'
                        ? 'danger'
                        : currentAlliance === 'blue'
                          ? 'primary'
                          : 'dark'
                ).toString('rgb');

                if (action) {
                    const size = 0.03;
                    const cir = new Circle([x, y], size);
                    cir.properties.fill = {
                        color: color
                    };
                    const a = this.icons[action]?.clone();
                    if (a instanceof SVG) {
                        a.center = [x, y];
                        if (!a.properties.text) a.properties.text = {};
                        a.properties.text!.height = size;
                        a.properties.text!.width = size;
                        a.properties.text!.color =
                            Color.fromBootstrap('light').toString('rgba');
                    }
                    if (a instanceof Icon) {
                        a.x = x;
                        a.y = y;
                        a.size = size;
                        a.color = Color.fromBootstrap('light').toString('rgba');
                    }
                    if (a instanceof Img) {
                        a.x = x - size / 2;
                        a.y = y - size;
                        a.height = size * 2;
                        a.width = size;
                    }

                    // pair the icon with the circle
                    const cont = new Container(cir, a || null);
                    return cont;
                }
                if (a[i - 1]) {
                    // do a path so that it's not just a bunch of circles
                    const p = new Path([
                        [a[i - 1][1], a[i - 1][2]],
                        [x, y]
                    ]);
                    p.properties.line = {
                        color: color,
                        width: 1
                    };
                    return p;
                }
                return null;
            });

            // default filter
            // const from = 0;
            // const to = d.length - 1;
            // container.filter((_, i) => i >= from && i <= to);

            canvas.add(img, container);

            return container;
        });
    }

    get latestAction(): Tick<a> | undefined {
        return this.ticks.find(t => !!t.get());
    }

    async submit(include: {
        checks: string[];
        comments: {
            [key: string]: string;
        };
    }) {
        // remove from cache when submitted. It's not needed anymore
        App.clearCache();

        for (const key of Object.keys(include.comments)) {
            if (App.matchData.compLevel === 'pr') {
                const c = include.comments[key];
                if (c) {
                    include.comments[key] = 'PRACTICE: ' + c;
                }
            }
        }

        const d: Match = {
            trace: this.pull(),
            comments: include.comments,
            checks: include.checks,
            date: Date.now(),
            scout: App.scoutName,
            eventKey: App.$eventData?.eventKey || 'no-event',
            matchNumber: App.matchData.matchNumber,
            teamNumber: App.matchData.teamNumber,
            group: App.group as 0 | 1 | 2 | 3 | 4 | 5,
            compLevel: App.matchData.compLevel,
            preScouting: App.preScouting
            // don't need orientation, because it's corrected in this.pull()
        };

        downloadText(
            JSON.stringify(d),
            `${d.eventKey}-${d.matchNumber}-${d.compLevel}-${d.teamNumber}.json`
        );

        const [id] = App.saveToLocalStorage(d);

        // set data to server
        const results = await App.upload(d);
        if (results.isOk()) {
            const [value] = results.value;
            if (value === 'success') {
                App.deleteFromLocalStorage(id);
                return value;
            }
            App.updateLocalStorage(id, value);
        }
    }

    // TODO: Destroy without reloading
    destroy() {
        this.canvas.animating = false;
        this.canvas.clearDrawables();
    }

    public static abort() {
        App.clearCache();
        location.reload();
    }
}

// for use in devtools
Object.assign(window, {
    App
});

sse.on('connect', async () => {
    App.uploadFromLocalStorage();
});

sse.on('change-state', (obj: { id: string; data: TabletState }) => {
    const { id, data: state } = obj;
    if (id !== ServerRequest.metadata.get('tablet-id')) return;
    // update only the private properties as to not trigger updateState on each set
    const { matchData } = App;

    if (matchData.compLevel !== state.compLevel)
        matchData.compLevel = state.compLevel as CompLevel;
    if (matchData.teamNumber !== state.teamNumber) {
        matchData.selectMatch(
            state.matchNumber,
            state.compLevel as CompLevel,
            state.teamNumber
        );
    }
    if (matchData.group !== state.groupNumber)
        matchData.selectGroup(
            state.groupNumber,
            App.matchData.matchNumber,
            false
        );
    if (App.scoutName !== state.scoutName) {
        App.scoutName = state.scoutName;
    }
    if (matchData.matchNumber !== state.matchNumber)
        matchData.selectMatch(state.matchNumber, state.compLevel as CompLevel);
    if (App.preScouting !== state.preScouting)
        App.preScouting = state.preScouting;
});

sse.on('abort', ({ id }: { id: string }) => {
    if (id === ServerRequest.metadata.get('tablet-id')) App.abort();
});

// Force submit is done in Post.svelte

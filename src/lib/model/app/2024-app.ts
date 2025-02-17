import { Color } from 'colors/color';
import { Iterator, Toggle } from './app-object';
import { Drawable } from 'canvas/drawable';
import {
    amps,
    autoZone,
    border,
    notePositions,
    srcs,
    stages,
    zones
} from 'tatorscout/2024-areas';
import {
    type Action2024,
    type TraceParse2024,
    type Zones2024
} from 'tatorscout/trace';
import { App } from './app';
import { type Point2D } from 'math/point';
import { Icon } from 'canvas/material-icons';
import { SVG } from 'canvas/svg';
import { Img } from 'canvas/image';
import { Tick } from './tick';
import type { CompLevel, TBAMatch } from 'tatorscout/tba';

/**
 * Builds the app for the 2024 game
 * @date 1/25/2024 - 4:59:26 PM
 */
export const generate2024App = (matchData: {
    matches: TBAMatch[];
    match: number;
    team: number;
    compLevel: CompLevel;
}) => {
    const icons: {
        [key in Action2024]: Icon | SVG | Img;
    } = {
        // spk: new Icon('speaker'),
        // amp: new Icon('campaign'),
        // src: new Icon('back_hand'),
        // clb: new Icon('dry_cleaning'),
        // trp: new Icon('place_item'),
        spk: new Img('/public/pictures/icons/spk.png'),
        amp: new Img('/public/pictures/icons/amp.png'),
        src: new Img('/public/pictures/icons/src.png'),
        clb: new Img('/public/pictures/icons/clb.png'),
        trp: new Img('/public/pictures/icons/trp.png'),
        nte: new Img('/public/pictures/icons/note.png'),
        lob: new Img('/public/pictures/icons/lob.png')
    };

    const images: {
        [key in Action2024]: HTMLImageElement;
    } = {
        spk: new Image(60, 60),
        amp: new Image(60, 60),
        src: new Image(60, 60),
        clb: new Image(60, 60),
        trp: new Image(60, 60),
        nte: new Image(60, 60),
        lob: new Image(60, 60)
    };

    for (const key in images) {
        images[key as keyof typeof images].src =
            `/public/pictures/icons/${key}.png`;
        images[key as keyof typeof images].classList.add('no-select');
        images[key as keyof typeof images].ondragstart = e =>
            e.preventDefault();
        images[key as keyof typeof images].onselectstart = e =>
            e.preventDefault();
        images[key as keyof typeof images].oncontextmenu = e =>
            e.preventDefault();
        images[key as keyof typeof images].onmousedown = e =>
            e.preventDefault();
        images[key as keyof typeof images].ondrag = e => e.preventDefault();
    }

    const app = new App<Action2024, Zones2024, TraceParse2024>(2024, icons, matchData);

    const isIn = (d: Drawable) =>
        app.currentLocation ? d.isIn(app.currentLocation) : false;

    // const colors = {
    //     red: new Color(255, 0, 0),
    //     redFade: new Color(255, 0, 0, 0.25),
    //     blue: new Color(0, 0, 255),
    //     blueFade: new Color(0, 0, 255, 0.25),
    //     black: new Color(0, 0, 0),
    //     blackFade: new Color(0, 0, 0, 0.25),
    // };

    const colors = {
        red: Color.fromBootstrap('red'),
        blue: Color.fromBootstrap('blue'),
        redFade: Color.fromBootstrap('red').setAlpha(0.1),
        blueFade: Color.fromBootstrap('blue').setAlpha(0.1),
        black: Color.fromBootstrap('dark'),
        blackFade: Color.fromBootstrap('dark').setAlpha(0.5)
    };

    app.addArea('blue-stage', stages.blue, colors.blueFade, isIn);
    app.addArea('blue-amp', amps.blue, colors.blueFade, isIn);
    app.addArea('blue-src', srcs.blue, colors.blueFade, isIn);
    app.addArea('blue-zone', zones.blue, colors.blueFade, isIn);
    app.addArea('blue-auto', autoZone.blue, colors.blueFade, isIn);

    app.addArea('red-auto', autoZone.red, colors.redFade, isIn);
    app.addArea('red-zone', zones.red, colors.redFade, isIn);
    app.addArea('red-src', srcs.red, colors.redFade, isIn);
    app.addArea('red-amp', amps.red, colors.redFade, isIn);
    app.addArea('red-stage', stages.red, colors.redFade, isIn);

    app.setBorder(border as Point2D[], colors.blackFade);

    // app.border = new Border(border as [number, number][]);

    // app.border.properties.doDraw = isIn;
    // app.border.properties.fill = {
    //     color: Color.fromName('black').setAlpha(0.5).toString('rgba'),
    // }
    const blueButtonClasses = ['btn', 'btn-primary', 'btn-lg'];
    const redButtonClasses = ['btn', 'btn-danger', 'btn-lg'];

    // gameObject buttons
    const blueAmp = App.button(blueButtonClasses, images.amp.cloneNode());
    const redAmp = App.button(redButtonClasses, images.amp.cloneNode());
    const blueSpeaker = App.button(blueButtonClasses, images.spk.cloneNode());
    const redSpeaker = App.button(redButtonClasses, images.spk.cloneNode());
    const blueSource = App.button(blueButtonClasses, images.src.cloneNode());
    const redSource = App.button(redButtonClasses, images.src.cloneNode());
    const redLobA = App.button(redButtonClasses, images.lob.cloneNode());
    const blueLobA = App.button(blueButtonClasses, images.lob.cloneNode());
    const redLobB = App.button(redButtonClasses, images.lob.cloneNode());
    const blueLobB = App.button(blueButtonClasses, images.lob.cloneNode());

    // const btns = notePositions.map((pos, i) => {
    //     const btn = App.button(
    //         ['btn', 'btn-outline-dark', 'btn-sm'],
    //         images.nte.cloneNode()
    //     );

    //     const t = new Toggle(
    //         'Auto Note ' + (i + 1),
    //         'Picked up this note in auto',
    //         'nte',
    //         false
    //     );

    //     app.addAppObject(
    //         pos,
    //         t,
    //         btn,
    //         _ => '',
    //         i < 5 ? undefined : i < 8 ? 'red' : 'blue',
    //         t => t.index < 65
    //     );

    //     let p: Point2D | null = null;

    //     t.on('change', o => {
    //         if (o.state) {
    //             btn.classList.remove('btn-outline-dark');
    //             btn.classList.add('btn-dark');

    //             try {
    //                 p = app.currentLocation || null;

    //                 // o.lastState!.tick!.point = [pos[0], pos[1]];
    //             } catch (error) {
    //                 console.error(error);
    //             }
    //         } else {
    //             btn.classList.remove('btn-dark');
    //             btn.classList.add('btn-outline-dark');
    //             // remove all states matching this AppObject
    //             for (const s of o.stateHistory) {
    //                 s.tick?.clear();
    //             }

    //             try {
    //                 // o.lastState!.tick!.point = p;
    //             } catch (error) {
    //                 console.error(error);
    //             }
    //         }
    //     });
    // });

    const I = Iterator<Action2024>;

    app.addAppObject(
        [0.16976556184316896, 0.021018593371059015],
        new I('Blue Amp', 'Placing any note into the blue amp', 'amp', 0),
        blueAmp,
        i => i.toString(),
        'blue'
    );

    app.addAppObject(
        [0.8274050121261115, 0.018593371059013743],
        new I('Red Amp', 'Placing any note into the red amp', 'amp', 0),
        redAmp,
        i => i.toString(),
        'red'
    );

    app.addAppObject(
        [0.06345998383185125, 0.33063864187550523],
        new I('Blue Speaker', 'Shot a note into the blue speaker', 'spk', 0),
        blueSpeaker,
        i => i.toString(),
        'blue'
    );

    app.addAppObject(
        [0.9365400161681487, 0.32740501212611156],
        new I('Red Speaker', 'Shot a note into the red speaker', 'spk', 0),
        redSpeaker,
        i => i.toString(),
        'red'
    );

    app.addAppObject(
        [0.49946581196581197, 1 - 0.9594017094017094],
        new I('Red Lob', 'Lob a note to the red side', 'lob', 0),
        redLobA,
        i => i.toString(),
        'red'
    );

    app.addAppObject(
        [0.49946581196581197, 0.9594017094017094],
        new I('Red Lob', 'Lob a note to the red side', 'lob', 0),
        redLobB,
        i => i.toString(),
        'red'
    );

    app.addAppObject(
        [0.49946581196581197, 1 - 0.9594017094017094],
        new I('Blue Lob', 'Lob a note to the blue side', 'lob', 0),
        blueLobA,
        i => i.toString(),
        'blue'
    );

    app.addAppObject(
        [0.49946581196581197, 0.9594017094017094],
        new I('Blue Lob', 'Lob a note to the blue side', 'lob', 0),
        blueLobB,
        i => i.toString(),
        'blue'
    );

    app.addAppObject(
        [0.8823767178658044, 0.9062247372675829],
        new I(
            'Blue Source',
            'Robot retrieves a note from the blue source',
            'src',
            0
        ),
        blueSource,
        i => i.toString(),
        'blue'
    );

    app.addAppObject(
        [0.11156022635408246, 0.9086499595796281],
        new I(
            'Red Source',
            'Robot retrieves a note from the red source',
            'src',
            0
        ),
        redSource,
        i => i.toString(),
        'red'
    );

    const drawButton =
        (z: Zones2024) =>
        (app: App): boolean => {
            const { currentLocation } = app;
            if (!currentLocation) return false;
            const zone = app.areas[z];
            if (!zone) {
                console.warn('Zone not found');
                return false;
            }
            return zone.area.isIn(currentLocation);
        };

    app.buttonCircle
        .addButton(
            'Blue Trap',
            'When the robot has successfully placed an item in the trap',
            'trp',
            0,
            drawButton('blue-stage'),
            colors.blue,
            'blue',
            icons.trp
        )
        .addButton(
            'Blue Climb',
            'Click when the robot has successfully pulled themselves up for the last time in the match',
            'clb',
            0,
            drawButton('blue-stage'),
            colors.blue,
            'blue',
            icons.clb
        )
        .addButton(
            'Red Trap',
            'When the robot has successfully placed an item in the trap',
            'trp',
            0,
            drawButton('red-stage'),
            colors.red,
            'red',
            icons.trp
        )
        .addButton(
            'Red Climb',
            'Click when the robot has successfully pulled themselves up for the last time in the match',
            'clb',
            0,
            drawButton('red-stage'),
            colors.red,
            'red',
            icons.clb
        );

    const em = app.clickPoints();
    em.on('point', console.log);

    Object.assign(window, { app });

    app.on('action', a => {
        let data: HTMLElement;
        switch (a.action) {
            // case 'Red Amp':
            // case 'Blue Amp':
            //     data = images.amp;
            //     break;
            // case 'Red Speaker':
            // case 'Blue Speaker':
            //     data = images.spk;
            //     break;
            // case 'Red Source':
            // case 'Blue Source':
            //     data = images.src;
            //     break;
            case 'Red Trap':
            case 'Blue Trap':
                data = images.trp;
                break;
            case 'Red Climb':
            case 'Blue Climb':
                data = images.clb;
                break;
            default:
                return;
        }

        App.actionAnimation(data, a.alliance);
    });

    return app;
};

export const update2024 = (tick: Tick) => {
    const { app, section } = tick;
    const { currentLocation } = app;

    if (!currentLocation) return;

    if (section === 'auto') {
        const { area: redAuto } = app.areas['red-auto'];
        const { area: blueAuto } = app.areas['blue-auto'];

        // if the robot is not in the auto zone during auto, then they crossed the auto line
        if (!redAuto.isIn(currentLocation) && !blueAuto.isIn(currentLocation)) {
            app.parsed.mobility = true;
        }
    }
};

import { Color } from 'colors/color';
import { Iterator, Toggle } from './app-object';
import { Drawable } from 'canvas/drawable';
import {
    barges,
    processors,
    reefs,
    zones,
    stations,
    autoZone,
    border
} from 'tatorscout/2025-areas';
import {
    type Action2025,
    type TraceParse2025,
    type Zones2025
} from 'tatorscout/trace';
import { App } from './app';
import { type Point2D } from 'math/point';
import { Icon } from 'canvas/material-icons';
import { SVG } from 'canvas/svg';
import { Img } from 'canvas/image';
import { Tick } from './tick';

/**
 * Builds the app for the 2024 game
 * @date 1/25/2024 - 4:59:26 PM
 */
export const generate2025App = (alliance: 'red' | 'blue' | null = null) => {
    const icons: {
        [key in Action2025]: Icon | SVG | Img;
    } = {
        // spk: new Icon('speaker'),
        // amp: new Icon('campaign'),
        // src: new Icon('back_hand'),
        // clb: new Icon('dry_cleaning'),
        // trp: new Icon('place_item'),
        // spk: new Img('/public/pictures/icons/spk.png'),
        // amp: new Img('/public/pictures/icons/amp.png'),
        // src: new Img('/public/pictures/icons/src.png'),
        // clb: new Img('/public/pictures/icons/clb.png'),
        // trp: new Img('/public/pictures/icons/trp.png'),
        // nte: new Img('/public/pictures/icons/note.png'),
        // lob: new Img('/public/pictures/icons/lob.png')

        // TODO: replace with correct images
        prc: new Img('/public/pictures/icons/spk.png'),
        brg: new Img('/public/pictures/icons/spk.png'),
        dpc: new Img('/public/pictures/icons/spk.png'),
        shc: new Img('/public/pictures/icons/spk.png'),
        cl1: new Img('/public/pictures/icons/clb.png'),
        cl2: new Img('/public/pictures/icons/clb.png'),
        cl3: new Img('/public/pictures/icons/clb.png'),
        cl4: new Img('/public/pictures/icons/clb.png')
        // might need coral station image
    };

    const images: {
        [key in Action2025]: HTMLImageElement;
    } = {
        prc: new Image(60, 60),
        brg: new Image(60, 60),
        dpc: new Image(60, 60),
        shc: new Image(60, 60),
        cl1: new Image(30, 30),
        cl2: new Image(30, 30),
        cl3: new Image(30, 30),
        cl4: new Image(30, 30)
        // might need coral station image
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

    const app = new App<Action2025, Zones2025, TraceParse2025>(2025, icons);

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

    // app.addArea('blue-stage', stages.blue, colors.blueFade, isIn);
    // app.addArea('blue-amp', amps.blue, colors.blueFade, isIn);
    // app.addArea('blue-src', srcs.blue, colors.blueFade, isIn);
    // app.addArea('blue-zone', zones.blue, colors.blueFade, isIn);
    // app.addArea('blue-auto', autoZone.blue, colors.blueFade, isIn);

    // app.addArea('red-auto', autoZone.red, colors.redFade, isIn);
    // app.addArea('red-zone', zones.red, colors.redFade, isIn);
    // app.addArea('red-src', srcs.red, colors.redFade, isIn);
    // app.addArea('red-amp', amps.red, colors.redFade, isIn);
    // app.addArea('red-stage', stages.red, colors.redFade, isIn);

    app.addArea('blue-barge', barges.blue, colors.blueFade, isIn);
    app.addArea('red-barge', barges.red, colors.redFade, isIn);
    app.addArea('blue-reef', reefs.blue, colors.blueFade, isIn);
    app.addArea('red-reef', reefs.red, colors.redFade, isIn);
    app.addArea('blue-prc', processors.blue, colors.blueFade, isIn);
    app.addArea('red-prc', processors.red, colors.redFade, isIn);
    app.addArea('blue-zone', zones.blue, colors.blueFade, isIn);
    app.addArea('red-zone', zones.red, colors.redFade, isIn);
    app.addArea('blue-auto', autoZone.blue, colors.blueFade, isIn);
    app.addArea('red-auto', autoZone.red, colors.redFade, isIn);
    // this might need changing?
    app.addArea('sta1', stations.sta1, colors.blueFade, isIn);
    app.addArea('sta2', stations.sta2, colors.blueFade, isIn);
    app.addArea('sta3', stations.sta3, colors.redFade, isIn);
    app.addArea('sta4', stations.sta4, colors.redFade, isIn);

    app.setBorder(border as Point2D[], colors.blackFade);

    // app.border = new Border(border as [number, number][]);

    // app.border.properties.doDraw = isIn;
    // app.border.properties.fill = {
    //     color: Color.fromName('black').setAlpha(0.5).toString('rgba'),
    // }
    const blueButtonClasses = ['btn', 'btn-primary', 'btn-lg'];
    const redButtonClasses = ['btn', 'btn-danger', 'btn-lg'];

    // gameObject buttons
    // const blueAmp = App.button(blueButtonClasses, images.amp.cloneNode());
    // const redAmp = App.button(redButtonClasses, images.amp.cloneNode());
    // const blueSpeaker = App.button(blueButtonClasses, images.spk.cloneNode());
    // const redSpeaker = App.button(redButtonClasses, images.spk.cloneNode());
    // const blueSource = App.button(blueButtonClasses, images.src.cloneNode());
    // const redSource = App.button(redButtonClasses, images.src.cloneNode());
    // const redLobA = App.button(redButtonClasses, images.lob.cloneNode());
    // const blueLobA = App.button(blueButtonClasses, images.lob.cloneNode());
    // const redLobB = App.button(redButtonClasses, images.lob.cloneNode());
    // const blueLobB = App.button(blueButtonClasses, images.lob.cloneNode());

    const blueCL1 = App.button(blueButtonClasses, images.cl1.cloneNode());
    const blueCL2 = App.button(blueButtonClasses, images.cl2.cloneNode());
    const blueCL3 = App.button(blueButtonClasses, images.cl3.cloneNode());
    const blueCL4 = App.button(blueButtonClasses, images.cl4.cloneNode());
    const redCL1 = App.button(redButtonClasses, images.cl1.cloneNode());
    const redCL2 = App.button(redButtonClasses, images.cl2.cloneNode());
    const redCL3 = App.button(redButtonClasses, images.cl3.cloneNode());
    const redCL4 = App.button(redButtonClasses, images.cl4.cloneNode());
    const blueBrg = App.button(blueButtonClasses, images.brg.cloneNode());
    const redBrg = App.button(redButtonClasses, images.brg.cloneNode());
    const bluePrc = App.button(blueButtonClasses, images.prc.cloneNode());
    const redPrc = App.button(redButtonClasses, images.prc.cloneNode());
    const blueSta1 = App.button(blueButtonClasses, images.prc.cloneNode());
    const blueSta2 = App.button(blueButtonClasses, images.prc.cloneNode());
    const redSta1 = App.button(redButtonClasses, images.prc.cloneNode());
    const redSta4 = App.button(redButtonClasses, images.prc.cloneNode());
    const blueShc = App.button(blueButtonClasses, images.shc.cloneNode());
    const redShc = App.button(redButtonClasses, images.shc.cloneNode());
    const blueDpc = App.button(blueButtonClasses, images.dpc.cloneNode());
    const redDpc = App.button(redButtonClasses, images.dpc.cloneNode());

    const I = Iterator<Action2025>;

    app.addAppObject(
        [0.36, 0.95],
        new I(
            'Blue Processor',
            'Placing any algae into the blue processor',
            'prc',
            0
        ),
        bluePrc,
        i => i.toString(),
        'blue'
    );

    app.addAppObject(
        [0.64, 0.05],
        new I(
            'Red Processor',
            'Placing any algae into the red processor',
            'prc',
            0
        ),
        redPrc,
        i => i.toString(),
        'red'
    );

    app.addAppObject(
        [0.53, 0.5],
        new I('Blue Barge', 'Placing any algae into the blue barge', 'brg', 0),
        blueBrg,
        i => i.toString(),
        'blue'
    );

    app.addAppObject(
        [0.47, 0.5],
        new I('Red Barge', 'Placing any algae into the red barge', 'brg', 0),
        redBrg,
        i => i.toString(),
        'red'
    );

    // coral levels
    app.addAppObject(
        [0.733, 0.6],
        new I(
            'Red Coral Level 1',
            'Placing any coral into the Red coral level 1',
            'cl1',
            0
        ),
        redCL1,
        i => i.toString(),
        'red'
    );
    app.addAppObject(
        [0.733, 0.5333],
        new I(
            'Red Coral Level 2',
            'Placing any coral into the Red coral level 2',
            'cl2',
            0
        ),
        redCL2,
        i => i.toString(),
        'red'
    );
    app.addAppObject(
        [0.733, 0.4667],
        new I(
            'Red Coral Level 3',
            'Placing any coral into the red coral level 3',
            'cl3',
            0
        ),
        redCL3,
        i => i.toString(),
        'red'
    );
    app.addAppObject(
        [0.733, 0.4],
        new I(
            'Red Coral Level 4',
            'Placing any coral into the Red coral level 4',
            'cl4',
            0
        ),
        redCL4,
        i => i.toString(),
        'red'
    );

    app.addAppObject(
        [0.267, 0.6],
        new I(
            'Blue Coral Level 1',
            'Placing any coral into the blue coral level 1',
            'cl1',
            0
        ),
        blueCL1,
        i => i.toString(),
        'blue'
    );
    app.addAppObject(
        [0.267, 0.5333],
        new I(
            'Blue Coral Level 2',
            'Placing any coral into the blue coral level 2',
            'cl2',
            0
        ),
        blueCL2,
        i => i.toString(),
        'blue'
    );
    app.addAppObject(
        [0.267, 0.4667],
        new I(
            'Blue Coral Level 3',
            'Placing any coral into the blue coral level 3',
            'cl3',
            0
        ),
        blueCL3,
        i => i.toString(),
        'blue'
    );
    app.addAppObject(
        [0.267, 0.4],
        new I(
            'Blue Coral Level 4',
            'Placing any coral into the blue coral level 4',
            'cl4',
            0
        ),
        blueCL4,
        i => i.toString(),
        'blue'
    );

    const drawButton =
        (z: Zones2025) =>
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
            'Blue Shallow Climb',
            'When the robot has successfully completed a shallow climb',
            'shc',
            0,
            drawButton('blue-barge'),
            colors.blue,
            'blue',
            icons.shc
        )
        .addButton(
            'Red Shallow Climb',
            'When the robot has successfully completed a shallow climb',
            'shc',
            0,
            drawButton('red-barge'),
            colors.red,
            'red',
            icons.shc
        )
        .addButton(
            'Blue Deep Climb',
            'When the robot has successfully completed a deep climb',
            'dpc',
            0,
            drawButton('blue-barge'),
            colors.blue,
            'blue',
            icons.dpc
        )
        .addButton(
            'Red Deep Climb',
            'When the robot has successfully completed a deep climb',
            'dpc',
            0,
            drawButton('red-barge'),
            colors.red,
            'red',
            icons.dpc
        );

    const em = app.clickPoints();

    let str = '';

    document.addEventListener('keydown', e => {
        if (e.ctrlKey) {
            switch (e.key) {
                case 't':
                    str = '';
                    console.log('Cleared');
                    break;
                // enter
                case 'Enter':
                    console.log(`[${str}]`);
                    break;
            }
        }
    });

    em.on('point', p => {
        console.log(p);
        str += `[${p[0].toFixed(3)}, ${p[1].toFixed(3)}],\n`;
    });

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
            case 'Red Deep Climb':
            case 'Blue Deep Climb':
                data = images.dpc;
                break;
            case 'Red Shallow Climb':
            case 'Blue Shallow Climb':
                data = images.shc;
                break;
            default:
                return;
        }

        App.actionAnimation(data, a.alliance);
    });

    return app;
};

export const update2025 = (tick: Tick) => {
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

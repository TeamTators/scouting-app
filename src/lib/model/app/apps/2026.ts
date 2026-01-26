import type { CompLevel } from 'tatorscout/tba';
import { App } from '../app';
import type { Point2D } from 'math/point';
import { AppObject } from '../app-object';
import YearInfo2026  from 'tatorscout/years/2025.js';

export default (config: {
    eventKey: string;
    match: number;
    team: number;
    compLevel: CompLevel;
    alliance: 'red' | 'blue' | null;
}) => {
    type Zone = {
        red: Point2D[];
        blue: Point2D[];
    };

    const app = new App({
        ...config,
        year: 2026,
        yearInfo: YearInfo2026
    });

    const alliances: Zone = {
        red: [
     
        ],
        blue: [
       
        ]
    };

    const coralStation: Zone = {
        red: [
   
        ],
        blue: [
       
        ]
    };

    const endZone: Zone = {
        red: [
        
        ],
        blue: [
            
        ]
    };

    const middle: Point2D[] = [
       
    ];

    const blueObjects = {
        hub1: new AppObject({
			abbr: 'hub1',
			name: 'Blue Hub 1x',
			description: 'Blue scored 1 fuel into hub'
		}),
		hub5: new AppObject({
			abbr: 'hub5',
			name: 'Blue Hub 5x',
			description: 'Blue scored 5 fuel into hub'
		}),
		hub10: new AppObject({
			abbr: 'hub10',
			name: 'Blue Hub 10x',
			description: 'Blue scored 10 fuel into hub'
		}),
		lob1: new AppObject({
			abbr: 'lob1',
			name: 'Blue Lob 1x',
			description: 'Blue lobbed 1 fuel'
		}),
		lob5: new AppObject({
			abbr: 'lob5',
			name: 'Blue Lob 5x',
			description: 'Blue lobbed 5 fuel'
		}),
        lob10: new AppObject({
			abbr: 'lob10',
			name: 'Blue Lob 10x',
			description: 'Blue lobbed 10 fuel'
		}),
        out: new AppObject({
			abbr: 'out',
			name: 'Blue Outpost',
			description: 'Blue dumped fuel into outpost'
		})
    };

    const redObjects = {
        hub1: new AppObject({
			abbr: 'hub1',
			name: 'Red Hub 1x',
			description: 'Red scored 1 fuel into hub'
		}),
		hub5: new AppObject({
			abbr: 'hub5',
			name: 'Red Hub 5x',
			description: 'Red scored 5 fuel into hub'
		}),
		hub10: new AppObject({
			abbr: 'hub10',
			name: 'Red Hub 10x',
			description: 'Red scored 10 fuel into hub'
		}),
		lob1: new AppObject({
			abbr: 'lob1',
			name: 'Red Lob 1x',
			description: 'Red lobbed 1 fuel'
		}),
		lob5: new AppObject({
			abbr: 'lob5',
			name: 'Red Lob 5x',
			description: 'Red lobbed 5 fuel'
		}),
        lob10: new AppObject({
			abbr: 'lob10',
			name: 'Red Lob 10x',
			description: 'Red lobbed 10 fuel'
		}),
        out: new AppObject({
			abbr: 'out',
			name: 'Red Outpost',
			description: 'Red dumped fuel into outpost'
		})
    };

    const createButton = (object: AppObject, color: 'red' | 'blue') => {
        const button = document.createElement('button');
        button.classList.add('btn', color === 'red' ? 'btn-danger' : 'btn-primary', 'p-0');
        button.innerHTML = `
            <img src="/icons/${object.config.abbr}.png" alt="${object.config.name}" style="
                height: 50px;
                width: 50px;
            " />
        `;
        return button;
    };

    const blueButtons = {
        hub1: createButton(blueObjects.hub1, 'blue'),
		hub5: createButton(blueObjects.hub5, 'blue'),
		hub10: createButton(blueObjects.hub10, 'blue'),
		lob1: createButton(blueObjects.lob1, 'blue'),
		lob5: createButton(blueObjects.lob5, 'blue'),
        lob10: createButton(blueObjects.lob10, 'blue'),
        out: createButton(blueObjects.out, 'blue')
    };

    const redButtons = {
        hub1: createButton(redObjects.hub1, 'red'),
		hub5: createButton(redObjects.hub5, 'red'),
		hub10: createButton(redObjects.hub10, 'red'),
		lob1: createButton(redObjects.lob1, 'red'),
		lob5: createButton(redObjects.lob5, 'red'),
        lob10: createButton(redObjects.lob10, 'red'),
        out: createButton(redObjects.out, 'red')
    };

    app.addAppObject({
		point: [0.025, 0.336],
		object: blueObjects.hub1,
		button: blueButtons.hub1,
		alliance: 'blue',
		staticX: false,
		staticY: true
	});
    app.addAppObject({
		point: [0.025, 0.396],
		object: blueObjects.hub5,
		button: blueButtons.hub5,
		alliance: 'blue',
		staticX: false,
		staticY: true
	});
    app.addAppObject({
		point: [0.025, 0.456],
		object: blueObjects.hub10,
		button: blueButtons.hub10,
		alliance: 'blue',
		staticX: false,
		staticY: true
	});
    app.addAppObject({
		point: [0.033, 0.869],
		object: blueObjects.out,
		button: blueButtons.out,
		alliance: 'blue',
		staticX: false,
		staticY: true
	});
    app.addAppObject({
		point: [0.025, 0.336],
		object: redObjects.hub1,
		button: redButtons.hub1,
		alliance: 'red',
		staticX: false,
		staticY: true
	});
    app.addAppObject({
		point: [0.025, 0.396],
		object: redObjects.hub5,
		button: redButtons.hub5,
		alliance: 'red',
		staticX: false,
		staticY: true
	});
    app.addAppObject({
		point: [0.025, 0.456],
		object: redObjects.hub10,
		button: redButtons.hub10,
		alliance: 'red',
		staticX: false,
		staticY: true
	});
    app.addAppObject({
		point: [0.967, 0.124],
		object: redObjects.out,
		button: redButtons.out,
		alliance: 'red',
		staticX: false,
		staticY: true
	});

    return app;
};

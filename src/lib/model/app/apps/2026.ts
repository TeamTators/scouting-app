import type { CompLevel } from 'tatorscout/tba';
import { App } from '../app';
import { Color } from 'colors/color';
import type { Point2D } from 'math/point';
import { AppObject } from '../app-object';
import { Img } from 'canvas/image';
import { isInside } from 'math/polygon';

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
        year: 2026
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
  
    };

    const redObjects = {
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
       
    };

    const redButtons = {
    };



    return app;
};

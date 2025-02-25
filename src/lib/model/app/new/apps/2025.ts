import type { CompLevel } from "tatorscout/tba";
import { App } from "../app";

export default (config: {
    eventKey: string;
    match: number;
    team: number;
    compLevel: CompLevel;
    flipX: boolean;
    flipY: boolean;
}) => {
    const app = new App({
        ...config,
        year: 2025,
    });



    return app;
};
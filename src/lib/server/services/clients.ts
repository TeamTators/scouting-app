import type { TabletState } from "$lib/model/admin";

class Tablet {
    constructor(
        public readonly id: string,
        public state: TabletState,
        url: string,
    ) {}
}



class Clients {
    readonly tablets: Tablet[] = [];



    setState(id: string, state: TabletState, url: string) {
        const tablet = this.tablets.find(t => t.id === id);
        if (tablet) {
            tablet.state = state;
            tablet.url = url;
        } else {
            this.tablets.push(new Tablet(id, state, url));
        }
    }

    getState() {}
}

export default new Clients();
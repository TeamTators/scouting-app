import type { Client } from "$lib/services/supabase/supastruct";
import { type Session as S } from "@supabase/supabase-js";
import { attemptAsync } from "ts-utils";
import { Account, getAccountFactory } from "$lib/model/account";
import supabase from "../services/supabase";
import { TempMap } from "$lib/utils/temp-map";

const getUser = async (usernameOrEmail: string) => {
    return attemptAsync(async () => {
        const factory = getAccountFactory(supabase);
        const profile = await factory.profile.getOR({
            username: usernameOrEmail,
            email: usernameOrEmail,
        }, {
            type: 'single',
        });
    });
};

export class Session {
    constructor(public readonly config: {
        session: S;
        client: Client;
        debug?: boolean;
    }) {}

    log(...args: unknown[]) {
        if (this.config.debug) {
            console.log('[Session]', ...args);
        }
    }

    getAccount() {
        return attemptAsync(async () => {
            const accountFactory = getAccountFactory(this.config.client);
            const self = await accountFactory.getSelf().unwrap();
            return self;
        });
    }

    signIn(config: {
        emailOrUsername: string;
        password: string;
    }) {
        return attemptAsync(async () => {});
    }

    signInOTP(config: {
        emailOrUsername: string;
    }) {
        return attemptAsync(async () => {});
    }
}

class SessionFactory {}

const factories = new TempMap<Client, SessionFactory>();
export const getSessionFactory = (client: Client) => {
    const existing = factories.get(client);
    if (existing) {
        return existing;
    }
    const factory = new SessionFactory();
    factories.set(client, factory);
    return factory;
};
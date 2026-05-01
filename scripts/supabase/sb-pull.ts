import env from '../../src/lib/server/utils/env';
import sbDb from './sb-db';


export default async (...args: string[]) => {
    await sbDb(
        'db',
        'pull',
        '--schema',
        env.SB_SCHEMAS.join(','),
        ...args
    );
}
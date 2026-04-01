import { Table } from "../db/table";

export const SupaCache = new Table('supa_cache', {
    table: 'string',
    key: 'string',
    value: 'array',
    expires: 'date',
});
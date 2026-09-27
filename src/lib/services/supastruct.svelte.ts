/**
 * @fileoverview Public re-export for the typed Supabase data access layer.
 *
 * This module intentionally exposes the app’s central `SupaStruct` implementation from one
 * import path so routes, components, and utilities can use the same typed table API.
 *
 * @example
 * import { SupaStruct } from '$lib/services/supastruct.svelte';
 * const Profile = SupaStruct.get({ schema: 'core', table: 'profile', client: supabase });
 */
export * from '$lib/services/supabase/supastruct.svelte';

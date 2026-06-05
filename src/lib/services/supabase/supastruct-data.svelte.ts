/* eslint-disable @typescript-eslint/no-explicit-any */
import { WritableBase } from '../writables';
import { SupaStaging } from './supastaging.svelte';
import {
	type Row,
	SupaStruct,
	SupaStatus,
	type RowTableName,
	type RowSchemaName
} from './supastruct.svelte';

/**
 * Reactive wrapper around a single table row.
 *
 * This class provides:
 * - direct access to the row snapshot via inherited writable state,
 * - CRUD helpers scoped to the owning struct,
 * - derived reactive state for individual fields,
 * - staging support for buffered edits.
 *
 * @template Name - Table name represented by this row.
 *
 * @example
 * const row = usersStruct.Generator({ id: 'u_1', email: 'a@b.com' });
 * const id = row.id;
 */
export class SupaStructData<
	RowSchema extends RowSchemaName,
	Name extends RowTableName<RowSchema>
> extends WritableBase<Row<RowSchema, Name>> {
	/**
	 * Creates a reactive row wrapper.
	 *
	 * @param struct - Owning struct used for validation, logging, and DB operations.
	 * @param data - Initial row snapshot.
	 */
	constructor(
		public readonly struct: SupaStruct<RowSchema, Name>,
		data: Row<RowSchema, Name>
	) {
		super(data);
	}

	/**
	 * Primary identifier of the current row snapshot.
	 *
	 * @returns Current `id` value from row data, if present.
	 */
	get id() {
		return (this.data as any).id as string | undefined;
	}

	/**
	 * Archived flag of the current row snapshot.
	 *
	 * @returns Current `archived` value from row data, if present.
	 */
	get archived() {
		return (this.data as any).archived as boolean | undefined;
	}

	get created() {
		return new Date(String((this.data as any).created_at));
	}

	private _log(...args: unknown[]) {
		this.struct['log'](`Data with id ${this.id}:`, ...args);
	}

	/**
	 * Shared Supabase client from the owning struct.
	 *
	 * @returns Typed Supabase client instance.
	 */
	get supabase() {
		return this.struct.supabase;
	}

	/**
	 * Updates this row using a functional patch callback.
	 *
	 * The callback receives the current local snapshot and must return
	 * an update payload. The payload is sent with `update(...).eq('id', ...)`.
	 *
	 * @param fn - Function that builds an update payload from current row state.
	 * @returns Writable status that resolves to the updated row payload on success.
	 *
	 * @example
	 * const status = row.update((current) => ({
	 *   ...current,
	 *   email: 'next@company.com'
	 * }));
	 *
	 * @throws Does not throw synchronously unless `fn` throws. Errors are captured
	 * into the returned `SupaStatus`.
	 */
	update(fn: (data: Row<RowSchema, Name>) => Row<RowSchema, Name>) {
		const status = new SupaStatus<Row<RowSchema, Name>>();
		try {
			const updateData = fn(this.data);
			this.supabase
				.schema(this.struct.schema)
				.from(this.struct.table)
				.update(updateData as any)
				.filter('id', 'eq', this.id)
				.select('*')
				.then((res) => {
					const transactionResult = this.struct.runTransaction(
						{
							data: res.data ? res.data[0] : (null as any),
							error: res.error
						},
						'single'
					);
					if (transactionResult.isErr()) {
						this._log('Error updating data:', transactionResult.error);
						status.set({
							pending: false,
							error: new Error(
								`Failed to update row in table ${this.struct.table}: ` +
									transactionResult.error.message
							)
						});
					} else {
						status.set({
							pending: false,
							result: transactionResult.value
						});
					}
				});
		} catch (error) {
			status.set({
				pending: false,
				error: error instanceof Error ? error : new Error(String(error))
			});
		}
		return status;
	}

	/**
	 * Deletes this row by id.
	 *
	 * @returns Writable status that resolves with `null` on success.
	 *
	 * @example
	 * const status = row.delete();
	 */
	delete() {
		const status = new SupaStatus<null>();
		this.supabase
			.schema(this.struct.schema)
			.from(this.struct.table)
			.delete()
			.filter('id', 'eq', this.id)
			.then((res) => {
				const transactionResult = this.struct.runTransaction(
					{
						data: null,
						error: res.error
					},
					'null'
				);
				if (transactionResult.isErr()) {
					this._log('Error deleting data:', transactionResult.error);
					status.set({
						pending: false,
						error: new Error(
							`Failed to delete row in table ${this.struct.table}: ` +
								transactionResult.error.message
						)
					});
				} else {
					status.set({
						pending: false,
						result: null
					});
				}
			});
		return status;
	}

	/**
	 * Creates a staging helper for buffered/controlled mutations.
	 *
	 * @returns `SupaStaging` instance bound to this row.
	 *
	 * @example
	 * const staging = row.staging();
	 */
	staging() {
		return new SupaStaging(this);
	}

	/**
	 * Creates a reactive state for a single row field.
	 *
	 * The derived writable tracks this row and only emits when the selected
	 * property changes.
	 *
	 * @param name - Row property name to observe.
	 * @returns Writable state for the selected property.
	 *
	 * @example
	 * const emailState = row.derivedProperty('email');
	 * const un = emailState.subscribe((email) => console.log(email));
	 */
	derivedProperty(name: keyof Row<RowSchema, Name>) {
		const state = new WritableBase<Row<RowSchema, Name>[keyof Row<RowSchema, Name>] | undefined>(
			this.data[name]
		);
		let currentValue = this.data[name];
		state.on(
			'all-unsubscribe',
			this.subscribe((data) => {
				if (data[name] !== currentValue) {
					currentValue = data[name];
					state.set(data[name]);
				}
			})
		);
		return state;
	}

	/**
	 * Sets the `archived` flag to `true` for this row.
	 * @returns Writable status that resolves to the updated row payload on success.
	 *
	 * @example
	 * const status = row.archive();
	 * status.subscribe((result) => {
	 *   if (result.error) {
	 *     console.error('Failed to archive:', result.error);
	 *   } else {
	 *     console.log('Row archived successfully:', result.result);
	 *   }
	 * });
	 */
	archive() {
		return this.update((current) => ({
			...current,
			archived: true as any
		}));
	}
}

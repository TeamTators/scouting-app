/* eslint-disable @typescript-eslint/no-explicit-any */
import { WritableBase } from '../writables';
import { SupaStaging } from './supastaging';
import { type Names, type PartialRow, type Row, SupaStruct, SupaStatus } from './supastruct';

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
export class SupaStructData<Name extends Names> extends WritableBase<PartialRow<Name>> {
	/**
	 * Creates a reactive row wrapper.
	 *
	 * @param struct - Owning struct used for validation, logging, and DB operations.
	 * @param data - Initial row snapshot.
	 */
	constructor(
		public readonly struct: SupaStruct<Name>,
		data: PartialRow<Name>
	) {
		super(data);
	}

	/**
	 * Primary identifier of the current row snapshot.
	 *
	 * @returns Current `id` value from row data, if present.
	 */
	get id() {
		return this.data.id;
	}

	/**
	 * Archived flag of the current row snapshot.
	 *
	 * @returns Current `archived` value from row data, if present.
	 */
	get archived() {
		return this.data.archived;
	}

	private _log(...args: unknown[]) {
		this.struct['log'](`Data with id ${this.data.id}:`, ...args);
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
	update(fn: (data: PartialRow<Name>) => PartialRow<Name>) {
		const status = new SupaStatus<PartialRow<Name>>();
		try {
			const updateData = fn(this.data);
			this.supabase
				.from(this.struct.name)
				.update(updateData as any)
				.filter('id', 'eq', this.data.id as any)
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
								`Failed to update row in table ${this.struct.name}: ` +
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
			.from(this.struct.name)
			.delete()
			.filter('id', 'eq', this.data.id as any)
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
							`Failed to delete row in table ${this.struct.name}: ` +
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
	derivedProperty(name: keyof Row<Name>) {
		const state = new WritableBase<Row<Name>[keyof Row<Name>] | undefined>(this.data[name]);
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
}

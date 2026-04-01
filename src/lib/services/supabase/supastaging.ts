/* eslint-disable @typescript-eslint/no-explicit-any */
import { attempt, attemptAsync } from 'ts-utils';
import { SupaStruct, type Names, type PartialRow, type Row } from './supastruct';
import { SupaStructData } from './supastruct-data';
import { WritableBase } from '../writables';
import deepEqual from 'fast-deep-equal';

/**
 * Field-level merge conflict payload.
 *
 * @template Name - Table name.
 * @template K - Field name that is in conflict.
 */
type Conflict<Name extends Names, K extends keyof Row<Name>> = {
	/** Conflicting field name. */
	name: K;
	/** Value from the baseline snapshot used for staging. */
	base: PartialRow<Name>[K];
	/** Value currently in the local staging buffer. */
	local: PartialRow<Name>[K];
	/** Value currently in remote struct data. */
	remote: PartialRow<Name>[K];
};

/**
 * Callback signature for manual conflict resolution.
 *
 * @template Name - Table name.
 * @template K - Conflicted field key.
 * @param conflict - Conflict payload containing base/local/remote values.
 * @returns Resolved value for the conflicted key.
 */
type ConflictHandlerFn<Name extends Names, K extends keyof Row<Name>> = (
	conflict: Conflict<Name, K>
) => Promise<PartialRow<Name>[K]> | PartialRow<Name>[K];

/**
 * Pull/save conflict strategy.
 *
 * Strategies:
 * - `ifClean`: no-op during conflict stage.
 * - `force`: replace staging with remote.
 * - `preferLocal`: keep local values on conflicts.
 * - `preferRemote`: use remote values for non-conflicting fields.
 * - `mergeClean`: apply only clean remote updates.
 * - `manual`: throw and require external resolution.
 * - `ConflictHandlerFn`: resolve each conflict programmatically.
 *
 * @template Name - Table name.
 * @template K - Candidate field keys.
 */
type SaveStrategy<Name extends Names, K extends keyof Row<Name>> = {
	strategy:
		| 'ifClean'
		| 'force'
		| 'preferLocal'
		| 'preferRemote'
		| 'mergeClean'
		| 'manual'
		| ConflictHandlerFn<Name, K>;
};

/** Merge summary between base/local/remote snapshots. */
type MergeStatus = 'clean' | 'localDiverge' | 'remoteDiverge' | 'diverged' | 'conflict';

/**
 * Full merge analysis payload.
 *
 * @template Name - Table name.
 * @template K - Key type for compared fields.
 */
interface MergeState<Name extends Names, K extends keyof Row<Name>> {
	/** Aggregate merge status across all fields. */
	status: MergeStatus;
	/** Conflicts discovered while comparing base/local/remote snapshots. */
	conflicts: Conflict<Name, K>[];
}

/**
 * Staging configuration for immutable/static fields.
 *
 * @template Name - Table name.
 */
type StructDataStageConfig<Name extends Names> = {
	/** Field list that cannot be mutated in the staging proxy. */
	static?: (keyof Row<Name>)[];
};

/**
 * Staging buffer and merge utility for one {@link SupaStructData} instance.
 *
 * This class lets you:
 * - edit row data locally without immediately writing to the server,
 * - compare local edits against both base and remote snapshots,
 * - pull remote changes with configurable conflict behavior,
 * - save staged changes back to the row.
 *
 * @template Name - Table name for the staged row.
 *
 * @example
 * const stage = row.staging();
 * stage.data.email = 'next@company.com';
 * await stage.save({ strategy: 'mergeClean' });
 */
export class SupaStaging<Name extends Names> extends WritableBase<PartialRow<Name>> {
	/** Parent struct used for type context and persistence. */
	private readonly struct: SupaStruct<Name>;

	/** Baseline snapshot used to compute divergence and conflicts. */
	public base: PartialRow<Name>;

	/**
	 * Reactive flag describing whether remote data equals baseline.
	 *
	 * `true` means no remote change relative to baseline.
	 */
	get remoteUpdated() {
		return this.structData.derived((data) => {
			return deepEqual(data, this.base);
		});
	}

	/**
	 * Reactive flag describing whether local staging equals baseline.
	 *
	 * `true` means no local staged change relative to baseline.
	 */
	get localUpdated() {
		return this.derived((data) => {
			return deepEqual(data, this.base);
		});
	}

	// get deleted() {

	// }

	/**
	 * Creates a staging buffer for a row.
	 *
	 * @param structData - Source row wrapper to stage.
	 * @param config - Optional staging configuration.
	 */
	constructor(
		public readonly structData: SupaStructData<Name>,
		public readonly config: StructDataStageConfig<Name> = {}
	) {
		super({ ...structData.data });
		this.struct = structData.struct;
		this.base = { ...structData.data };
		this.data = this.makeStaging(this.data);
	}

	/**
	 * Wraps an object in a staging proxy enforcing static-field constraints.
	 *
	 * @param data - Row-shaped data to proxy.
	 * @returns Proxy that informs subscribers on set and blocks deletion.
	 */
	private makeStaging(data: PartialRow<Name>) {
		return new Proxy(
			{ ...data },
			{
				set: (target, prop, value) => {
					if (this.config.static?.includes(prop as keyof Row<Name>)) {
						console.warn(
							`Attempted to modify static field ${String(prop)}. This field is configured as static and cannot be modified.`
						);
						return true;
					}
					target[prop as keyof Row<Name>] = value;
					this.inform();
					return true;
				},
				deleteProperty: (_, property) => {
					throw new Error(
						`Attempted to delete property ${String(property)}. Deletion is not allowed in staging.`
					);
				}
			}
		);
	}

	/**
	 * Pulls remote changes into the staging buffer using a conflict strategy.
	 *
	 * @param strategy - Conflict resolution strategy.
	 * @returns Promise that resolves when pull and conflict handling complete.
	 * @throws When `strategy` is `manual` and conflicts exist.
	 *
	 * @example
	 * await stage.pull({ strategy: 'preferLocal' });
	 *
	 * @example
	 * await stage.pull({
	 *   strategy: async (conflict) => conflict.local ?? conflict.remote
	 * });
	 */
	async pull(strategy: SaveStrategy<Name, keyof PartialRow<Name>>) {
		const remote = this.structData.data;
		const local = this.data;
		const base = this.base;

		const mergeState: MergeState<Name, keyof PartialRow<Name>> = {
			status: 'clean',
			conflicts: []
		};

		for (const key in base) {
			const baseValue = base[key as keyof PartialRow<Name>];
			const localValue = local[key as keyof PartialRow<Name>];
			const remoteValue = remote[key as keyof PartialRow<Name>];

			if (deepEqual(localValue, baseValue) && !deepEqual(remoteValue, baseValue)) {
				// Remote changed, local did not
				this.data[key as keyof PartialRow<Name>] = remoteValue;
				mergeState.status = mergeState.status === 'localDiverge' ? 'diverged' : 'remoteDiverge';
			} else if (!deepEqual(localValue, baseValue) && deepEqual(remoteValue, baseValue)) {
				// Local changed, remote did not
				mergeState.status = mergeState.status === 'remoteDiverge' ? 'diverged' : 'localDiverge';
			} else if (
				!deepEqual(localValue, baseValue) &&
				!deepEqual(remoteValue, baseValue) &&
				!deepEqual(localValue, remoteValue)
			) {
				// Both changed differently
				mergeState.status = 'conflict';
				mergeState.conflicts.push({
					name: key as keyof PartialRow<Name>,
					base: baseValue,
					local: localValue,
					remote: remoteValue
				});
			}
		}

		if (mergeState.status === 'conflict') {
			if (strategy.strategy === 'manual') {
				throw new Error(
					`Merge conflicts detected. Manual resolution required. Conflicts: ${JSON.stringify(mergeState.conflicts)}`
				);
			} else if (typeof strategy.strategy === 'function') {
				for (const conflict of mergeState.conflicts) {
					const resolvedValue = await strategy.strategy(conflict);
					this.data[conflict.name as keyof PartialRow<Name>] = resolvedValue;
				}
			} else {
				switch (strategy.strategy) {
					case 'ifClean':
						// Only apply remote changes if there are no local changes
						// this cannot happen in this block since we are in the conflict block, but we include it for completeness
						break;
					case 'force':
						// Always apply remote changes, ignoring local changes
						this.data = this.makeStaging(remote);
						break;
					case 'preferLocal':
						// Keep local changes, ignore remote changes
						break;
					case 'preferRemote':
						// Apply remote changes, but keep local changes that do not conflict
						for (const key in remote) {
							if (!mergeState.conflicts.some((c) => c.name === key)) {
								this.data[key as keyof PartialRow<Name>] = remote[key as keyof PartialRow<Name>];
							}
						}
						break;
					case 'mergeClean':
						// Apply remote changes only for fields that have not been modified locally
						for (const key in remote) {
							const baseValue = base[key as keyof PartialRow<Name>];
							const localValue = local[key as keyof PartialRow<Name>];
							const remoteValue = remote[key as keyof PartialRow<Name>];

							if (deepEqual(localValue, baseValue) && !deepEqual(remoteValue, baseValue)) {
								this.data[key as keyof PartialRow<Name>] = remoteValue;
							}
						}
						break;
				}
			}
		} else if (mergeState.status === 'remoteDiverge') {
			// No conflicts, but remote has changes
			this.data = this.makeStaging(remote);
		}

		// Update base to current remote after pull
		this.base = { ...remote };
	}

	/**
	 * Rolls staged fields back to the base snapshot.
	 *
	 * @param properties - Specific properties to rollback. If omitted, method is a no-op.
	 * @returns Result from `attempt` indicating rollback success/failure.
	 * @throws When a requested property is static or missing from base.
	 *
	 * @example
	 * stage.rollback('email', 'name');
	 */
	rollback(...properties: (keyof PartialRow<Name>)[]) {
		return attempt(() => {
			if (properties.length > 0) {
				let hasChanges = false;

				for (const p of properties) {
					if (this.config.static?.includes(p)) {
						throw new Error(`Cannot modify static property "${String(p)}" in StructDataStage`);
					}
					if (p in this.base) {
						const baseValue = this.base[p];
						if (this.data[p] !== baseValue) {
							(this.data as any)[p] = baseValue;
							hasChanges = true;
						}
					} else {
						throw new Error(`Property "${String(p)}" does not exist in base data`);
					}
				}

				if (hasChanges) {
					this.inform();
				}

				return;
			}
		});
	}

	/**
	 * Pulls according to strategy, persists staged changes, then refreshes base.
	 *
	 * @param strategy - Conflict strategy applied before save.
	 * @returns `ResultPromise<void>` describing save success/failure.
	 *
	 * @example
	 * const result = await stage.save({ strategy: 'mergeClean' });
	 */
	public async save(strategy: SaveStrategy<Name, keyof PartialRow<Name>>) {
		return attemptAsync(async () => {
			this.pull(strategy);
			await this.update((data) => {
				return { ...data, ...this.data };
			});
			this.base = { ...this.data };
		});
	}

	/**
	 * Reactive merge analysis between base, local stage, and remote data.
	 *
	 * @returns Derived writable containing current merge status and conflicts.
	 */
	get mergeState() {
		return this.structData.derived((data) => {
			const remote = data;
			const local = this.data;
			const base = this.base;

			const mergeState: MergeState<Name, keyof Row<Name>> = {
				status: 'clean',
				conflicts: []
			};

			for (const key in base) {
				const baseValue = base[key as keyof Row<Name>];
				const localValue = local[key as keyof Row<Name>];
				const remoteValue = remote[key as keyof Row<Name>];

				if (deepEqual(localValue, baseValue) && !deepEqual(remoteValue, baseValue)) {
					// Remote changed, local did not
					mergeState.status = mergeState.status === 'localDiverge' ? 'diverged' : 'remoteDiverge';
				} else if (!deepEqual(localValue, baseValue) && deepEqual(remoteValue, baseValue)) {
					// Local changed, remote did not
					mergeState.status = mergeState.status === 'remoteDiverge' ? 'diverged' : 'localDiverge';
				} else if (
					!deepEqual(localValue, baseValue) &&
					!deepEqual(remoteValue, baseValue) &&
					!deepEqual(localValue, remoteValue)
				) {
					// Both changed differently
					mergeState.status = 'conflict';
					mergeState.conflicts.push({
						name: key as keyof PartialRow<Name>,
						base: baseValue,
						local: localValue,
						remote: remoteValue
					});
				}
			}

			return mergeState;
		});
	}
}

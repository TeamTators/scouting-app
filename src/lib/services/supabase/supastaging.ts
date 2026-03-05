/* eslint-disable @typescript-eslint/no-explicit-any */
import { attempt, attemptAsync } from 'ts-utils';
import { SupaStruct, SupaStructData, type Names, type PartialRow, type Row } from './supastruct';
import { WritableBase } from '../writables';
import deepEqual from 'fast-deep-equal';

type Conflict<Name extends Names, K extends keyof Row<Name>> = {
	name: K;
	base: PartialRow<Name>[K];
	local: PartialRow<Name>[K];
	remote: PartialRow<Name>[K];
};

type ConflictHandlerFn<Name extends Names, K extends keyof Row<Name>> = (
	conflict: Conflict<Name, K>
) => Promise<PartialRow<Name>[K]> | PartialRow<Name>[K];

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

type MergeStatus = 'clean' | 'localDiverge' | 'remoteDiverge' | 'diverged' | 'conflict';

interface MergeState<Name extends Names, K extends keyof Row<Name>> {
	status: MergeStatus;
	conflicts: Conflict<Name, K>[];
}

type StructDataStageConfig<Name extends Names> = {
	static?: (keyof Row<Name>)[];
};

export class SupaStaging<Name extends Names> extends WritableBase<PartialRow<Name>> {
	private readonly struct: SupaStruct<Name>;

	public base: PartialRow<Name>;

	get remoteUpdated() {
		return this.structData.derived((data) => {
			return deepEqual(data, this.base);
		});
	}

	get localUpdated() {
		return this.derived((data) => {
			return deepEqual(data, this.base);
		});
	}

	// get deleted() {

	// }

	constructor(
		public readonly structData: SupaStructData<Name>,
		public readonly config: StructDataStageConfig<Name> = {}
	) {
		super({ ...structData.data });
		this.struct = structData.struct;
		this.base = { ...structData.data };
		this.data = this.makeStaging(this.data);
	}

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

	public async save(strategy: SaveStrategy<Name, keyof PartialRow<Name>>) {
		return attemptAsync(async () => {
			this.pull(strategy);
			await this.update((data) => {
				return { ...data, ...this.data };
			});
			this.base = { ...this.data };
		});
	}

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

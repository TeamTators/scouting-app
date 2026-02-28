import { browser } from '$app/environment';
import { WritableArray, WritableBase } from '$lib/services/writables';
import type { App } from './app';
import { Table } from '$lib/services/db/table';
import { attemptAsync } from 'ts-utils';
import { toSnakeCase } from 'drizzle-orm/casing';

const settingsTable = new Table('settings', {
	year: 'number',
	name: 'string',
	value: 'string'
});

type PullSettingType<Type extends 'string' | 'number' | 'boolean'> = Type extends 'string'
	? string
	: Type extends 'number'
		? number
		: boolean;

type SettingOptions<Type extends 'string' | 'number' | 'boolean'> = {
	value: PullSettingType<Type>;
	name: string;
}[];

type SettingsConfig<Type extends 'string' | 'number' | 'boolean'> = {
	name: string;
	type: Type;
	default: PullSettingType<Type>;
	description: string;
	value: WritableBase<PullSettingType<Type>>;
	options?: SettingOptions<Type>;
	id: string;
};

export class Settings extends WritableArray<SettingsConfig<'string' | 'number' | 'boolean'>> {
	constructor(public readonly app: App) {
		super([], {
			debug: true
		});
	}

	pullSaved() {
		return attemptAsync(async () => {
			if (browser) {
				const stored = await settingsTable
					.get(
						{
							year: this.app.config.year
						},
						{
							pagination: false
						}
					)
					.unwrap();

				this.update((arr) => {
					for (const config of arr) {
						const found = stored.data.find((s) => s.data.name === config.name);
						if (found) {
							switch (config.type) {
								case 'string':
									config.value.set(found.data.value);
									break;
								case 'number':
									config.value.set(parseFloat(found.data.value));
									break;
								case 'boolean':
									config.value.set(found.data.value === 'true');
									break;
							}
						}
					}

					return arr;
				});
			}
		});
	}

	save() {
		return attemptAsync(async () => {
			if (browser) {
				const stored = await settingsTable
					.get(
						{
							year: this.app.config.year
						},
						{
							pagination: false
						}
					)
					.unwrap();

				stored.each((s) => s.delete());

				this.each((s) => {
					settingsTable.new({
						year: this.app.config.year,
						name: s.name,
						value: s.value.data.toString()
					});
				});
			}
		});
	}

	add<Type extends 'string' | 'number' | 'boolean'>(
		config: Omit<SettingsConfig<Type>, 'value' | 'id'>,
		onchange: (value: PullSettingType<Type>) => void
	) {
		const data = {
			...config,
			value: new WritableBase<PullSettingType<Type>>(config.default),
			id: `${this.app.config.year}-${toSnakeCase(config.name)}`
		};
		console.log('Adding setting', data);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		this.push(data as any);

		data.value.subscribe(onchange);
		return this;
	}

	saveSetting<Type extends 'string' | 'number' | 'boolean'>(
		name: string,
		value: PullSettingType<Type>
	) {
		this.update((arr) => {
			const setting = arr.find((s) => s.name === name);
			if (setting) {
				setting.value.set(value);
				return arr;
			} else {
				throw new Error(`Setting with name ${name} not found`);
			}
		});
	}
}

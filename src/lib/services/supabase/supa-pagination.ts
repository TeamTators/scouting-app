import { WritableBase } from '../writables';
import { type Names, type Row, SupaStruct } from './supastruct';
import { SupaStructData } from './supastruct-data';

/**
 * Reactive pagination state for a struct-backed query.
 *
 * @template Name - Table name represented by each row.
 */
export class SupaPagination<Name extends Names> extends WritableBase<{
	rows: SupaStructData<Name>[];
	total: number;
	page: number;
	pageSize: number;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
}> {
	/**
	 * Creates a pagination controller.
	 *
	 * @param struct - Struct used to wrap row payloads into `SupaStructData` instances.
	 * @param getter - Page fetch function returning raw rows and pagination metadata.
	 *
	 * @example
	 * const pagination = new SupaPagination(usersStruct, async (page, pageSize) => {
	 *   return {
	 *     rows: [],
	 *     total: 0,
	 *     page,
	 *     pageSize,
	 *     hasNextPage: false,
	 *     hasPreviousPage: page > 1
	 *   };
	 * });
	 */
	constructor(
		public readonly struct: SupaStruct<Name>,
		private readonly getter: (
			page: number,
			pageSize: number
		) => Promise<{
			rows: Row<Name>[];
			total: number;
			page: number;
			pageSize: number;
			hasNextPage: boolean;
			hasPreviousPage: boolean;
		}>
	) {
		super({
			rows: [],
			total: 0,
			page: 1,
			pageSize: 10,
			hasNextPage: false,
			hasPreviousPage: false
		});
	}

	/**
	 * Fetches a page and updates local pagination state.
	 *
	 * @param page - 1-based page index.
	 * @param pageSize - Number of rows per page.
	 */
	private fetch(page: number, pageSize: number) {
		this.getter(page, pageSize)
			.then((result) => {
				this.set({
					rows: result.rows.map((item) => this.struct.Generator(item)),
					total: result.total,
					page: result.page,
					pageSize: result.pageSize,
					hasNextPage: result.hasNextPage,
					hasPreviousPage: result.hasPreviousPage
				});
			})
			.catch((error) => {
				console.error(
					`Failed to fetch page ${page} with page size ${pageSize} from table ${this.struct.name}:`,
					error
				);
			});
	}

	/**
	 * Loads the next page when available.
	 *
	 * @returns `void`.
	 */
	next() {
		if (!this.data.hasNextPage) return;
		this.fetch(this.data.page + 1, this.data.pageSize);
	}

	/**
	 * Loads the previous page when available.
	 *
	 * @returns `void`.
	 */
	prev() {
		if (!this.data.hasPreviousPage) return;
		this.fetch(this.data.page - 1, this.data.pageSize);
	}

	/**
	 * Changes page size and reloads from page 1.
	 *
	 * @param pageSize - Desired page size.
	 * @returns `void`.
	 */
	setPageSize(pageSize: number) {
		this.fetch(1, pageSize);
	}

	/**
	 * Reactive page-size state.
	 *
	 * @returns Derived writable of current page size.
	 */
	get pageSize() {
		return this.derived((data) => data.pageSize);
	}

	/**
	 * Reactive current-page state.
	 *
	 * @returns Derived writable of current 1-based page index.
	 */
	get page() {
		return this.derived((data) => data.page);
	}

	/**
	 * Reactive total-row-count state.
	 *
	 * @returns Derived writable of total rows across all pages.
	 */
	get total() {
		return this.derived((data) => data.total);
	}

	/**
	 * Reactive next-page availability flag.
	 *
	 * @returns Derived writable of `hasNextPage`.
	 */
	get hasNextPage() {
		return this.derived((data) => data.hasNextPage);
	}

	/**
	 * Reactive previous-page availability flag.
	 *
	 * @returns Derived writable of `hasPreviousPage`.
	 */
	get hasPreviousPage() {
		return this.derived((data) => data.hasPreviousPage);
	}

	/**
	 * Reactive rows for the current page.
	 *
	 * @returns Derived writable of `SupaStructData` rows.
	 */
	get rows() {
		return this.derived((data) => data.rows);
	}
}

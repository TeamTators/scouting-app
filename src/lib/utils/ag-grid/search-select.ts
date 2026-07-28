/**
 * @fileoverview AG Grid searchable select cell editor.
 *
 * @example
 * import { SearchSelectCellEditor } from '$lib/utils/ag-grid/search-select';
 * const column = { cellEditor: SearchSelectCellEditor, cellEditorParams: { values: ['A', 'B'] } };
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ICellEditorComp, ICellEditorParams } from 'ag-grid-community';

/**
 * Configuration for the search-select editor.
 *
 * @property {any[]} [values] - Available values.
 * @property {any} [value] - Initial value.
 * @property {string} [defaultValue] - Default placeholder value.
 */
export type SearchSelectCellEditorParams = ICellEditorParams & {
	values?: any[];
	value?: any;
	defaultValue?: string;
	maxDropdownHeight?: number;
};

export type MultiSearchSelectCellEditorParams = ICellEditorParams & {
	values?: any[];
	value?: any[] | string | null;
	maxDropdownHeight?: number;
	delimiter?: string;
	placeholder?: string;
};

export type MaterialIconSelectCellEditorParams = ICellEditorParams & {
	values?: string[];
	value?: string | null;
	maxDropdownHeight?: number;
	placeholder?: string;
};

export type ColorSelectCellEditorParams = ICellEditorParams & {
	value?: string | null;
	presetColors?: string[];
};

const OPTION_BG = 'var(--layer-1, #1e1e1e)';
const OPTION_BG_HOVER = 'var(--layer-2, #2a2a2a)';
const OPTION_BG_ACTIVE = 'color-mix(in srgb, #2e7d32 22%, var(--layer-1, #1e1e1e))';
const BORDER_COLOR = 'var(--layer-3, #3a3a3a)';
const TEXT_COLOR = 'var(--text-layer-0, #ffffff)';
const MUTED_TEXT = 'var(--text-layer-1, #b8b8b8)';

const toStr = (value: unknown) => String(value ?? '');
const asList = (values?: any[]) => (values ?? []).map((v) => toStr(v));

const parseMultiValue = (value: unknown, delimiter = ','): string[] => {
	if (Array.isArray(value)) {
		return value.map((v) => toStr(v)).filter((v) => v.length > 0);
	}
	if (typeof value === 'string') {
		return value
			.split(delimiter)
			.map((v) => v.trim())
			.filter((v) => v.length > 0);
	}
	return [];
};

const createRoot = () => {
	const root = document.createElement('div');
	root.style.position = 'relative';
	root.style.minWidth = '240px';
	root.style.border = `1px solid ${BORDER_COLOR}`;
	root.style.background = OPTION_BG;
	root.style.borderRadius = '8px';
	root.style.boxShadow = '0 12px 28px rgba(0, 0, 0, 0.35)';
	root.style.padding = '6px';
	root.style.display = 'grid';
	root.style.gap = '6px';
	root.style.fontFamily = 'inherit';
	root.style.color = TEXT_COLOR;
	return root;
};

const createSearchInput = (height?: number) => {
	const input = document.createElement('input');
	input.type = 'text';
	input.style.width = '100%';
	input.style.boxSizing = 'border-box';
	input.style.border = `1px solid ${BORDER_COLOR}`;
	input.style.outline = 'none';
	input.style.padding = '6px 8px';
	input.style.borderRadius = '6px';
	input.style.background = OPTION_BG;
	input.style.color = TEXT_COLOR;
	input.style.font = 'inherit';
	if (height && height > 0) {
		input.style.minHeight = `${Math.max(30, Math.round(height - 8))}px`;
	}
	return input;
};

const createList = (maxHeight?: number) => {
	const list = document.createElement('ul');
	list.style.margin = '0';
	list.style.padding = '4px';
	list.style.listStyle = 'none';
	list.style.overflowY = 'auto';
	list.style.maxHeight = `${maxHeight ?? 230}px`;
	list.style.border = `1px solid ${BORDER_COLOR}`;
	list.style.borderRadius = '6px';
	list.style.background = OPTION_BG;
	return list;
};

const createOption = (label: string) => {
	const row = document.createElement('li');
	row.textContent = label;
	row.dataset['value'] = label;
	row.style.padding = '7px 8px';
	row.style.borderRadius = '5px';
	row.style.cursor = 'pointer';
	row.style.fontSize = '12px';
	row.style.lineHeight = '1.3';
	row.style.userSelect = 'none';
	row.style.whiteSpace = 'nowrap';
	row.style.overflow = 'hidden';
	row.style.textOverflow = 'ellipsis';
	return row;
};

const applyHoverStyles = (item: HTMLElement) => {
	item.addEventListener('mouseenter', () => {
		if (item.dataset['active'] !== 'true') {
			item.style.background = OPTION_BG_HOVER;
		}
	});
	item.addEventListener('mouseleave', () => {
		if (item.dataset['active'] !== 'true') {
			item.style.background = 'transparent';
		}
	});
};

/**
 * Searchable select editor for AG Grid.
 */
export class SearchSelectCellEditor implements ICellEditorComp {
	private eRoot!: HTMLDivElement;
	private eInput!: HTMLInputElement;
	private eList!: HTMLUListElement;
	private params!: SearchSelectCellEditorParams;
	private allValues: string[] = [];
	private filteredValues: string[] = [];
	private value = '';
	private highlightIndex = -1;
	private isMouseSelecting = false;

	init(params: SearchSelectCellEditorParams) {
		this.params = params;
		this.allValues = asList(params.values);

		const initialValue = toStr(params.value);
		const eventKey = params.eventKey;
		const shouldReplace =
			initialValue === params.defaultValue || this.allValues.includes(initialValue);

		const cellRect = params.eGridCell?.getBoundingClientRect();
		this.eRoot = createRoot();
		this.eInput = createSearchInput(cellRect?.height);
		this.eInput.placeholder = 'Search...';

		let finalInitial = initialValue;
		if (eventKey && eventKey.length === 1) {
			finalInitial = shouldReplace ? eventKey : initialValue + eventKey;
		}

		this.eInput.value = finalInitial;
		this.value = finalInitial;
		this.eRoot.appendChild(this.eInput);

		this.eList = createList(params.maxDropdownHeight);
		this.eRoot.appendChild(this.eList);

		this.filteredValues = [...this.allValues];
		this.filterList(this.eInput.value);

		this.eInput.addEventListener('input', () => {
			this.value = this.eInput.value;
			this.highlightIndex = -1;
			this.filterList(this.eInput.value);
		});

		this.eInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === 'Tab') {
				if (this.highlightIndex >= 0 && this.filteredValues[this.highlightIndex]) {
					this.setValue(this.filteredValues[this.highlightIndex]);
				} else {
					this.value = this.eInput.value;
				}
				this.params.api.stopEditing();
				e.preventDefault();
			} else if (e.key === 'Escape') {
				this.params.api.stopEditing(true);
			} else if (e.key === 'ArrowDown') {
				e.preventDefault();
				this.highlightIndex = Math.min(this.highlightIndex + 1, this.filteredValues.length - 1);
				this.updateHighlight();
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				this.highlightIndex = Math.max(this.highlightIndex - 1, 0);
				this.updateHighlight();
			}
		});

		this.eList.addEventListener('mousedown', (e) => {
			this.isMouseSelecting = true;
			const target = e.target as HTMLElement | null;
			const option = target?.closest('li[data-value]') as HTMLElement | null;
			const value = option?.dataset['value'];
			if (value) {
				this.setValue(value);
				this.params.api.stopEditing();
				e.preventDefault();
			}
		});

		this.eInput.addEventListener('blur', () => {
			setTimeout(() => {
				if (!this.isMouseSelecting) {
					this.params.api.stopEditing(true);
				}
				this.isMouseSelecting = false;
			}, 0);
		});

		setTimeout(() => {
			this.eInput.focus();

			if (this.params.defaultValue && this.eInput.value === this.params.defaultValue) {
				this.eInput.value = '';
				this.filterList('');
			} else {
				this.eInput.setSelectionRange(0, this.eInput.value.length);
			}
		}, 0);
	}

	getGui() {
		return this.eRoot;
	}

	afterGuiAttached() {
		this.eInput.focus();
	}

	getValue() {
		return this.value;
	}

	isPopup?() {
		return true;
	}

	setValue(newValue: string) {
		this.value = newValue;
		this.eInput.value = newValue;
	}

	filterList(filterText: string) {
		const lower = filterText.toLowerCase();
		this.filteredValues = this.allValues.filter((v) => v.toLowerCase().includes(lower));
		this.renderList();
	}

	updateHighlight() {
		const items = Array.from(this.eList.children);
		items.forEach((el, idx) => {
			const item = el as HTMLElement;
			item.style.background = idx === this.highlightIndex ? OPTION_BG_HOVER : 'transparent';
		});

		const current = items[this.highlightIndex] as HTMLElement;
		if (current) current.scrollIntoView({ block: 'nearest' });
	}

	renderList() {
		this.eList.innerHTML = '';
		if (this.filteredValues.length === 0) {
			const empty = document.createElement('li');
			empty.textContent = 'No results';
			empty.style.padding = '8px';
			empty.style.color = MUTED_TEXT;
			empty.style.fontSize = '12px';
			this.eList.appendChild(empty);
			return;
		}
		for (const val of this.filteredValues) {
			const li = createOption(val);
			applyHoverStyles(li);
			this.eList.appendChild(li);
		}
		this.updateHighlight();
	}

	destroy() {}
}

/**
 * Searchable multi-select editor for AG Grid.
 */
export class MultiSearchSelectCellEditor implements ICellEditorComp {
	private eRoot!: HTMLDivElement;
	private eChipWrap!: HTMLDivElement;
	private eInput!: HTMLInputElement;
	private eList!: HTMLUListElement;
	private params!: MultiSearchSelectCellEditorParams;
	private allValues: string[] = [];
	private filteredValues: string[] = [];
	private selected = new Set<string>();
	private isMouseSelecting = false;
	private delimiter = ',';

	init(params: MultiSearchSelectCellEditorParams) {
		this.params = params;
		this.delimiter = params.delimiter ?? ',';
		this.allValues = asList(params.values);
		for (const item of parseMultiValue(params.value, this.delimiter)) {
			if (this.allValues.includes(item)) this.selected.add(item);
		}

		this.eRoot = createRoot();

		this.eChipWrap = document.createElement('div');
		this.eChipWrap.style.display = 'flex';
		this.eChipWrap.style.flexWrap = 'wrap';
		this.eChipWrap.style.gap = '4px';
		this.eChipWrap.style.minHeight = '20px';
		this.eRoot.appendChild(this.eChipWrap);

		this.eInput = createSearchInput();
		this.eInput.placeholder = params.placeholder ?? 'Search and select...';
		this.eRoot.appendChild(this.eInput);

		this.eList = createList(params.maxDropdownHeight);
		this.eRoot.appendChild(this.eList);

		this.filteredValues = [...this.allValues];
		this.renderChips();
		this.filterList('');

		this.eInput.addEventListener('input', () => {
			this.filterList(this.eInput.value);
		});

		this.eInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				this.params.api.stopEditing();
				e.preventDefault();
				return;
			}
			if (e.key === 'Backspace' && this.eInput.value.length === 0) {
				const last = Array.from(this.selected).at(-1);
				if (last) {
					this.selected.delete(last);
					this.renderChips();
					this.renderList();
				}
			}
			if (e.key === 'Tab') {
				this.params.api.stopEditing();
			}
			if (e.key === 'Escape') {
				this.params.api.stopEditing(true);
			}
		});

		this.eList.addEventListener('mousedown', (e) => {
			this.isMouseSelecting = true;
			const target = e.target as HTMLElement | null;
			const option = target?.closest('li[data-value]') as HTMLElement | null;
			const value = option?.dataset['value'];
			if (value) {
				this.toggleValue(value);
				e.preventDefault();
			}
		});

		this.eInput.addEventListener('blur', () => {
			setTimeout(() => {
				if (!this.isMouseSelecting) {
					this.params.api.stopEditing();
				}
				this.isMouseSelecting = false;
			}, 0);
		});

		setTimeout(() => this.eInput.focus(), 0);
	}

	private toggleValue(value: string) {
		if (this.selected.has(value)) {
			this.selected.delete(value);
		} else {
			this.selected.add(value);
		}
		this.renderChips();
		this.renderList();
		this.eInput.focus();
	}

	private filterList(filterText: string) {
		const lower = filterText.toLowerCase();
		this.filteredValues = this.allValues.filter((v) => v.toLowerCase().includes(lower));
		this.renderList();
	}

	private renderChips() {
		this.eChipWrap.innerHTML = '';
		if (this.selected.size === 0) {
			const hint = document.createElement('span');
			hint.textContent = 'No selections';
			hint.style.fontSize = '11px';
			hint.style.color = MUTED_TEXT;
			hint.style.padding = '2px 0';
			this.eChipWrap.appendChild(hint);
			return;
		}

		for (const value of this.selected) {
			const chip = document.createElement('button');
			chip.type = 'button';
			chip.textContent = value;
			chip.style.border = `1px solid ${BORDER_COLOR}`;
			chip.style.background = OPTION_BG_ACTIVE;
			chip.style.color = TEXT_COLOR;
			chip.style.borderRadius = '999px';
			chip.style.fontSize = '11px';
			chip.style.padding = '2px 8px';
			chip.style.cursor = 'pointer';
			chip.title = 'Remove selection';
			chip.addEventListener('mousedown', (e) => {
				e.preventDefault();
				this.selected.delete(value);
				this.renderChips();
				this.renderList();
			});
			this.eChipWrap.appendChild(chip);
		}
	}

	private renderList() {
		this.eList.innerHTML = '';
		if (this.filteredValues.length === 0) {
			const empty = document.createElement('li');
			empty.textContent = 'No results';
			empty.style.padding = '8px';
			empty.style.color = MUTED_TEXT;
			empty.style.fontSize = '12px';
			this.eList.appendChild(empty);
			return;
		}

		for (const val of this.filteredValues) {
			const row = createOption(val);
			row.dataset['active'] = this.selected.has(val) ? 'true' : 'false';
			row.style.display = 'grid';
			row.style.gridTemplateColumns = '14px 1fr';
			row.style.gap = '8px';

			const marker = document.createElement('span');
			marker.textContent = this.selected.has(val) ? '✓' : '';
			marker.style.color = TEXT_COLOR;

			const label = document.createElement('span');
			label.textContent = val;
			label.style.whiteSpace = 'nowrap';
			label.style.overflow = 'hidden';
			label.style.textOverflow = 'ellipsis';

			row.textContent = '';
			row.appendChild(marker);
			row.appendChild(label);
			row.style.background = this.selected.has(val) ? OPTION_BG_ACTIVE : 'transparent';
			applyHoverStyles(row);
			this.eList.appendChild(row);
		}
	}

	getGui() {
		return this.eRoot;
	}

	afterGuiAttached() {
		this.eInput.focus();
	}

	getValue() {
		return Array.from(this.selected);
	}

	isPopup?() {
		return true;
	}

	destroy() {}
}

/**
 * Searchable Material Icon selector for AG Grid.
 */
export class MaterialIconSelectCellEditor implements ICellEditorComp {
	private eRoot!: HTMLDivElement;
	private eInput!: HTMLInputElement;
	private eList!: HTMLUListElement;
	private params!: MaterialIconSelectCellEditorParams;
	private allValues: string[] = [];
	private filteredValues: string[] = [];
	private value = '';
	private isMouseSelecting = false;

	init(params: MaterialIconSelectCellEditorParams) {
		this.params = params;
		this.allValues = asList(params.values);
		this.value = toStr(params.value);

		this.eRoot = createRoot();
		this.eInput = createSearchInput();
		this.eInput.placeholder = params.placeholder ?? 'Search material icon...';
		this.eInput.value = this.value;
		this.eRoot.appendChild(this.eInput);

		this.eList = createList(params.maxDropdownHeight);
		this.eRoot.appendChild(this.eList);

		this.filterList(this.value);

		this.eInput.addEventListener('input', () => {
			this.value = this.eInput.value;
			this.filterList(this.eInput.value);
		});

		this.eInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === 'Tab') {
				if (this.filteredValues.length > 0) {
					this.setValue(this.filteredValues[0]);
				}
				this.params.api.stopEditing();
				e.preventDefault();
			} else if (e.key === 'Escape') {
				this.params.api.stopEditing(true);
			}
		});

		this.eList.addEventListener('mousedown', (e) => {
			this.isMouseSelecting = true;
			const target = e.target as HTMLElement | null;
			const option = target?.closest('li[data-value]') as HTMLElement | null;
			const value = option?.dataset['value'];
			if (value) {
				this.setValue(value);
				this.params.api.stopEditing();
				e.preventDefault();
			}
		});

		this.eInput.addEventListener('blur', () => {
			setTimeout(() => {
				if (!this.isMouseSelecting) {
					this.params.api.stopEditing(true);
				}
				this.isMouseSelecting = false;
			}, 0);
		});

		setTimeout(() => {
			this.eInput.focus();
			this.eInput.setSelectionRange(0, this.eInput.value.length);
		}, 0);
	}

	private setValue(value: string) {
		this.value = value;
		this.eInput.value = value;
	}

	private filterList(filterText: string) {
		const lower = filterText.toLowerCase();
		this.filteredValues = this.allValues.filter((v) => v.toLowerCase().includes(lower));
		this.renderList();
	}

	private renderList() {
		this.eList.innerHTML = '';
		if (this.filteredValues.length === 0) {
			const empty = document.createElement('li');
			empty.textContent = 'No icons found';
			empty.style.padding = '8px';
			empty.style.color = MUTED_TEXT;
			empty.style.fontSize = '12px';
			this.eList.appendChild(empty);
			return;
		}

		for (const icon of this.filteredValues) {
			const row = createOption(icon);
			row.style.display = 'grid';
			row.style.gridTemplateColumns = '20px 1fr';
			row.style.gap = '8px';

			const iconEl = document.createElement('span');
			iconEl.className = 'material-icons';
			iconEl.textContent = icon;
			iconEl.style.fontSize = '18px';
			iconEl.style.lineHeight = '1';

			const label = document.createElement('span');
			label.textContent = icon;
			label.style.whiteSpace = 'nowrap';
			label.style.overflow = 'hidden';
			label.style.textOverflow = 'ellipsis';

			row.textContent = '';
			row.appendChild(iconEl);
			row.appendChild(label);
			applyHoverStyles(row);
			this.eList.appendChild(row);
		}
	}

	getGui() {
		return this.eRoot;
	}

	afterGuiAttached() {
		this.eInput.focus();
	}

	getValue() {
		return this.value;
	}

	isPopup?() {
		return true;
	}

	destroy() {}
}

/**
 * Color picker with swatches for AG Grid.
 */
export class ColorSelectCellEditor implements ICellEditorComp {
	private eRoot!: HTMLDivElement;
	private eColorInput!: HTMLInputElement;
	private eTextInput!: HTMLInputElement;
	private eSwatches!: HTMLDivElement;
	private params!: ColorSelectCellEditorParams;
	private value = '#5a5a5a';
	private isMouseSelecting = false;

	init(params: ColorSelectCellEditorParams) {
		this.params = params;
		const initial = toStr(params.value).trim();
		this.value = /^#[0-9a-fA-F]{6}$/.test(initial) ? initial : '#5a5a5a';

		this.eRoot = createRoot();

		const top = document.createElement('div');
		top.style.display = 'grid';
		top.style.gridTemplateColumns = '52px 1fr';
		top.style.gap = '8px';

		this.eColorInput = document.createElement('input');
		this.eColorInput.type = 'color';
		this.eColorInput.value = this.value;
		this.eColorInput.style.width = '52px';
		this.eColorInput.style.height = '34px';
		this.eColorInput.style.border = `1px solid ${BORDER_COLOR}`;
		this.eColorInput.style.borderRadius = '6px';
		this.eColorInput.style.background = 'transparent';
		this.eColorInput.style.padding = '2px';

		this.eTextInput = createSearchInput();
		this.eTextInput.placeholder = '#RRGGBB';
		this.eTextInput.value = this.value;

		top.appendChild(this.eColorInput);
		top.appendChild(this.eTextInput);
		this.eRoot.appendChild(top);

		this.eSwatches = document.createElement('div');
		this.eSwatches.style.display = 'grid';
		this.eSwatches.style.gridTemplateColumns = 'repeat(8, 1fr)';
		this.eSwatches.style.gap = '6px';
		this.eSwatches.style.padding = '2px';
		this.eRoot.appendChild(this.eSwatches);

		this.renderSwatches(
			params.presetColors ?? [
				'#ef4444',
				'#f97316',
				'#f59e0b',
				'#84cc16',
				'#22c55e',
				'#14b8a6',
				'#06b6d4',
				'#3b82f6',
				'#6366f1',
				'#8b5cf6',
				'#a855f7',
				'#ec4899',
				'#f43f5e',
				'#78716c',
				'#6b7280',
				'#111827'
			]
		);

		this.eColorInput.addEventListener('input', () => {
			this.setValue(this.eColorInput.value);
		});

		this.eTextInput.addEventListener('input', () => {
			const next = this.eTextInput.value.trim();
			if (/^#[0-9a-fA-F]{6}$/.test(next)) {
				this.setValue(next);
			}
		});

		this.eTextInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === 'Tab') {
				if (/^#[0-9a-fA-F]{6}$/.test(this.eTextInput.value.trim())) {
					this.setValue(this.eTextInput.value.trim());
				}
				this.params.api.stopEditing();
				e.preventDefault();
			} else if (e.key === 'Escape') {
				this.params.api.stopEditing(true);
			}
		});

		this.eTextInput.addEventListener('blur', () => {
			setTimeout(() => {
				if (!this.isMouseSelecting) {
					this.params.api.stopEditing();
				}
				this.isMouseSelecting = false;
			}, 0);
		});

		setTimeout(() => this.eTextInput.focus(), 0);
	}

	private setValue(next: string) {
		this.value = next;
		this.eColorInput.value = next;
		this.eTextInput.value = next;
	}

	private renderSwatches(colors: string[]) {
		this.eSwatches.innerHTML = '';
		for (const color of colors) {
			const button = document.createElement('button');
			button.type = 'button';
			button.title = color;
			button.style.width = '100%';
			button.style.aspectRatio = '1';
			button.style.border = `1px solid ${BORDER_COLOR}`;
			button.style.borderRadius = '999px';
			button.style.background = color;
			button.style.cursor = 'pointer';
			button.addEventListener('mousedown', (e) => {
				this.isMouseSelecting = true;
				e.preventDefault();
				this.setValue(color);
				this.params.api.stopEditing();
			});
			this.eSwatches.appendChild(button);
		}
	}

	getGui() {
		return this.eRoot;
	}

	afterGuiAttached() {
		this.eTextInput.focus();
	}

	getValue() {
		return this.value;
	}

	isPopup?() {
		return true;
	}

	destroy() {}
}

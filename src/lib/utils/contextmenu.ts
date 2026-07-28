/**
 * @fileoverview Context menu helper for UI actions.
 *
 * @example
 * import { contextmenu } from '$lib/utils/contextmenu';
 * contextmenu(event, { options: [] });
 */
import { type Icon } from '../types/icons';

/**
 * Options for the context menu
 * @date 3/8/2024 - 6:59:48 AM
 *
 * @export
 * @typedef {ContextMenuOptions}
 */
export type ContextMenuOptions = (
	| {
			action: (e: MouseEvent) => void;
			name: string;
			icon: Icon;
			show?: boolean; // default true
			disabled?: boolean; // default false
	  }
	| null
	| string
)[];

const ensureContextMenuStyles = () => {
	if (find('#contextmenu-styles')) return;
	const style = create('style');
	style.id = 'contextmenu-styles';
	style.textContent = `
		.contextmenu {
			background: color-mix(in srgb, var(--layer-2, #25252a) 94%, transparent);
			border: 1px solid color-mix(in srgb, var(--layer-4, #373740) 70%, transparent);
			border-radius: 10px;
			box-shadow:
				0 12px 32px rgba(0, 0, 0, 0.28),
				0 2px 8px rgba(0, 0, 0, 0.2);
			backdrop-filter: blur(10px);
			overflow: hidden;
			animation: contextmenu-enter 120ms cubic-bezier(0.2, 0.9, 0.2, 1);
		}
		@keyframes contextmenu-enter {
			from {
				opacity: 0;
				transform: translateY(4px) scale(0.985);
			}
			to {
				opacity: 1;
				transform: translateY(0) scale(1);
			}
		}
		.contextmenu .contextmenu-list {
			scrollbar-width: thin;
			scrollbar-color: color-mix(in srgb, var(--layer-4, #373740) 85%, transparent)
				color-mix(in srgb, var(--layer-1, #1f1f23) 80%, transparent);
		}
		.contextmenu .contextmenu-item {
			position: relative;
			min-height: 32px;
			padding: 0.35rem 0.6rem;
			font-size: 0.82rem;
			line-height: 1.15;
			color: var(--text-layer-1, #e4e4e7);
			background: transparent;
			transition:
				background-color 120ms ease,
				color 120ms ease,
				transform 80ms ease;
		}
		.contextmenu .contextmenu-item:hover {
			background: color-mix(in srgb, var(--layer-4, #373740) 45%, transparent);
			color: var(--text-layer-0, #ffffff);
		}
		.contextmenu .contextmenu-item:active {
			transform: translateY(0.5px);
		}
		.contextmenu .contextmenu-item:focus-visible {
			outline: none;
			box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text-layer-1, #e4e4e7) 30%, transparent);
			background: color-mix(in srgb, var(--layer-4, #373740) 55%, transparent);
		}
		.contextmenu .contextmenu-icon {
			width: 18px;
			height: 18px;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			color: color-mix(in srgb, var(--text-layer-2, #cfcfd4) 92%, transparent);
			font-size: 0.95rem;
			flex: 0 0 18px;
		}
		.contextmenu .contextmenu-label {
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.contextmenu .contextmenu-title {
			padding: 0.4rem 0.65rem 0.35rem;
			font-size: 0.69rem;
			font-weight: 700;
			letter-spacing: 0.05em;
			text-transform: uppercase;
			color: var(--text-layer-3, #b8b8bf);
			border-bottom: 1px solid color-mix(in srgb, var(--text-layer-4, #373740) 50%, transparent);
		}
		.contextmenu .contextmenu-divider {
			height: 2px;
			margin: 0px;
			background: color-mix(in srgb, var(--text-layer-2, #373740) 55%, transparent);
			border: 0;
		}
	`;
	document.head.appendChild(style);
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const rightClickContextMenu = (e: MouseEvent, el: HTMLDivElement, margin = 8) => {
	const browser = {
		h: window.innerHeight,
		w: window.innerWidth
	};

	const pos = {
		x: e.clientX,
		y: e.clientY
	};

	const { width, height } = el.getBoundingClientRect();
	const maxX = Math.max(margin, browser.w - width - margin);
	const maxY = Math.max(margin, browser.h - height - margin);

	return {
		x: clamp(pos.x, margin, maxX),
		y: clamp(pos.y, margin, maxY)
	};
};

/**
 * Adds a context menu to the target
 * @date 3/8/2024 - 6:59:48 AM
 *
 * @param {ContextMenuOptions} options
 * @param {HTMLElement} target
 */
export const contextmenu = (
	event: MouseEvent | PointerEvent,
	config: {
		options: ContextMenuOptions;
		width?: `${number}${'px' | 'rem' | 'em' | '%'}`; // Default width is 200px
	}
) => {
	event.preventDefault();
	const { options, width = '200px' } = config;
	ensureContextMenuStyles();
	const margin = 8;

	const el = create('div');
	el.style.width = width;
	el.classList.add('shadow', 'border-0', 'contextmenu', 'rounded', 'layer-3');
	el.style.position = 'fixed';
	el.style.zIndex = '1000';
	el.style.maxWidth = `calc(100vw - ${margin * 2}px)`;
	el.style.maxHeight = `calc(100vh - ${margin * 2}px)`;
	el.style.visibility = 'hidden';
	const body = create('div');
	body.classList.add('card-body', 'p-0', 'border-0', 'rounded');
	body.style.overflow = 'hidden';
	el.appendChild(body);
	const list = create('ul');
	list.classList.add('list-group', 'list-group-flush', 'border-0', 'p-0', 'contextmenu-list');
	list.style.maxHeight = `calc(100vh - ${margin * 4}px)`;
	list.style.overflowY = 'auto';
	body.appendChild(list);
	for (const o of options) {
		const li = create('li');
		li.classList.add('list-group-item', 'border-0', 'p-0', 'm-0');

		if (o === null) {
			const hr = create('hr');
			hr.classList.add('contextmenu-divider');
			list.appendChild(hr);
		} else if (typeof o === 'string') {
			const p = create('p');
			p.classList.add('m-0', 'contextmenu-title');
			p.textContent = o;
			li.appendChild(p);
			list.appendChild(li);
		} else {
			if (o.show === false) continue;
			const button = create('button');
			if (o.disabled) {
				button.disabled = true;
				button.classList.add('disabled');
			}
			button.classList.add(
				'btn',
				'btn-dark',
				'border-0',
				'text-start',
				'w-100',
				'p-2',
				'rounded-0',
				'contextmenu-item'
			);
			button.style.display = 'flex';
			button.style.alignItems = 'center';
			button.style.gap = '8px';
			button.type = 'button';
			const icon = create('span');
			icon.classList.add('contextmenu-icon');
			switch (o.icon.type) {
				case 'bootstrap':
					icon.innerHTML = `<i class="bi bi-${o.icon.name}"></i>`;
					break;
				case 'fontawesome':
					icon.innerHTML = `<i class="fa fa-${o.icon.name}"></i>`;
					break;
				case 'material-icons':
					icon.innerHTML = `<span class="material-icons">${o.icon.name}</span>`;
					break;
				case 'material-symbols':
					icon.innerHTML = `<span class="material-symbols-outlined">${o.icon.name}</span>`;
					break;
				case 'svg':
					icon.innerHTML = o.icon.name; // Assuming o.icon.name is an SVG string
					break;
			}
			button.appendChild(icon);
			const span = create('span');
			span.classList.add('contextmenu-label');
			span.textContent = o.name;
			button.appendChild(span);
			button.addEventListener('click', o.action);
			li.appendChild(button);
			list.appendChild(li);
		}
	}

	// const fn = (e: MouseEvent) => {
	for (const currentMenus of findAll('.contextmenu')) {
		currentMenus.remove();
	}

	document.body.appendChild(el);
	const pos = rightClickContextMenu(event, el, margin);
	el.style.left = `${pos.x}px`;
	el.style.top = `${pos.y}px`;
	el.style.zIndex = '9000';
	el.style.visibility = 'visible';

	const rm = () => {
		el.remove();
		document.removeEventListener('click', rm);
	};

	setTimeout(() => {
		document.addEventListener('click', rm);
	}, 10);

	return () => {
		rm();
	};
};

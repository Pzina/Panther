import { iconSvg } from '../art/icons';

type Child = Node | string | number | null | undefined | false | Child[];
type Attrs = Record<string, unknown> | null;

/** Tiny hyperscript helper: h('button', { class: 'btn', onclick }, 'Label'). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') el.className = String(value);
      else if (key === 'html') el.innerHTML = String(value);
      else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
      else if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2), value as EventListener);
      } else if (value === true) el.setAttribute(key, '');
      else el.setAttribute(key, String(value));
    }
  }
  append(el, children);
  return el;
}

export function append(parent: Node, children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(parent, child);
    else if (child instanceof Node) parent.appendChild(child);
    else parent.appendChild(document.createTextNode(String(child)));
  }
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** Inline SVG icon wrapped in a span. */
export function icon(name: string, cls = ''): HTMLSpanElement {
  return h('span', { class: `ico ${cls}`.trim(), html: iconSvg(name) });
}

/** Raw SVG markup wrapped in an element. */
export function svg(markup: string, cls = ''): HTMLSpanElement {
  return h('span', { class: cls, html: markup });
}

export interface ButtonOptions {
  icon?: string;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';
  small?: boolean;
  disabled?: boolean;
  id?: string;
  label?: string;
  cls?: string;
}

export function button(text: string, onClick: () => void, o: ButtonOptions = {}): HTMLButtonElement {
  return h(
    'button',
    {
      class: `btn btn-${o.kind ?? 'secondary'}${o.small ? ' btn-small' : ''}${o.cls ? ` ${o.cls}` : ''}`,
      type: 'button',
      id: o.id,
      disabled: o.disabled,
      'aria-label': o.label,
      onclick: onClick,
    },
    o.icon ? icon(o.icon) : null,
    text ? h('span', { class: 'btn-label' }, text) : null,
  );
}

export function iconButton(name: string, label: string, onClick: () => void, cls = ''): HTMLButtonElement {
  return h(
    'button',
    { class: `icon-btn ${cls}`.trim(), type: 'button', 'aria-label': label, title: label, onclick: onClick },
    icon(name),
  );
}

/** Progress bar (value / max) with an accessible label. */
export function progress(value: number, max: number, cls = ''): HTMLDivElement {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return h(
    'div',
    {
      class: `bar ${cls}`.trim(),
      role: 'progressbar',
      'aria-valuemin': 0,
      'aria-valuemax': max,
      'aria-valuenow': Math.min(value, max),
    },
    h('div', { class: 'bar-fill', style: { width: `${(ratio * 100).toFixed(1)}%` } }),
  );
}

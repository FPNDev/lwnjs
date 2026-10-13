import type { ComponentController } from '../core/component.ts';
import { marker, markup, splitParts } from './scanner.ts';

/** A value accepted by an HTML template. */
export type Interpolation =
  | ComponentController<Node>
  | Node
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | readonly Interpolation[];

const TEXT_SLOT = 0;
const ATTR_SLOT = 1;
const DATA_SLOT = 2;
const TAG_SLOT = 3;
const ATTRS_SLOT = 4;

type IndexSlot = {
  kind: typeof TEXT_SLOT | typeof TAG_SLOT;
  at: number;
  index: number;
};

type PartsSlot = {
  kind: typeof ATTR_SLOT | typeof ATTRS_SLOT | typeof DATA_SLOT;
  at: number;
  name?: string;
  /** Static segments and interpolation indexes. */
  parts: (string | number)[];
};

type Slot = IndexSlot | PartsSlot;

type Template = { content: DocumentFragment; slots: Slot[] };

const attributePair = /([^\s="]+)(?:="([^"]*)")?/gu;

const templates = new WeakMap<TemplateStringsArray, Template>();

function isNode(value: Interpolation): value is Node {
  return typeof value === 'object' && value !== null && 'nodeType' in value;
}

/** Converts a primitive interpolation to text. */
function toText(value: Interpolation): string {
  return value === null || value === undefined ? '' : String(value as string);
}

/** Records slots in preorder and swaps child markers for empty text. */
function findSlots(
  parent: Node,
  slots: Slot[],
  at: number,
  texts: boolean[],
): number {
  let child = parent.firstChild;
  while (child) {
    const next = child.nextSibling;
    if (child.nodeType === 1) {
      const element = child as Element;
      const tag = marker.exec(element.localName);
      if (tag) {
        slots.push({ kind: TAG_SLOT, at, index: Number(tag[1]) });
      }
      const markers: string[] = [];
      for (const { name, value } of element.attributes) {
        if (name.includes('__engine')) {
          slots.push({ kind: ATTRS_SLOT, at, name, parts: splitParts(name) });
          markers.push(name);
        } else if (value.includes('__engine')) {
          slots.push({ kind: ATTR_SLOT, at, name, parts: splitParts(value) });
        }
      }
      for (const name of markers) {
        element.removeAttribute(name);
      }
      at = findSlots(element, slots, at + 1, texts);
    } else {
      const data = (child as CharacterData).data;
      const match = marker.exec(data);
      if (match?.[0] === data && texts[Number(match[1])]) {
        child.replaceWith(document.createTextNode(''));
        slots.push({ kind: TEXT_SLOT, at, index: Number(match[1]) });
      } else if (match) {
        slots.push({ kind: DATA_SLOT, at, parts: splitParts(data) });
      }
      at++;
    }
    child = next;
  }

  return at;
}

function getTemplate(strings: TemplateStringsArray) {
  let template = templates.get(strings);
  if (!template) {
    const element = document.createElement('template');
    const { html, texts } = markup(strings);
    element.innerHTML = html;
    template = { content: element.content, slots: [] };
    findSlots(template.content, template.slots, 0, texts);
    templates.set(strings, template);
  }

  return template;
}

/** Inserts nodes, controller views and list items before a placeholder. */
function insertBefore(placeholder: Text, value: Interpolation) {
  if (value === null || value === undefined) {
    return;
  }

  if (isNode(value)) {
    (placeholder.parentNode as Node).insertBefore(value, placeholder);
  } else if (Array.isArray(value)) {
    for (const item of value as readonly Interpolation[]) {
      insertBefore(placeholder, item);
    }
  } else if (typeof value === 'object') {
    const controller = value as ComponentController<Node>;
    insertBefore(placeholder, controller.node ?? controller.nodes);
  } else {
    (placeholder.parentNode as Node).insertBefore(
      document.createTextNode(String(value)),
      placeholder,
    );
  }
}

/** Builds a fragment from a template, inserting view values and escaping text values. */
export function instantiate(
  strings: TemplateStringsArray,
  values: readonly Interpolation[],
): DocumentFragment {
  const { content, slots } = getTemplate(strings);
  const fragment = document.importNode(content, true);

  let node = fragment.firstChild as Node;
  let at = 0;
  let slotIndex = 0;
  let slot: Slot | undefined = slots[0];
  while (slot) {
    let successor = node.firstChild;
    for (
      let up = node;
      !successor && up !== fragment;
      up = up.parentNode as Node
    ) {
      successor = up.nextSibling;
    }

    while (slot?.at === at) {
      if (slot.kind === TEXT_SLOT) {
        const value = values[slot.index];
        const placeholder = node as Text;
        if (value === null || value === undefined) {
          placeholder.remove();
        } else if (typeof value !== 'object') {
          placeholder.data = String(value);
        } else if (isNode(value)) {
          placeholder.replaceWith(value);
        } else {
          insertBefore(placeholder, value);
          placeholder.remove();
        }
      } else if (slot.kind === TAG_SLOT) {
        const name = String(values[slot.index] as string);
        const element = document.createElement(name);
        for (const attribute of (node as Element).attributes) {
          element.setAttribute(attribute.name, attribute.value);
        }
        element.append(...node.childNodes);
        (node as Element).replaceWith(element);
        node = element;
      } else {
        let text = '';
        for (const part of (slot as PartsSlot).parts) {
          text += typeof part === 'number' ? toText(values[part]) : part;
        }
        if (slot.kind === DATA_SLOT) {
          (node as CharacterData).data = text;
        } else if (slot.kind === ATTR_SLOT) {
          (node as Element).setAttribute(slot.name!, text);
        } else {
          for (const [, name, value] of text.matchAll(attributePair)) {
            (node as Element).setAttribute(name, value ?? '');
          }
        }
      }
      slotIndex++;
      slot = slots[slotIndex];
    }

    node = successor as Node;
    at++;
  }

  return fragment;
}

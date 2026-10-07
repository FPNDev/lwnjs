import type { ComponentController } from '../core';

/** A value accepted by an HTML template. */
export type Interpolation =
  | ComponentController
  | Node
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | void
  | readonly Interpolation[];

type NodeSlot = {
  kind: 'node';
  path: number[];
  index: number;
};

type AttributeSlot = {
  kind: 'attribute';
  path: number[];
  name: string;
  /** Static segments and interpolation indexes. */
  parts: (string | number)[];
};

type Template = {
  content: DocumentFragment;
  slots: (NodeSlot | AttributeSlot)[];
};

const MARKER = '__engine';
const nodeMarker = new RegExp(`^${MARKER}(\\d+)$`, 'u');
const attributeMarker = new RegExp(`${MARKER}(\\d+)__`, 'u');

const templates = new WeakMap<
  Document,
  WeakMap<TemplateStringsArray, Template>
>();

function isNode(value: Interpolation): value is Node {
  return typeof value === 'object' && value !== null && 'nodeType' in value;
}

/** Converts an attribute interpolation to text. */
function toText(value: Interpolation): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (isNode(value)) {
    return value.textContent ?? '';
  }
  if (Array.isArray(value)) {
    return value.map((item) => toText(item as Interpolation)).join(' ');
  }
  if (typeof value === 'object') {
    if (Object.hasOwn(value, 'node')) {
      return toText((value as ComponentController).node as Interpolation);
    }

    if (Object.hasOwn(value, 'nodes')) {
      return toText((value as ComponentController).nodes as Interpolation);
    }

    return '';
  }

  return String(value);
}

/** Adds markers so child and attribute interpolations can be located after parsing. */
function markup(strings: TemplateStringsArray) {
  let html = '';
  for (const [index, string] of strings.entries()) {
    html += string;
    if (index < strings.length - 1) {
      const insideTag = html.lastIndexOf('<') > html.lastIndexOf('>');
      html += insideTag ? `${MARKER}${index}__` : `<!--${MARKER}${index}-->`;
    }
  }

  return html.trim();
}

/** Separates static attribute text from interpolation indexes. */
function attributeSlot(attribute: Attr, path: number[]): AttributeSlot {
  const parts: (string | number)[] = attribute.value.split(attributeMarker);
  for (let partIndex = 1; partIndex < parts.length; partIndex += 2) {
    parts[partIndex] = Number(parts[partIndex]);
  }

  return { kind: 'attribute', path: path.slice(), name: attribute.name, parts };
}

/** Walks the parsed template and records each interpolation's path. */
function findSlots(parent: Node, path: number[], slots: Template['slots']) {
  for (const [position, child] of parent.childNodes.entries()) {
    path.push(position);

    if (child.nodeType === 8) {
      const match = nodeMarker.exec((child as Comment).data);
      if (match) {
        slots.push({
          kind: 'node',
          path: path.slice(),
          index: Number(match[1]),
        });
      }
    } else if (child.nodeType === 1) {
      for (const attribute of (child as Element).attributes) {
        if (attribute.value.includes(MARKER)) {
          slots.push(attributeSlot(attribute, path));
        }
      }
      findSlots(child, path, slots);
    }

    path.pop();
  }
}

function getTemplate(strings: TemplateStringsArray) {
  let byStrings = templates.get(document);
  if (!byStrings) {
    byStrings = new WeakMap();
    templates.set(document, byStrings);
  }

  let template = byStrings.get(strings);
  if (!template) {
    const element = document.createElement('template');
    element.innerHTML = markup(strings);
    template = { content: element.content, slots: [] };
    findSlots(template.content, [], template.slots);
    byStrings.set(strings, template);
  }

  return template;
}

function toNodes(value: Interpolation, nodes: Node[]) {
  if (value === null || value === undefined) {
    return nodes;
  }

  if (isNode(value)) {
    nodes.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      toNodes(item as Interpolation, nodes);
    }
  } else if (typeof value === 'object') {
    if (Object.hasOwn(value, 'node')) {
      return toNodes(
        (value as ComponentController).node as Interpolation,
        nodes,
      );
    }

    if (Object.hasOwn(value, 'nodes')) {
      return toNodes(
        (value as ComponentController).nodes as Interpolation,
        nodes,
      );
    }

    return nodes;
  } else {
    nodes.push(document.createTextNode(String(value)));
  }

  return nodes;
}

function resolve(root: Node, path: number[]) {
  let node = root;
  for (const position of path) {
    node = node.childNodes[position];
  }

  return node;
}

/** Builds views from a template, inserting view values and escaping text values. */
export function instantiate(
  strings: TemplateStringsArray,
  values: readonly Interpolation[],
) {
  const { content, slots } = getTemplate(strings);
  const fragment = document.importNode(content, true);

  // Resolve paths first because earlier replacements can shift later targets.
  const targets = slots.map((slot) => resolve(fragment, slot.path));
  for (const [slotIndex, slot] of slots.entries()) {
    const target = targets[slotIndex];
    if (slot.kind === 'node') {
      (target as ChildNode).replaceWith(...toNodes(values[slot.index], []));
      continue;
    }

    let text = '';
    for (const part of slot.parts) {
      text += typeof part === 'number' ? toText(values[part]) : part;
    }
    (target as Element).setAttribute(slot.name, text);
  }

  return [...fragment.childNodes];
}

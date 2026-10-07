import { create } from './create.ts';
import { instantiate, type Interpolation } from './template.ts';

export type { Interpolation } from './template.ts';

/** Creates one root view; interpolated values become text or inserted views. */
export function html<T extends Node = HTMLElement>(
  strings: TemplateStringsArray,
  ...values: Interpolation[]
): T {
  const nodes = mhtml(strings, ...values);
  if (nodes.length !== 1) {
    throw new Error(
      `html: expected exactly one root node, got ${nodes.length}. Use mhtml for several.`,
    );
  }

  return nodes[0] as T;
}

/** Creates all root views from an HTML template. */
export function mhtml(
  strings: TemplateStringsArray,
  ...values: Interpolation[]
): Node[] {
  return create(() => instantiate(strings, values));
}

/** Creates a typed element by tag name. */
export function element<T extends keyof HTMLElementTagNameMap>(tagName: T) {
  return create(() => [
    document.createElement(tagName),
  ])[0] as HTMLElementTagNameMap[T];
}

/** Creates a text view. */
export function text(value = '') {
  return create(() => [document.createTextNode(value)])[0] as Text;
}

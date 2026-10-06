import { create } from './create.ts';
import { instantiate, type Interpolation } from './template.ts';

export type { Interpolation } from './template.ts';

/**
 * Creates exactly one root node from an HTML template.
 * Interpolated nodes (and arrays of them) are inserted as is; other values
 * become text, so they can never inject markup.
 * The root is typed `HTMLElement` by default; pass the type for anything
 * else: `html<HTMLInputElement>\`<input />\``, `html<Comment>\`<!---->\``.
 * @param strings Template strings.
 * @param values Template interpolations.
 * @returns The template's root node.
 * @throws When the template has zero or several roots.
 */
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

/**
 * Creates all root nodes from an HTML template. Same rules as `html`.
 * @param strings Template strings.
 * @param values Template interpolations.
 * @returns The template's root nodes.
 */
export function mhtml(
  strings: TemplateStringsArray,
  ...values: Interpolation[]
): Node[] {
  return create(() => instantiate(strings, values));
}

/**
 * Creates an element with a typed tag name.
 * @param tagName Tag name.
 * @returns The element.
 */
export function element<T extends keyof HTMLElementTagNameMap>(tagName: T) {
  return create(() => [
    document.createElement(tagName),
  ])[0] as HTMLElementTagNameMap[T];
}

/**
 * Creates a text node.
 * @param value Initial text.
 * @returns The text node.
 */
export function text(value = '') {
  return create(() => [document.createTextNode(value)])[0] as Text;
}

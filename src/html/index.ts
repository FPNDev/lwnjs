import { create, creationContext } from './create.ts';
import { instantiate, type Interpolation } from './template.ts';

export type { Interpolation } from './template.ts';

function rootOf(fragment: DocumentFragment): Node {
  const first = fragment.firstChild;
  if (!first || first !== fragment.lastChild) {
    throw new Error(
      `html: expected exactly one root node, got ${fragment.childNodes.length}. Use mhtml for several.`,
    );
  }

  return first;
}

/** Creates one root view; interpolated values become text or inserted views. */
export function html<T extends Node = HTMLElement>(
  strings: TemplateStringsArray,
  ...values: Interpolation[]
): T {
  const context = creationContext();
  return (
    context
      ? create(context, () => [rootOf(instantiate(strings, values))])[0]
      : rootOf(instantiate(strings, values))
  ) as T;
}

/** Creates all root views from an HTML template. */
export function mhtml(
  strings: TemplateStringsArray,
  ...values: Interpolation[]
): Node[] {
  const context = creationContext();
  if (context) {
    return create(context, () => [...instantiate(strings, values).childNodes]);
  }

  return [...instantiate(strings, values).childNodes];
}

/** Creates a typed element by tag name. */
export function element<T extends keyof HTMLElementTagNameMap>(tagName: T) {
  const context = creationContext();
  return (
    context
      ? create(context, () => [document.createElement(tagName)])[0]
      : document.createElement(tagName)
  ) as HTMLElementTagNameMap[T];
}

/** Creates a text view. */
export function text(value = '') {
  const context = creationContext();
  return (
    context
      ? create(context, () => [document.createTextNode(value)])[0]
      : document.createTextNode(value)
  ) as Text;
}

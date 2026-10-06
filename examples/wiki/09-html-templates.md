# 9. HTML templates

`lwnjs/html` builds DOM from tagged template literals. It's optional: components can create views any way they like. But it's fast and safe, and it's what makes server-rendered views hydratable.

```ts
import { element, html, mhtml, text } from 'lwnjs/html';
```

## `html`: one root

```ts
const title = html`<h1 class=${classes.title}>${user.name}</h1>`;
```

- Returns exactly one root node, typed `HTMLElement` by default.
- Throws `html: expected exactly one root node` for zero or several roots; use `mhtml` for those.
- Leading and trailing whitespace of the template is trimmed.

Typing: pass the root type when you need more than `HTMLElement`:

```ts
const input = html<HTMLInputElement>`<input type="email" />`;
const slot = html<Comment>`<!---->`;
const row = html<HTMLTableRowElement>`<tr><td>${name}</td></tr>`;
```

## `mhtml`: several roots

```ts
const nodes = mhtml`<dt>${term}</dt><dd>${definition}</dd>`;
list.append(...nodes);
```

Returns `Node[]`, including whitespace text nodes between elements.

## `element` and `text`

```ts
const canvas = element('canvas');   // typed HTMLCanvasElement
const label = text('Loading');      // a Text node; change it with label.data = '…'
```

Use these instead of `document.createElement` / `createTextNode` in server-rendered code: they take part in hydration.

## Values

| Value | Inside content | Inside an attribute |
|---|---|---|
| `string`, `number`, `bigint`, `boolean` | a text node with `String(value)` | the text, as is |
| a `Node` | inserted as is (moved if mounted elsewhere) | its `textContent` |
| an array | each item, in order (nested arrays flattened) | items joined with spaces |
| `null` / `undefined` | nothing | empty |

**Values are never parsed as HTML.** A string containing `<script>` becomes visible text. Inject markup deliberately (e.g. sanitized markdown) by assigning `innerHTML` on a node you own.

### Attributes

```ts
html`<a href=${url} class="link ${isActive ? 'active' : ''}" title="${hint}">…</a>`;
```

- Quoted, unquoted and mixed (static text plus values) attribute values all work.
- Values are set with `setAttribute`, so quotes and `<` in values are safe.
- An attribute **name** can't be interpolated, and a value can't add attributes (`<a ${attrs}>` doesn't work).
- Boolean attributes: write them statically (`<button disabled>`), or set properties afterwards (`button.disabled = flag`).
- Event handlers aren't attributes: use `listen(node, 'click', fn)` after building.

## Caching and performance

The markup is parsed **once per call site**, cached by the identity of the template-literal strings. Every call then:
1. clones the parsed template (`importNode`),
2. resolves the value slots by `childNodes` paths,
3. fills them: O(slots).

Templates inside loops and render functions are cheap. Parsing goes through a `<template>` element, so context-sensitive markup (`<tr>`, `<td>`, `<option>`, `<li>`) parses correctly.

## Patterns

**Build, attach, fill:**

```ts
const name = html`<strong></strong>`;
const node = html`<li>${name}<button>✕</button></li>`;
attach(parent, node);
name.textContent = user.name;
```

Keep references to the nodes you will change, rather than querying for them later.

**Lists from data:**

```ts
const items = html`<ul>${todos.map((todo) => html`<li>${todo.title}</li>`)}</ul>`;
```

That's fine for static lists. For lists that change, use keyed views (see [Components](03-components.md)).

**Assign to a `const` first.** Assigning straight to a `let x: HTMLElement | undefined` makes TypeScript infer the generic from the union, and you get `Node`. Write `const next = html…; x = next;` instead.

## Limitations

- One value per attribute position; no interpolated attribute names or spread attributes.
- A literal `>` inside a *static* attribute value before an interpolation confuses slot detection (`title="a > b" class=${x}`). Interpolate that value instead.
- Interpolating inside `<script>`, `<style>` or comments isn't supported.
- Templates must be valid HTML nesting. The parser restructures invalid markup, such as a `<div>` inside a `<p>`.

## Hydration

Under `hydrate()`, `html`, `mhtml`, `element` and `text` don't build anything when the server rendered the same view: they return the server's nodes. Template values are not re-applied; the server already did it. See [Server rendering](11-server-rendering.md).

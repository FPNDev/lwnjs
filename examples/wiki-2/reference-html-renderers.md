# HTML and renderer reference

This page covers the typed DOM helpers in `lwn-js/html` and the three-operation view contract in `lwn-js/core`.

## HTML helpers

```ts
import { element, html, mhtml, text } from 'lwn-js/html';

const title = element('h1');
const message = text('Ready');
const card = html<HTMLElement>`<article><h2>Card</h2></article>`;
const fragment = mhtml`<span>One</span><span>Two</span>`;
```

| Helper                  | Result                                            |
| ----------------------- | ------------------------------------------------- |
| `element(tagName)`      | A DOM element with a tag-specific TypeScript type |
| `text(value?)`          | A text node                                       |
| `html tagged template`  | Exactly one root node                             |
| `mhtml tagged template` | Every root node as a `Node[]`                     |

`html` throws if a template has zero or more than one root node. Use `mhtml` when several top-level nodes are expected. Add a type argument when the root is not an `HTMLElement`, such as a comment placeholder.

These functions use `document`. In the browser that is the page document. On the server, the rendering host provides a compatible DOM document.

## Interpolated values

A child position accepts a node, primitive value, array of values, or nullish value.

```ts
const item = html`<li>${title}: ${count}</li>`;
const list = html`<ul>
  ${rows.map((row) => html`<li>${row.name}</li>`)}
</ul>`;
```

| Value                           | Child position                                            | Attribute position              |
| ------------------------------- | --------------------------------------------------------- | ------------------------------- |
| string, number, bigint, boolean | Text node containing `String(value)`                      | Text containing `String(value)` |
| `Node`                          | The node itself, moved if it is already mounted elsewhere | The node's `textContent`        |
| Array                           | Items inserted in order. Nested arrays are flattened.     | Item text joined with spaces    |
| `null` or `undefined`           | No node                                                   | Empty string                    |

Strings in child positions are text. They are never parsed as HTML. If a value contains `<script>`, the browser displays those characters as text.

Template interpolation in an attribute sets the whole attribute value with `setAttribute`. Values containing quotes or angle brackets cannot add a second attribute or become markup. This does not validate a URL's scheme or destination, so validate untrusted URLs before using them in `href` or `src`.

```ts
const link = html`<a href=${url} title="Open ${label}">Open</a>`;
```

Attribute names cannot be interpolated. Spread attributes are not supported. Event handlers are not special template values. Create the node, then attach the listener with `listen` or your own event API.

Write boolean attributes statically, or set DOM properties after creation:

```ts
const button = html<HTMLButtonElement>`<button>Save</button>`;
button.disabled = isSaving;
```

## Template rules

The browser parses each template call site once per document. Later calls clone that parsed template and fill its value slots. This keeps markup parsing out of repeated list item creation while preserving ordinary DOM nodes as the result.

The template parser uses an HTML `<template>` element, so it handles context-sensitive tags such as `<tr>`, `<td>`, `<option>`, and `<li>` according to browser HTML parsing rules. Templates must still have valid nesting. Invalid HTML may be rearranged by the parser.

Known limits:

- No interpolated attribute names and no spread attributes.
- Attribute names cannot be dynamic, but an attribute value can combine static text with more than one interpolated value.
- Interpolation inside `<script>`, `<style>`, and HTML comments is unsupported.
- A literal `>` in a static attribute value before an interpolation can confuse value-slot detection. Interpolate the whole attribute value in that case.
- `html` requires exactly one root node. Use `mhtml` for zero or multiple roots.

The template helpers do not provide an HTML sanitizer. If the application deliberately assigns `innerHTML`, sanitize that string with an appropriate HTML sanitizer first.

## Hydration behavior

During server rendering, `html`, `mhtml`, `element`, and `text` record the nodes they create inside render scopes. The server serializes that information with the page.

During `hydrate(container, app, router)`, the same calls adopt the corresponding nodes from server markup instead of creating replacements. The app must create views in a matching order and shape. Interpolated values are not applied a second time, because the server already rendered them. Code that changes a node after setup can still make client-only updates.

If there is no hydration payload, `hydrate` runs the app as a normal client mount. See [Server reference](reference-server.md) for the full lifecycle.

## Renderer contract

The core engine does not require DOM nodes. It uses one renderer for mounting outlet views and removing views during destruction.

```ts
type Renderer<V extends object> = {
  append(parent: V, view: V): void;
  insertBefore(anchor: V, view: V): void;
  remove(view: V): void;
};
```

| Operation                    | Contract                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| `append(parent, view)`       | Place the view as the last child of the parent                                                      |
| `insertBefore(anchor, view)` | Place the view immediately before the anchor under the same parent                                  |
| `remove(view)`               | Remove the view from wherever it is mounted; do nothing if it is already unmounted or is not a view |

Install the renderer once, before an outlet shows a view:

```ts
import { domRenderer, setRenderer } from 'lwn-js/core';

setRenderer(domRenderer);
```

The DOM renderer calls methods on the provided nodes rather than reading global document state. It works with browser DOM implementations such as happy-dom, jsdom, and linkedom.

`destroy(node)` calls `remove(node)` for the root and each logical descendant. Logical nodes may be plain objects rather than views, so a renderer's `remove` must tolerate values that are not mounted views. It should also tolerate repeated or already-completed removal.

`insertBefore` receives the anchor first and the new view second. An outlet with a placeholder uses the placeholder as the anchor. When replacing a current view, it inserts the new view before the old view, then destroys the old view.

## Custom renderers

A renderer can target any object-based view system. For example, with Three.js objects:

```ts
import type { Object3D } from 'three';
import { setRenderer } from 'lwn-js/core';

setRenderer<Object3D>({
  append(parent, view) {
    parent.add(view);
  },
  insertBefore(anchor, view) {
    // This abbreviated adapter treats scene child order as irrelevant.
    // Preserve sibling order here if it affects your renderer.
    anchor.parent?.add(view);
  },
  remove(view) {
    (view as Partial<Object3D>).parent?.remove(view as Object3D);
  },
});
```

The engine stores one renderer at module scope. If an application combines a DOM interface with a canvas scene, keep the DOM renderer installed and manage the scene objects in the component that owns them. Create scene objects during setup, mount them in the scene, and dispose their resources in `onDestroy`.

Server rendering uses DOM views and the DOM renderer. HTML is the output format for SSR, SSG, and ISR.

# 06. HTML and renderers

The HTML package is an optional way to build DOM nodes. It does not decide what changes when data changes. You keep references to the nodes that matter and update them directly.

## Build a view with html

```ts
import { html } from 'lwnjs/html';

const title = html`<h1>Welcome</h1>`;
const node = html`<section>${title}</section>`;
title.textContent = 'Your dashboard';
```

html returns exactly one root node. Pass a type parameter when TypeScript needs a more specific element type:

```ts
const email = html<HTMLInputElement>`<input type="email" />`;
const placeholder = html<Comment>`<!---->`;
```

For several root nodes, use mhtml. For an element or text node created by tag name or value, use element and text.

## Interpolation is text by default

Strings, numbers, booleans, and bigints become text nodes when used as child content. They are never parsed as markup. A string containing markup-like text appears as text rather than creating an image element.

Nodes are inserted as nodes, and arrays are flattened recursively. Null and undefined add no child nodes. In an attribute, values become text; arrays are joined with spaces and a node contributes its textContent.

```ts
const greeting = html`<p>Hello, ${userName}.</p>`;
const link = html<HTMLAnchorElement>`<a href=${url}>Open</a>`;
```

This protects interpolated text. If you deliberately set innerHTML later, the safety depends on how that string was produced.

## Keep references to updated nodes

Build the structure once, keep the nodes that will change, and update them where the data changes:

```ts
const title = html`<h1></h1>`;
const status = html`<p></p>`;
const node = html`<section>${title}${status}</section>`;

title.textContent = account.name;
status.textContent = account.online ? 'Online' : 'Offline';
```

For dynamic collections, keep one view per item in a Map. Create rows for new items, update existing rows, and destroy rows that were removed. Filtering can often toggle hidden rather than rebuild the list.

## The renderer

The core does not assume that a view is a DOM node. Set a renderer so outlets can mount views and destroy can unmount them. The built-in domRenderer handles DOM nodes, including DOM implementations used during server rendering.

A renderer defines three operations:

- append(parent, view) mounts a view at the end of a parent.
- insertBefore(anchor, view) places a view immediately before an anchor.
- remove(view) removes a view. It must safely ignore logical nodes that are not views.

Components can still call DOM methods directly when they create and arrange their own nodes. The renderer is used by outlets and by destroy.

## Hydration note

Server rendering can adopt nodes created through html, mhtml, element, and text. If server hydration is part of the app, use these creation APIs for views that must be adopted. Direct document.createElement calls do not create hydration records.

See [HTML and renderer reference](reference-html-renderers.md) for the supported values, parsing limits, and renderer types.

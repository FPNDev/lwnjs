# hello-world

The smallest engine-ts app: a counter.

```sh
npm install
npm run dev
```

What it shows, all in [src/main.ts](src/main.ts):

- `setRenderer(domRenderer)`: the engine places views through a renderer; the DOM is one of them.
- A component is a function `(parent) => view`. It creates its view, calls `attach(parent, node)`, and wires everything with `node` as the owner.
- **Less is more.** The count lives in a plain `let` with a `setCount` function, because only this component reads it. Reach for `createState` when several independent parts need to observe the same value (see `simple-app`).
- `listen(node, target, type, fn)` is `addEventListener` that is removed when `node` is destroyed. That includes the `window` key listener, which in plain DOM code is the classic leak.
- `html` templates: strings become text (never HTML), nodes are inserted as is.

Requires the engine to be built once: `cd ../../engine-ts && npm run build`.

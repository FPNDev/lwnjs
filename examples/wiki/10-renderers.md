# 10. Renderers

The core of LWN doesn't know about the DOM. It needs exactly three view operations, which you supply once with `setRenderer`. With them, outlets can mount views and `destroy` can unmount them.

```ts
type Renderer<V extends object> = {
  /** Appends `view` as the last child of `parent` (outlets without a placeholder). */
  append(parent: V, view: V): void;
  /** Inserts `view` right before `anchor`, under the same parent (outlets, in-place swaps). */
  insertBefore(anchor: V, view: V): void;
  /** Removes `view` from wherever it is mounted (destroy). Called for every destroyed node. */
  remove(view: V): void;
};
```

## The DOM renderer

```ts
import { domRenderer, setRenderer } from 'lwnjs/core';
setRenderer(domRenderer);
```

- It uses only methods on the nodes it receives and no globals, so it works in browsers, in happy-dom or jsdom, and with `linkedom` on the server.
- `remove` uses `view.parentNode?.removeChild(view)`, not `view.remove()`. `destroy` passes every logical node to `remove`, including plain objects. A plain object has no `parentNode`, so nothing happens, and a logical node that happens to have its own `remove()` method is never called by accident.

Call `setRenderer` before the first outlet shows anything. Without a renderer, `destroy` still works (no views are removed), but outlets throw `Outlet: no renderer set`.

## Which operations happen when

| Engine action                         | Renderer calls                                                       |
| ------------------------------------- | -------------------------------------------------------------------- |
| `outlet.show(...)` with a placeholder | `insertBefore(placeholder, view)`                                    |
| `outlet.show(...)` without one        | `append(owner, view)`                                                |
| Switching views                       | `insertBefore(oldView, newView)`, then `remove(oldView)` via destroy |
| `destroy(node)`                       | `remove(node)`, then `remove(child)` for every descendant            |

Everything else (`parent.append(child)` in your components, moving views, portals) is your own code calling your view system directly.

## Writing a renderer

Any tree-shaped view system can be one. A three.js scene graph:

```ts
import type { Object3D } from 'three';

setRenderer<Object3D>({
  append: (parent, view) => {
    parent.add(view);
  },
  insertBefore: (anchor, view) => {
    // Order rarely matters in a scene graph: add next to the anchor.
    anchor.parent?.add(view);
  },
  remove: (view) => {
    // Called for every destroyed logical node: ignore what isn't an Object3D.
    (view as Partial<Object3D>).parent?.remove(view);
  },
});
```

Components then build `Object3D`s, attach them to their logical parent, and the rest of the engine (stores, state, envs, routing, outlets) works unchanged. Destroying a component removes its meshes from the scene and runs its cleanup (dispose geometries in `onDestroy`).

A canvas UI with your own retained node objects, or a terminal UI with box objects, follows the same pattern.

### Rules for `remove`

- It must ignore objects that aren't views: logical nodes can be plain objects, connections, scopes.
- It must not throw for views that are already unmounted.
- It's called root first during `destroy`, then for each descendant. Removing a descendant from an already-detached subtree should be cheap.

## One renderer per app

The renderer is module-level state: one per page. If you mix view systems (a DOM UI with a WebGL viewport), keep the DOM renderer for the engine and manage the WebGL objects inside a component: create them in setup, add them to your scene, and dispose them in `onDestroy`.

## Server rendering

Server rendering always uses DOM views (`linkedom`) and the DOM renderer. HTML is the only output format for SSR, SSG and ISR.

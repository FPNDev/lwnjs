# 3. Components

A component is a function that builds a piece of UI once and wires its behaviour. There are no classes, no render functions that re-run and no props diffing. When something changes later, the component (or whoever holds its controller) changes the specific nodes.

## The shape of a component

```ts
import { attach, component, listen } from 'lwnjs/core';
import { html } from 'lwnjs/html';

export const SearchBox = component(
  (parent: object, onSearch: (term: string) => void) => {
    // 1. Build the view.
    const input = html<HTMLInputElement>`<input
      type="search"
      placeholder="Search"
    />`;
    const node = html`<form class="search">${input}</form>`;

    // 2. Join the logical tree. From here on, `node` owns everything.
    attach(parent, node);

    // 3. Wire behaviour. All of it ends when `node` is destroyed.
    listen(node, 'submit', (event) => {
      event.preventDefault();
      onSearch(input.value.trim());
    });

    // 4. Hand back the view, or a controller.
    return node;
  },
);
```

The rules:

- **The first argument is the parent**, the logical node this component belongs to. Other arguments are whatever the component needs: data, callbacks.
- **Attach first.** `attach(parent, node)` should come right after the root is built, before anything that needs an owner.
- **Don't mount yourself.** Where the view goes in the DOM is the caller's decision: `parent.append(SearchBox(parent, run))`, or inside a template. That keeps components reusable in any position, including portals.
- **Return the node, or a controller** when the caller must drive it later.

## Setup frames and implicit owners

Owner-taking APIs need to know which node a subscription or listener belongs to. You can always pass it explicitly. Inside a **setup frame** you can leave it out.

`component(fn)` wraps a function so each call runs in its own frame. In a frame, the **first** `attach(parent, node)` makes `node` the frame's owner. After that, these forms use it:

| Explicit (works anywhere)                                   | Owner-less (during setup)            |
| ----------------------------------------------------------- | ------------------------------------ |
| `listen(node, target, type, fn, options?)`                  | `listen(target, type, fn, options?)` |
| `state.subscribe(node, fn)` / `emitter.subscribe(node, fn)` | `state.subscribe(fn)`                |
| `router.route(node, Route, action)`                         | `router.route(Route, action)`        |
| `router.routes(node, [A, B], action)`                       | `router.routes([A, B], action)`      |
| `useStore(node, Store)`                                     | `useStore(Store)`                    |
| `attachStore(node, Store)`                                  | `attachStore(Store)`                 |
| `onDestroy(node, fn)`                                       | `onDestroy(fn)`                      |
| `onAttach(node, hook)`                                      | `onAttach(hook)`                     |

### Where frames come from

| Frame                                               | Owner                             |
| --------------------------------------------------- | --------------------------------- |
| `component(fn)`                                     | the first node attached inside it |
| A page shown by an outlet (`outlet.show(Page)`)     | the first node the page attaches  |
| A route action (`router.route(Route, () => { … })`) | the route listener's owner        |
| An `onAttach` hook                                  | the attach scope (ends on detach) |
| The app root under `hydrate()` and server rendering | the first node the app attaches   |

So pages and route actions need no wrapper. Components you call directly from other components do.

### Where there is no frame

- **After an `await`**: the frame is gone once the function returns synchronously.
- **In event handlers, timers and subscription callbacks**: they run later, outside any setup.

Owner-less calls there throw `no owner here`, except `subscribe(fn)`, which is simply unowned outside setup. In those places either pass the owner explicitly (`listen(node, button, 'click', …)`) or capture it during setup:

```ts
const owner = getOwner()!;
const data = await load();
listen(owner, window, 'resize', relayout);
```

### Why `component()` is needed for nested components

The engine can't see where a function returns. Without a wrapper, a child's `attach` happens in the parent's frame, whose owner is already set, so the child's owner-less calls would silently belong to the parent: released later than they should be. Wrapping every component that you call directly avoids that. Pages and route actions are already covered.

## Controllers

When the caller needs to change a component later, return an object instead of the node:

```ts
export type TodoFooter = {
  node: HTMLElement;
  update(list: TodoList): void;
};

export const TodoFooter = component(
  (parent: object, onClearDone: () => void): TodoFooter => {
    const left = html`<span></span>`;
    const clear = html<HTMLButtonElement>`<button>Clear done</button>`;
    const node = html`<footer>${left}${clear}</footer>`;
    attach(parent, node);
    listen(clear, 'click', onClearDone);

    return {
      node,
      update(list) {
        const open = countOpen(list);
        left.textContent = `${open} left`;
        clear.disabled = open === list.todos.length;
      },
    };
  },
);
```

- Keep controllers small: `update(data)`, `setTitle(text)`, `focus()`.
- Callbacks go _in_ as arguments, so the component reports events without knowing who listens.
- A type and a value may share a name (`type TodoFooter` and `const TodoFooter`).

## Composition

**Children are created by the parent, with the parent's node as their parent:**

```ts
const Page = component((parent: object) => {
  const node = html`<section></section>`;
  attach(parent, node);

  const header = ListHeader(node, onDelete); // child owned by `node`
  const form = NewTodoForm(node, onAdd);
  node.append(header.node, form);

  return node;
});
```

**Or compose views in a template.** Nodes interpolated into `html` are inserted as they are:

```ts
const node = html`<div class="card">
  ${Avatar(card, user)}${Name(card, user)}
</div>`;
```

You need the parent node before its children exist, so templates that contain child components usually build the outer node first and append the children, as above. Purely visual pieces (no behaviour, no owner) can be interpolated directly.

**A child that needs data from the parent's stores** resolves it itself with `useStore(Store)`. The parent doesn't pass everything down.

## Lists: keyed views

Rendering a collection means keeping a view per item and updating in place:

```ts
const views = new Map<string, Row>();
let pass = 0;

function render(items: Item[]) {
  pass++;
  for (const [index, item] of items.entries()) {
    let row = views.get(item.id);
    if (!row) {
      row = Row(list, item); // a component: owned by `list`
      views.set(item.id, row);
    }
    row.update(item);
    row.seen = pass;
    if (list.children[index] !== row.node) {
      list.insertBefore(row.node, list.children[index] ?? null); // move only when out of place
    }
  }
  for (const [id, row] of views) {
    if (row.seen !== pass) {
      destroy(row.node); // view, listeners, sub-components: all gone
      views.delete(id);
    }
  }
}
```

- O(1) lookup per item, and creation only for new items.
- Mark-and-sweep with a pass number avoids allocating a `Set` per render.
- Filtering is usually `row.node.hidden = !matches(item)`: nothing is re-created.
- `render` runs from a subscription callback, outside setup. That's fine, because `Row` is a `component()` and opens its own frame.

## Portals

The logical parent and the DOM parent are independent, so a portal is two lines:

```ts
export const Modal = component((owner: object, title: string) => {
  const node = html`<div class="backdrop"><div class="dialog">…</div></div>`;
  attach(owner, node); // owned by whoever opened it
  document.body.append(node); // mounted at the end of <body>
  listen(document, 'keydown', (event) => {
    if (event.key === 'Escape') {
      destroy(node);
    }
  });

  return node;
});
```

When `owner` is destroyed (the user navigates away, a list item is removed), the modal is destroyed too, and its `document` listener is removed with it. Toasts, tooltips, context menus and floating panels all work the same way.

## Moving a live component

`attach(newParent, node)` moves a component together with everything it owns. Its state, subscriptions, scroll position and half-typed input all survive, and nothing is re-created:

```ts
attach(dock, conversation.node);
dock.append(conversation.node);
```

Things that depend on _where_ the component is (its parent's store, a placement mode) are re-read in `onAttach`, which runs after every attach:

```ts
onAttach(() => {
  // Read from `node`: the hook's own owner is the attach scope, which isn't in the tree.
  const placement = useStore(node, PlacementStore);
  header.showButtonsFor(placement);
});
```

After the move, destroying the old parent no longer affects the component, because it isn't that parent's child any more. `complex-app` uses this to pop a live chat into a floating dock that survives navigation.

## Reattachable components

A component can also be created without a parent and attached later:

```ts
export function Badge() {
  const node = html`<span class="badge"></span>`;
  onAttach(node, (scope) => {
    const theme = useStore(node, ThemeStore); // whatever the current parent provides
    theme.color.subscribe(scope, (color) => {
      // ends on detach
      node.style.color = color;
    });
  });

  return node;
}
```

Use this for components that move around. Use the standard pattern otherwise.

## Lifecycle hooks in components

```ts
onDestroy(() => clearInterval(timer)); // cleanup
onAttach((scope) => {
  // per attachment
  focusTrap.enable();
  return () => focusTrap.disable(); // runs on detach
});
```

## Anti-patterns

- **Re-creating views to update them.** Keep references to the nodes you change.
- **Querying the DOM for your own nodes** (`node.querySelector('.title')`). You built them; keep the variables. (Querying a static template once during setup is fine.)
- **`addEventListener` on `window`/`document` without an owner.** Use `listen`, or the listener outlives the component.
- **State primitives for local values.** A `let` is enough when only this component reads it.
- **Calling an unwrapped component from another component.** Wrap it in `component()`, or its owner-less calls attach to the caller.

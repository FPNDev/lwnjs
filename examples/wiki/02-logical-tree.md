# 2. The logical tree

Everything in engine-ts hangs off one structure: a tree of **logical nodes** that records ownership. If A owns B, destroying A destroys B. That one rule replaces most lifecycle bookkeeping.

## Logical nodes

A logical node is **any object**:
- a DOM element (the usual case: a component's root),
- a plain `{}` used as an owner for a group of things,
- a non-visual resource: a WebSocket wrapper, a WebRTC connection, a worker handle,
- a scene-graph object if you use a non-DOM renderer.

The engine keeps one small record per node in a `WeakMap`. Nodes that are never attached to anything cost nothing, and records disappear with their objects.

## `attach(parent, child)`

Makes `child` a logical child of `parent`. **O(1)** plus hooks.

```ts
attach(appNode, sidebarNode);
```

- If `child` already has a different parent, it is **moved**: detached from the old one (its `onAttach` scope ends), then attached to the new one (its `onAttach` hooks run again).
- Attaching to the parent it already has does nothing.
- `attach` changes only the logical tree. Mounting the view (`parent.append(child)`) is a separate step, and is yours.
- Inside a setup frame (see [Components](03-components.md)), the first `attach` makes `child` the frame's owner.

Roots are nodes without a parent, typically the container element you mount into. A root has no record until something is attached to it.

## `detach(child)`

Removes `child` from its parent **without destroying it**. **O(1)** plus hooks.

- Its `onAttach` scope is destroyed, so subscriptions made in `onAttach` hooks end.
- Everything the child owns directly (its own listeners, subscriptions, children) stays alive.
- A detached child can be attached somewhere else later.

## `destroy(node)`

Destroys `node` and its whole logical subtree. **O(subtree)**.

```ts
destroy(dialogNode);
destroy(maybeUndefined);   // undefined is ignored
```

The order is deliberate:
1. **The root view is removed first**, through the renderer (`renderer.remove(node)`). That is one live DOM mutation; everything below is removed from an already detached tree, which is cheap.
2. **Children are destroyed**, recursively, children before parents. Each child's view is removed too, which matters for portals mounted elsewhere.
3. **The node is detached** from its parent; its `onAttach` scope ends.
4. **`onDestroy` hooks run.** Owner-scoped subscriptions, listeners and route listeners end here.

Notes:
- A node that never joined the tree still has its view removed.
- Destroying twice is harmless: the second call finds no record.
- A throwing hook doesn't stop the others; the error is rethrown asynchronously, so it still reaches the console and error trackers.

## Reading the tree

```ts
getParent(node);   // logical parent or undefined, O(1)
isAttached(node);  // has a logical parent? O(1); roots are never "attached"
```

There is deliberately no API to list children or walk the tree. Components keep references to what they create, which is faster and clearer than querying a tree.

## Lifecycle hooks

```ts
onDestroy(node, () => socket.close());   // once, when node is destroyed
onAttach(node, (scope) => { … });        // on every attach, and now if attached already
```

Both have owner-less forms inside setup frames: `onDestroy(fn)` and `onAttach(hook)`. See [Components](03-components.md).

- **`onDestroy`** returns a function that unregisters the hook, in O(1).
- **`onAttach`** hooks receive a `scope`: a logical node that is destroyed on the next detach. Anything owned by the scope (`state.subscribe(scope, fn)`) ends when the component is detached or moved. A function returned from the hook also runs on detach. Hooks run inside a frame owned by the scope, so owner-less calls inside them belong to the scope.

## Ownership patterns

**One owner per thing.** Every subscription, listener and timer should have exactly one owner: the node whose lifetime it shares.

```ts
listen(window, 'resize', relayout);                // owned by the current component
state.subscribe(render);                           // owned by the current component
onDestroy(() => clearInterval(timer));             // a timer, cleaned up with its owner
```

**Grouping with a plain object.** When a set of things must end together but has no view, give them their own node (plain object, symbol, etc):

```ts
const session = {};
attach(page, session);
socket.messages.subscribe(session, handle);
onDestroy(session, () => socket.close());
// later: destroy(session) ends them all, page stays
```

**Replacing a group.** Destroy the old group node and create a new one:

```ts
let buttons: HTMLElement | undefined;
function showButtons(kind: 'page' | 'dock') {
  destroy(buttons);                       // old buttons and their listeners
  const group = html`<span></span>`;
  attach(header, group);
  // … listen(group, button, 'click', …)
  buttons = group;
}
```

**Non-visual nodes.** A connection is a node: attach it under a service root, close it in `onDestroy`, and `destroy(link)` whenever the connection should end (refused handshake, remote close, replaced by a newer link). See `complex-app/src/store/chat.ts`.

## Complexity

| Operation | Cost |
|---|---|
| `attach`, `detach`, move | O(1) + hooks |
| `destroy` | O(subtree), one live view mutation |
| `getParent`, `isAttached` | O(1) |
| `onDestroy` register and unregister | O(1) |

Children are kept in a `Set`, so attaching, detaching and moving never scan siblings.

## Things to avoid

- **Attaching a node under its own descendant.** That creates a cycle, and the engine doesn't check for it.
- **Keeping references to destroyed nodes** and attaching them again expecting their old hooks. A destroyed node's record is gone; attaching it again starts fresh.
- **Querying the DOM to find components.** Keep references (`Map<id, view>`) instead.

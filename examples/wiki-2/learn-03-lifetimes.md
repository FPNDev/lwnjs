# 03. Lifetimes and ownership

Components need a clear answer to one question: when this component goes away, what else should stop? LWN records ownership links so child components and resources can share their owner's lifetime.

These links are not a virtual view tree. Ordinary updates do not walk them. They support attach, detach, cleanup, and scoped lookup while your event handlers update the exact nodes that changed.

## Logical parent and view parent

A logical node can be any object: a DOM element, a plain object, a WebSocket wrapper, or a scene object. A node can own children even when it is not a view.

```ts
const session = {};
attach(appNode, session);
onDestroy(session, () => {
  socket.close();
});
```

The app node owns the session. Destroying the session closes the socket. No DOM element is required.

The logical parent can differ from the DOM parent. A modal can be attached to a page and appended to document.body. It will still be destroyed with the page.

## Attach, detach, and destroy

attach(parent, child) adds a logical relationship. If the child already belongs to another parent, attach moves it. The old attach scope ends and the new parent's attach hooks run.

detach(child) removes the relationship but leaves the child alive. Its listeners, direct subscriptions, and descendants stay active. Work created in its onAttach scope ends.

destroy(node) ends the node and its logical descendants. The renderer removes each view, then children and registered cleanup hooks are processed. Calling destroy() with no node is harmless, which is useful for optional values.

```ts
const dialog = Dialog(owner);
document.body.append(dialog);

destroy(dialog);
```

Use destroy when a view or resource is finished. Use detach when it may be attached again later.

## Attach scopes

Some work should exist only while a component is attached to a particular parent. Register it in onAttach:

```ts
onAttach((scope) => {
  const placement = useStore(node, PlacementStore);
  placement.changed.subscribe(scope, updateButtons);
});
```

The hook runs after attachment, including immediately when it is registered on an already attached node. It receives a scope owner that ends at the next detach or move. A function returned from the hook is also called when that scope ends.

This is useful for a component whose behavior depends on its current owner. The component can move from a page into a dock and resolve a different placement store after the move.

Direct listeners and subscriptions on the component root are not attach-scoped. They remain while the component is detached. Put only location-dependent work in onAttach.

## Own each resource where it should end

Choose an owner with the same intended lifetime as the resource.

```ts
const timer = setInterval(refresh, 1000);
onDestroy(() => {
  clearInterval(timer);
});
```

The owner-less onDestroy form uses the current setup owner. Outside setup, pass the owner explicitly:

```ts
onDestroy(node, () => {
  clearInterval(timer);
});
```

listen(owner, target, type, handler) removes a DOM event listener when its owner is destroyed. A subscription can also take an explicit owner. These patterns cover most cleanup needs.

For a group that should end independently, create a plain object and attach it under the larger component:

```ts
const requestGroup = {};
attach(pageNode, requestGroup);
results.subscribe(requestGroup, renderResults);

function finishRequest() {
  destroy(requestGroup);
}
```

Destroying the group releases its subscription but leaves the page alive.

## Move a live component

Moving a mounted component changes two independent relationships. First move its ownership, then move its DOM view:

```ts
attach(dockNode, conversation.node);
dockElement.append(conversation.node);
```

The component itself is not recreated. Its local variables, DOM state, and direct subscriptions remain. onAttach runs for the new parent, so location-dependent work can be refreshed.

When you move a child away, the old parent no longer owns it. Destroying the old parent does not destroy the moved child.

## Lifecycle hooks

- onDestroy runs once when its owner is destroyed. It returns an unregister function.
- onAttach runs on every attachment and immediately if the node is already attached. Each attachment has a scope that ends on detach.
- getParent returns the logical parent. isAttached reports whether a node currently has one. A root is not attached just because it has children.

Avoid attaching a node beneath its own descendant. The ownership structure does not check for cycles. See the [Core reference](reference-core.md) for operation behavior and exact signatures.

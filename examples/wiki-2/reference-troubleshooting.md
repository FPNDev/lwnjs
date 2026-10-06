# Troubleshooting

Use the error text to find the relevant API, then check the owner, route, or render step that produced it.

## `no owner here` from `listen`, `useStore`, `router.route`, or lifecycle APIs

Owner-less calls need an active synchronous setup frame. A frame is opened by `component(...)`, outlet page factories, route actions, and `onAttach` hooks. In a component, attach its root before making calls that need the implicit owner.

```ts
const Panel = component((parent: object) => {
  const node = html`<section></section>`;
  attach(parent, node);

  listen(window, 'resize', onResize);
  onDestroy(() => saveDraft());

  return node;
});
```

Frames do not continue through an `await`, event handler, timer, or subscription callback. Pass the owner explicitly to the API in those callbacks. If an async operation needs its owner, capture `getOwner()` during setup, before starting the operation.

## `useStore: no ancestor provides this store`

Check these points:

1. Call `attachStore(parent, Store)` on the intended provider.
2. Attach the consumer to its logical parent before resolving the store.
3. Use the same store identifier at the provider and consumer.
4. If the component can move between parents, look up the store in `onAttach` so it resolves against the current parent.

Store lookup follows logical parents. DOM placement does not determine which provider is visible.

## An outlet throws `Outlet: no renderer set`

Call `setRenderer(domRenderer)` once during app startup, before the first `createOutlet(...).show(...)`. For server rendering, set the renderer in the shared app module so the server and browser use the same renderer contract.

## `html: expected exactly one root node`

`html` returns one root node and throws for zero or multiple roots. Put the elements under one wrapper or use `mhtml` when several top-level nodes are intended.

## `useServer` errors during setup

`useServer` only works during synchronous page setup, a component created by that page, or a route action.

- If the message says to call it during setup, move the read before the first `await` or event callback, then pass the value onward.
- If the message says there is no server data for a token, add a `load` function to the matching server route and call `set(token, value)` there.
- Make sure the token key is the same on the loader and consumer, and that its value can be serialized as JSON.

## `Template has no element with id "app"`

The server looks for an element whose ID matches `containerId`. The default is `app`. Add a container such as `<div id="app"></div>` to `index.html`, or pass the matching `containerId` to `createServer`.

## `Render did not settle within ...ms`

The renderer waits for route navigation and tracked outlet work. Look for a page loader or route action that never resolves, a lazy import that rejects or stalls, or outlet work that was not returned or settled. Increase the server timeout only when the page has legitimate long-running work. A longer timeout cannot fix a promise that never settles.

## The expected page does not show for a route

- Confirm the router and listener use the exact same route object. A new object with the same path is a different route identity.
- Route arrays are tried in order. Move a broad catch-all route after more specific routes.
- A nested child path is joined to its parent's path. For example, an `account` child under `/` matches `/account`; an `orders` child under `/account` matches `/account/orders`.
- An empty child path is the index route for its parent.
- String paths match the pathname. Query strings do not participate in route matching.
- A regular expression must match the complete path to be a final match. Named capture groups appear under `getParams()?.groups`.

Call `router.match(pathname)` to inspect matching without navigating. Guards still run during this check.

## A route action does not update a view

A route action runs when its route is active and also runs immediately if registered while the route is already active. If it changes a view through an outlet, return the promise from `outlet.show(...)` when the navigation should wait for the change.

For page data, confirm the server routes use the shared route objects and that data is read during setup. Client navigations after hydration use the `loadServerData(routes)` hook to fetch page data.

## Hydration creates duplicate or incorrect nodes

The client adopts server nodes by matching view creation order inside render scopes. Keep the app's setup shape the same on the server and client:

- Use the same shared app function and route definitions.
- Create the same static views in the same setup order.
- Let outlet pages load through outlets on both sides.
- Wait for `hydrate` to resolve before treating lazy pages as ready.

A server-rendered interpolation is not applied again during hydration. Update the node explicitly for any client-only change after setup.

## `build: no route matches ...`

A path returned by a server route's `paths()` must match the shared router's route definitions. Check for a missing leading slash, a path parameter that does not match, or a guard that rejects the path during the build.

Only routes configured as `ssg` or `isr` with a `paths` function are prerendered during the build. Other matching URLs can render on their first server request.

## Cleanup behaves differently than expected

`detach(node)` removes the node from its parent but keeps the node and destroy-scoped resources alive. `destroy(node)` ends the node and its logical descendants. If a resource should end every time a movable component is detached, create it in `onAttach` or its returned cleanup rather than in one-time component setup.

See [Lifetimes and ownership](learn-03-lifetimes.md), [Core reference](reference-core.md), and [Server reference](reference-server.md) for the full behavior.

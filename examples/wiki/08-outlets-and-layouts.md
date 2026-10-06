# 8. Outlets and layouts

An **outlet** is a slot that shows one view at a time. Route actions call `outlet.show(...)`; the outlet builds the view, mounts it, and destroys the previous one.

## Creating an outlet

```ts
import { createOutlet } from 'engine-ts/router';

const slot = html<Comment>`<!---->`;
const node = html`<div class="app"><header>…</header><main>${slot}</main></div>`;
attach(parent, node);

const page = createOutlet(node, slot);
```

- **Owner** (`node`): shown views become its logical children and receive it as `parent`. Destroying the owner destroys the shown view and cancels pending loads.
- **Placeholder** (`slot`, optional): views are inserted **before** it, and it stays mounted, which keeps the position stable. An empty comment is the usual choice. Without a placeholder, views are appended to the owner.

The owner and the placeholder's DOM parent can differ: pages are logical children of `node` while mounted inside `<main>`.

## Showing views

```ts
page.show(Home);                                // a factory: (parent) => view
page.show(() => import('./pages/Product'));     // a loader: its default export or the module itself
page.clear();                                   // destroy the current view
```

`show` returns a promise of the shown view, or `undefined` if a newer `show`/`clear` superseded it.

A **factory** is any function `(parent: object) => object`. The outlet runs it in its own setup frame (and render scope), so pages need no `component()` wrapper, and owner-less calls in them belong to the page.

A **loader** is a function returning a promise: `() => import('./Page')` resolves to the module and the outlet uses its `default` export. Pages are only loaded when first shown.

### Latest wins

If a lazy page resolves after a newer `show` (the user clicked on), it is dropped. A fast click sequence never ends on a stale page.

### No empty frame

When switching, the new view is inserted before the old one, and then the old one is destroyed. The position is kept and nothing flashes empty.

## Keeping a page across param changes

Showing **the same factory again** keeps the current view. With loaders, "same" means the same resolved default export. So going from `/products/a` to `/products/b` doesn't re-create the product page. The page follows the route itself:

```ts
export default function Product(parent: object) {
  const title = html`<h1></h1>`;
  const price = html`<p></p>`;
  const node = html`<article>${title}${price}</article>`;
  attach(parent, node);

  router.route(ProductRoute, () => {
    const product = find(router.getParams()?.groups?.handle);
    title.textContent = product.title;
    price.textContent = product.price;
  });

  return node;
}
```

- The route action runs right away during setup (the route is active) and again on every navigation within the route.
- Only text and attributes change; nodes, listeners and scroll position stay.
- To start fresh on a param change instead, give each param its own factory, or `clear()` first.

## Layouts

A layout is a page that owns **its own outlet** for its children. App shows the layout for a whole subtree with one action, and the layout decides what fills its slot:

```ts
// routes
export const OverviewRoute: Route = { path: '' };
export const OrdersRoute: Route = { path: 'orders' };
export const AccountRoute: Route = { path: '/account', children: [OverviewRoute, OrdersRoute] };

// app.ts
router.route(AccountRoute, () => page.show(() => import('./account/AccountLayout')));

// account/AccountLayout.ts
export default function AccountLayout(parent: object) {
  const slot = html<Comment>`<!---->`;
  const node = html`
    <div class="account">
      <nav><a href="/account">Overview</a><a href="/account/orders">Orders</a></nav>
      <section>${slot}</section>
    </div>
  `;
  attach(parent, node);

  const inner = createOutlet(node, slot);
  router.route(OverviewRoute, () => inner.show(Overview));
  router.route(OrdersRoute, () => inner.show(() => import('./Orders')));

  return node;
}
```

What happens:
- **`/` → `/account`**: App's action shows the layout. During the layout's setup, its listener for `OverviewRoute` runs right away (the index route is active) and shows the overview.
- **`/account` → `/account/orders`**: App's action runs again with the same loader, so the layout stays. The layout's `OrdersRoute` action swaps only the inner page.
- **`/account/orders` → `/`**: App shows the home page and destroys the layout, its outlet, its inner page and all its route listeners.

Layouts nest as deep as your routes do. Each level owns the outlet for the level below.

### Layout data

With server rendering, the layout's server route loads the layout's data (the user) and the inner route loads its own (the orders), and both run in parallel. See [Server rendering](11-server-rendering.md).

## Several outlets

One owner can hold several outlets: a main area and a side panel, each with its own placeholder and its own routes or triggers. They are independent.

## Outlets without routes

Outlets are just slots, so drive them from anything: tabs, a wizard's steps, a details panel.

```ts
const panel = createOutlet(node, slot);
listen(tabA, 'click', () => panel.show(TabA));
listen(tabB, 'click', () => panel.show(() => import('./TabB')));
```

## Pending work and server rendering

Every `show` is tracked as pending work until the view is mounted, including lazy imports. The server waits for all of it before serializing a page, and `hydrate` waits for it before releasing hydration data. Lazy pages render on the server like eager ones.

Inside a render scope, each outlet gets a stable key, so lazy pages hydrate correctly even when their imports resolve in a different order on the client.

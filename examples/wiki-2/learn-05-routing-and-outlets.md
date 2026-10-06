# 05. Routing and outlets

The router matches the current URL against route objects. An outlet shows the view for the active page. Keeping those jobs separate lets a route decide what to show without coupling URL matching to DOM placement.

## Define route objects once

~~~ts
import { setupRouter, type Route } from 'lwnjs/router';

export const HomeRoute: Route = { path: '/' };
export const ProductRoute: Route = {
  path: /\/products\/(?<handle>[\w-]+)/u,
};
export const routes = [HomeRoute, ProductRoute];
export const router = setupRouter(routes);
~~~

A route object is an identity. The router and components should import the same object rather than create lookalike route objects in separate modules.

String paths can be nested. A child path of orders under /account matches /account/orders. A child path with an empty string is an index route for the parent path. Regular expressions are useful for named parameters such as handle.

## Create an outlet

An outlet owns the current page view and replaces it when another view is shown.

~~~ts
import { attach, component, domRenderer, setRenderer } from 'lwnjs/core';
import { createOutlet, setupRouter, type Route } from 'lwnjs/router';
import { html } from 'lwnjs/html';

setRenderer(domRenderer);

const App = component((parent: object) => {
  const slot = html<Comment>`<!---->`;
  const node = html`<main>${slot}</main>`;
  attach(parent, node);

  const page = createOutlet(node, slot);
  router.route(HomeRoute, () => page.show(Home));
  router.route(ProductRoute, () => page.show(() => import('./pages/Product')));

  return node;
});
~~~

The component is attached under the app node logically, while the outlet mounts its view at the comment in the main element. The placeholder stays in place as the page changes.

## Load pages only when needed

A page factory receives its parent and returns a view:

~~~ts
export default function Product(parent: object) {
  const node = html`<article><h1>Product</h1></article>`;
  attach(parent, node);
  return node;
}
~~~

A dynamic import is a loader. The outlet accepts the module's default export automatically:

~~~ts
page.show(() => import('./pages/Product'));
~~~

The first visit loads the module. Later visits can reuse it from the browser module cache.

## Route actions

Register an action for the route that should affect the outlet:

~~~ts
router.route(ProductRoute, () => {
  const handle = router.getParams()?.groups?.handle;
  return page.show(() => import('./pages/Product'));
});
~~~

The action runs when its route is in the active route chain. It also runs immediately if registered while that route is already active. Actions run in their owner's setup frame. Return the promise from page.show when navigation should wait for that view to finish.

router.go('/products/tea') navigates and resolves after matching, loading, route actions, and promises returned by those actions settle. router.ready is the initial navigation promise.

## Keep a page when only parameters change

Calling show with the same factory again keeps the current view. A lazy page is considered the same when the loader resolves to the same default factory. This is useful for a product page that should keep its scroll position while its item changes.

The page can listen to its route and update its own nodes:

~~~ts
router.route(ProductRoute, () => {
  const handle = router.getParams()?.groups?.handle ?? '';
  const product = products.find((item) => item.handle === handle);
  title.textContent = product?.title ?? 'Product not found';
});
~~~

The page does not need to be rebuilt when only the route parameters change. Its route action updates the title and any other node that depends on the selected product.

## Nested layouts

A layout is a page with its own outlet. The app shows it for a parent route. The layout then listens to child routes and chooses the content for its inner outlet. An index route supplies the page for the exact parent path.

This lets navigation from /account to /account/orders keep the account header and replace only the inner view. The [Router reference](reference-router.md) covers matching order, guards, aliases, and history.

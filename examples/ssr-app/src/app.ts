import {
  attach,
  attachStore,
  component,
  domRenderer,
  setRenderer,
} from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { createOutlet } from 'lwn-js/router';
import { CartStore } from './cart';
import { Header } from './components/Header';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';
import {
  AccountRoute,
  CollectionRoute,
  HomeRoute,
  NotFoundRoute,
  ProductRoute,
  SearchRoute,
  router,
  routes,
} from './routes';
import classes from './styles/ui.module.scss';

export { router, routes };

setRenderer(domRenderer);

/**
 * Rendered on the server and hydrated in the browser: the same function on
 * both sides, building views synchronously. Lazy pages go through the outlet.
 */
export const App = component((container: Element) => {
  const frame = html`<div class=${classes.frame}></div>`;
  attach(container, frame);
  attachStore(frame, CartStore);

  const slot = html<Comment>`<!---->`;
  frame.append(
    Header(frame),
    html`<main class=${classes.main}>${slot}</main>`,
    html`<footer class=${classes.footer}>
      Data from mock.shop and dummyjson · built with LWN
    </footer>`,
  );
  container.append(frame);

  const page = createOutlet(frame, slot);
  router.route(frame, HomeRoute, () => page.show(Home));
  router.route(frame, CollectionRoute, () =>
    page.show(() => import('./pages/Collection')),
  );
  router.route(frame, ProductRoute, () =>
    page.show(() => import('./pages/Product')),
  );
  router.route(frame, SearchRoute, () =>
    page.show(() => import('./pages/Search')),
  );
  // One action for the whole /account/* subtree: the layout handles its own children.
  router.route(frame, AccountRoute, () =>
    page.show(() => import('./account/AccountLayout')),
  );
  router.route(frame, NotFoundRoute, () => page.show(NotFound));
});

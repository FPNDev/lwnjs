import {
  attachStore,
  component,
  domRenderer,
  setRenderer,
  withFrame,
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

/** Builds the same eager shell for server rendering and hydration. */
export const App = component(() => {
  attachStore(CartStore);

  const slot = html<Comment>`<!---->`;
  const header = Header();
  const main = html`<main class=${classes.main}>${slot}</main>`;
  const footer = html`<footer class=${classes.footer}>
    Data from mock.shop and dummyjson - built with LWN
  </footer>`;
  const page = createOutlet(slot);
  router.route(HomeRoute, () => page.show(Home));
  router.route(CollectionRoute, () =>
    page.show(() => import('./pages/Collection')),
  );
  router.route(ProductRoute, () => page.show(() => import('./pages/Product')));
  router.route(SearchRoute, () => page.show(() => import('./pages/Search')));
  router.route(AccountRoute, () => page.show(() => import('./layout/Account')));
  router.route(NotFoundRoute, () => page.show(NotFound));

  return {
    node: html`<div class=${classes.frame}>${header}${main}${footer}</div>`,
  };
});

export function runApp(container: Element) {
  // Keep the root frame under the request container so server cleanup destroys it.
  container.append(withFrame(container, () => App()).node);
}

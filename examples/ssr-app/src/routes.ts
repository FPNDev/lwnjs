import { listen } from 'lwnjs/core';
import { setupRouter, type Route } from 'lwnjs/router';
import { loadServerData } from 'lwnjs/ssr';

export const HomeRoute: Route = { path: '/' };
export const CollectionRoute: Route = { path: /\/collections\/(?<handle>[\w-]+)/u };
export const ProductRoute: Route = { path: /\/products\/(?<handle>[\w-]+)/u };
export const SearchRoute: Route = { path: '/search' };
/** Index route: `/account` itself, rendered inside the account layout. */
export const OverviewRoute: Route = { path: '' };
export const OrdersRoute: Route = { path: 'orders' };
export const AccountRoute: Route = { path: '/account', children: [OverviewRoute, OrdersRoute] };
export const NotFoundRoute: Route = { path: /.*/u };

export const routes = [HomeRoute, CollectionRoute, ProductRoute, SearchRoute, AccountRoute, NotFoundRoute];

// Same router on both sides: memory history on the server (no `window`), browser history in the client.
// `loadServerData` fetches `__data.json` for routes with server data on client navigation.
export const router = setupRouter(routes, { load: loadServerData(routes) });

export const handleParam = () => router.getParams()?.groups?.handle ?? '';

/** Makes an anchor navigate through the router. */
export function routerLink(anchor: HTMLAnchorElement) {
  listen(anchor, 'click', (event) => {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      void router.go(anchor.getAttribute('href')!);
    }
  });
}

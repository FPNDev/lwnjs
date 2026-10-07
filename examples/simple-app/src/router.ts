import { listen } from 'lwn-js/core';
import { setupRouter, type Route } from 'lwn-js/router';

export const HomeRoute: Route = { path: '/' };
export const ListRoute: Route = { path: /\/lists\/(?<id>[\w-]+)/u };
/** Fallback route, kept last in the route list. */
export const FallbackRoute: Route = { path: /.*/u };

export const router = setupRouter([HomeRoute, ListRoute, FallbackRoute]);

export const listUrl = (id: string) => `/lists/${id}`;

/** Returns the list id from the current URL, if present. */
export const currentListId = () => router.getParams()?.groups?.id;

/** Routes anchor clicks through the client router. */
export function routerLink(anchor: HTMLAnchorElement) {
  listen(anchor, 'click', (event) => {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      void router.go(anchor.getAttribute('href')!);
    }
  });
}

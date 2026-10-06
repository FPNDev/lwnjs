import { listen } from 'lwn-js/core';
import { setupRouter, type Route } from 'lwn-js/router';

export const HomeRoute: Route = { path: '/' };
export const ListRoute: Route = { path: /\/lists\/(?<id>[\w-]+)/u };
/** Matches anything else; must stay last. */
export const FallbackRoute: Route = { path: /.*/u };

export const router = setupRouter([HomeRoute, ListRoute, FallbackRoute]);

export const listUrl = (id: string) => `/lists/${id}`;

/** The list id of the current URL, if any. */
export const currentListId = () => router.getParams()?.groups?.id;

/**
 * Makes an anchor navigate through the router instead of reloading the page.
 * Call it during setup; the listener belongs to the current owner.
 * @param anchor Anchor to wire.
 */
export function routerLink(anchor: HTMLAnchorElement) {
  listen(anchor, 'click', (event) => {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      void router.go(anchor.getAttribute('href')!);
    }
  });
}

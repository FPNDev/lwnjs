import { listen } from 'lwnjs/core';
import { setupRouter, type Route } from 'lwnjs/router';

export const HomeRoute: Route = { path: '/' };
export const ChatRoute: Route = { path: /\/chat\/(?<peer>[\w-]+)/u };
/** Matches anything else; must stay last. */
export const FallbackRoute: Route = { path: /.*/u };

export const router = setupRouter([HomeRoute, ChatRoute, FallbackRoute]);

export const chatUrl = (peerId: string) => `/chat/${peerId}`;

/** The peer id of the current URL, if any. */
export const currentPeerId = () => router.getParams()?.groups?.peer;

/** Makes an anchor navigate through the router instead of reloading the page. */
export function routerLink(anchor: HTMLAnchorElement) {
  listen(anchor, 'click', (event) => {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      void router.go(anchor.getAttribute('href')!);
    }
  });
}

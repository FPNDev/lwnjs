import { listen } from 'lwn-js/core';
import { setupRouter, type Route } from 'lwn-js/router';

export const HomeRoute: Route = { path: '/' };
export const ChatRoute: Route = { path: /\/chat\/(?<peer>[\w-]+)/u };
/** Fallback route, kept last in the route list. */
export const FallbackRoute: Route = { path: /.*/u };

export const router = setupRouter([HomeRoute, ChatRoute, FallbackRoute]);

export const chatUrl = (peerId: string) => `/chat/${peerId}`;

/** Returns the peer ID from the current URL, if present. */
export const currentPeerId = () => router.getParams()?.groups?.peer;

/** Routes anchor clicks through the client router. */
export function routerLink(anchor: HTMLAnchorElement) {
  listen(anchor, 'click', (event) => {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      void router.go(anchor.getAttribute('href')!);
    }
  });

  return anchor;
}

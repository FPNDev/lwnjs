import { currentScope } from '../core/scope.ts';

/** Names a piece of page data loaded on the server. `T` is the value's type. */
export type ServerToken<T> = {
  readonly key: string;
  /** Type carrier only; never set. */
  readonly type?: T;
};

let data: Record<string, unknown> = {};

/**
 * Creates a server data token.
 * @param key Unique key; it is the property name in the serialized page data.
 * @returns The token.
 */
export function serverToken<T>(key: string): ServerToken<T> {
  return { key };
}

/**
 * Reads page data loaded on the server: during the server render, from the
 * hydration payload on the client, and from the page's `__data.json` after
 * client navigation. O(1).
 *
 * Only during setup: synchronously in a page factory, a component it creates,
 * or a route action. The data is released once the page has settled, so read
 * it once and pass values down to anything created later.
 * @param token Data token.
 * @returns The value.
 * @throws Outside setup, or when the current page has no value for the token.
 */
export function useServer<T>(token: ServerToken<T>): T {
  if (!currentScope()) {
    throw new Error(
      `useServer("${token.key}"): call it during setup (a page factory, a component it creates, or a route action), not after an await or in an event handler. Read it once and pass the value down.`,
    );
  }
  if (!Object.hasOwn(data, token.key)) {
    throw new Error(
      `useServer: no server data for "${token.key}". Load it in the page's server route.`,
    );
  }

  return data[token.key] as T;
}

/**
 * Replaces the current page data.
 * @param next Page data.
 */
export function setServerData(next: Record<string, unknown>) {
  data = next;
}

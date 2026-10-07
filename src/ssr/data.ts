import { hydrationContext } from '../core/hydration.ts';

/** Identifies typed data loaded for a server-rendered page. */
export type ServerToken<T> = {
  readonly key: string;
  /** Carries the value type. */
  readonly type?: T;
};

let data: Record<string, unknown> = {};

/** Creates a token for a uniquely named page-data value. */
export function serverToken<T>(key: string): ServerToken<T> {
  return { key };
}

/** Reads the current page's server data during synchronous setup. */
export function useServer<T>(token: ServerToken<T>): T {
  if (!hydrationContext()) {
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

/** Sets the data available to the current page. */
export function setServerData(next: Record<string, unknown>) {
  data = next;
}

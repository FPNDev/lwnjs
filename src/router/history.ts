/** Reads and updates the router URL. */
export type History = {
  location(): URL;
  push(url: string): void;
  /** Subscribes to external URL changes and returns an unsubscribe function. */
  listen(onChange: () => void): () => void;
};

/** Tells whether two URLs address the same route: pathname and search match, the hash is ignored. */
export const sameRoute = (a: URL, b: URL) =>
  a.pathname === b.pathname && a.search === b.search;

/** Creates a history adapter for the browser URL. */
export function browserHistory(): History {
  return {
    location: () => new URL(window.location.href),
    push(url) {
      window.history.pushState(null, '', url);
    },
    listen(onChange) {
      window.addEventListener('popstate', onChange);

      return () => {
        window.removeEventListener('popstate', onChange);
      };
    },
  };
}

/** Creates an in-memory history adapter. */
export function memoryHistory(initialUrl: string | URL = '/'): History {
  let current = new URL(initialUrl, 'http://localhost');

  return {
    location: () => current,
    push(url) {
      current = new URL(url, current);
    },
    listen: () => () => {},
  };
}

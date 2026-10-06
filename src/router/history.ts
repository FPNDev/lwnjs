/** Where the router reads and writes the current URL. */
export type History = {
  location(): URL;
  push(url: string): void;
  /** Subscribes to changes made outside the router (back/forward). Returns an unsubscribe function. */
  listen(onChange: () => void): () => void;
};

/**
 * History backed by `window.location` and `window.history`.
 * @returns The history adapter.
 */
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

/**
 * In-memory history for tests and server rendering.
 * @param initialUrl Starting URL, absolute or relative to `http://localhost`.
 * @returns The history adapter.
 */
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

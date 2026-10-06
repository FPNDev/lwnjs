import type { RouteMatch } from '../router/match.ts';
import type { Router } from '../router/router.ts';
import type { Route, RouteParams } from '../router/types.ts';
import type { ServerToken } from '../ssr/data.ts';
import { routeIds } from '../ssr/payload.ts';
import { type CacheEntry, fsCache, memoryCache, type PageCache } from './cache.ts';
import { renderPage } from './render.ts';

export type LoadContext = {
  url: URL;
  params: RouteParams;
  /** The incoming request; absent during `build`. */
  request?: Request;
};

/** Stores a value for `useServer(token)`. Values must be JSON-serializable. */
export type SetServerData = <T>(token: ServerToken<T>, value: T) => void;

/** Server-only settings for a route. Keep these out of the client bundle. */
export type ServerRoute = {
  route: Route;
  /**
   * `ssr` renders on every request (default). `ssg` renders once (at build or
   * first request) and never expires. `isr` is `ssg` that re-renders in the
   * background once older than `revalidate` seconds.
   */
  mode?: 'ssr' | 'ssg' | 'isr';
  /** Seconds before an `isr` page is stale. Without it, `isr` behaves like `ssg`. */
  revalidate?: number;
  /** Response status, e.g. 404 for a not-found route. */
  status?: number;
  /** Paths to prerender in `build` (`ssg`/`isr`). */
  paths?: () => Promise<readonly string[]> | readonly string[];
  /** Loads page data before render. Loaders of all routes in the matched chain run in parallel. */
  load?: (context: LoadContext, set: SetServerData) => Promise<void> | void;
  /**
   * Source modules of the route's lazy pages, as keys of the Vite client
   * manifest (e.g. `src/pages/Product.ts`). Rendered pages get
   * `<link rel="modulepreload">` for them and their imports, so hydration
   * does not wait for the import. Needs `manifest`.
   */
  preload?: readonly string[];
};

/** The parts of Vite's client `manifest.json` used for preloading. */
export type ViteManifest = Record<string, { file: string; imports?: string[] }>;

export type ServerOptions = {
  /** The built `index.html`. Must contain the container element. */
  template: string;
  /** The app's router; server renders navigate it with memory history. */
  router: Router;
  /** The app's route tree (the one passed to `setupRouter`). */
  routes: readonly Route[];
  serverRoutes?: readonly ServerRoute[];
  /** Renders the app into the container, synchronously; lazy pages go through outlets. */
  app: (container: Element) => void;
  /** Id of the container element. Default `app`. */
  containerId?: string;
  /** Cache for `ssg`/`isr` pages. Default `memoryCache()`. */
  cache?: PageCache;
  /** Milliseconds a render may take to settle. Default 10000. */
  timeout?: number;
  /** Vite client manifest (`build.manifest: true`), for route `preload`. */
  manifest?: ViteManifest;
  /** Public base path of the client assets. Default `/`. */
  base?: string;
};

type PageResult = {
  entry: CacheEntry;
  cacheStatus: 'BYPASS' | 'HIT' | 'STALE' | 'MISS';
};

const DATA_FILE = '__data.json';

/** Cache key for a pathname: no trailing slash, except for the root. */
function pageKey(pathname: string) {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

/**
 * Creates the SSR / SSG / ISR server for an app.
 * @param options Server options.
 * @returns `handle` for requests, `build` for prerendering, `revalidate` for on-demand refresh.
 */
export function createServer(options: ServerOptions) {
  const serverRoutes = options.serverRoutes ?? [];
  const cache = options.cache ?? memoryCache();
  const configs = new Map(serverRoutes.map((config) => [config.route, config]));
  const ids = routeIds(options.routes);
  const dataRoutes: number[] = [];
  for (const config of serverRoutes) {
    if (config.load && ids.includes(config.route)) {
      dataRoutes.push(ids.indexOf(config.route));
    }
  }
  const renderOptions = {
    template: options.template,
    containerId: options.containerId ?? 'app',
    router: options.router,
    app: options.app,
    timeout: options.timeout ?? 10_000,
  };
  const regenerating = new Map<string, Promise<CacheEntry>>();

  const configsFor = (chain: readonly Route[]) => {
    const found: ServerRoute[] = [];
    for (const route of chain) {
      const config = configs.get(route) ?? (route.aliasOf && configs.get(route.aliasOf));
      if (config) {
        found.push(config);
      }
    }

    return found;
  };

  const loadData = async (match: RouteMatch, url: URL, request?: Request) => {
    const data: Record<string, unknown> = {};
    const set: SetServerData = (token, value) => {
      data[token.key] = value;
    };
    const loads: Promise<void>[] = [];
    for (const config of configsFor(match.chain)) {
      if (config.load) {
        loads.push(Promise.resolve(config.load({ url, params: match.params, request }, set)));
      }
    }
    await Promise.all(loads);

    return data;
  };

  /** Chunk URLs of the matched routes' `preload` modules and everything they import. */
  const preloadsFor = (chain: readonly Route[]) => {
    const { manifest } = options;
    if (!manifest) {
      return [];
    }
    const files = new Set<string>();
    const visit = (key: string) => {
      const entry = manifest[key];
      if (!entry || files.has(entry.file)) {
        return;
      }
      files.add(entry.file);
      for (const imported of entry.imports ?? []) {
        visit(imported);
      }
    };
    for (const config of configsFor(chain)) {
      for (const key of config.preload ?? []) {
        visit(key);
      }
    }
    const base = options.base ?? '/';

    return [...files].map((file) => base + file);
  };

  const generate = async (url: URL, match: RouteMatch, request?: Request): Promise<CacheEntry> => {
    const data = await loadData(match, url, request);
    const html = await renderPage(url, data, dataRoutes, preloadsFor(match.chain), renderOptions);

    return {
      html,
      data: JSON.stringify(data),
      status: configsFor(match.chain).at(-1)?.status ?? 200,
      createdAt: Date.now(),
    };
  };

  /** Renders and caches a page; concurrent calls for one path share a render. */
  const regenerate = (key: string, url: URL, match: RouteMatch) => {
    let running = regenerating.get(key);
    if (!running) {
      running = generate(url, match).then(async (entry) => {
        await cache.set(key, entry);

        return entry;
      });
      regenerating.set(key, running);
      void running.finally(() => regenerating.delete(key)).catch(() => {});
    }

    return running;
  };

  const page = async (url: URL, request?: Request): Promise<PageResult | undefined> => {
    const match = await options.router.match(url.pathname);
    if (!match) {
      return undefined;
    }
    const config = configsFor(match.chain).at(-1);
    const mode = config?.mode ?? 'ssr';
    if (mode === 'ssr') {
      return { entry: await generate(url, match, request), cacheStatus: 'BYPASS' };
    }

    const key = pageKey(url.pathname);
    const cached = await cache.get(key);
    if (!cached) {
      return { entry: await regenerate(key, url, match), cacheStatus: 'MISS' };
    }

    const isStale =
      mode === 'isr' &&
      config?.revalidate !== undefined &&
      Date.now() - cached.createdAt > config.revalidate * 1000;
    if (isStale) {
      regenerate(key, url, match).catch((error: unknown) => {
        console.error(error);
      });
    }

    return { entry: cached, cacheStatus: isStale ? 'STALE' : 'HIT' };
  };

  /** Page data only: SSR pages skip the render, cached pages serve the data they were rendered with. */
  const pageData = async (url: URL, request: Request): Promise<PageResult | undefined> => {
    const match = await options.router.match(url.pathname);
    if (!match) {
      return undefined;
    }
    if ((configsFor(match.chain).at(-1)?.mode ?? 'ssr') !== 'ssr') {
      return page(url, request);
    }
    const data = await loadData(match, url, request);

    return {
      entry: { html: '', data: JSON.stringify(data), status: 200, createdAt: Date.now() },
      cacheStatus: 'BYPASS',
    };
  };

  return {
    /**
     * Handles a page (`/path`) or page data (`/path/__data.json`) request.
     * @returns The response, or `undefined` for non-GET/HEAD requests and unmatched paths.
     */
    async handle(request: Request): Promise<Response | undefined> {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return undefined;
      }

      const url = new URL(request.url);
      const isData = url.pathname.endsWith(`/${DATA_FILE}`);
      let result: PageResult | undefined;
      try {
        result = isData
          ? await pageData(new URL(pageKey(url.pathname.slice(0, -DATA_FILE.length)), url), request)
          : await page(url, request);
      } catch (error) {
        console.error(error);

        return new Response('Internal Server Error', { status: 500 });
      }
      if (!result) {
        return undefined;
      }

      const { entry, cacheStatus } = result;

      return new Response(request.method === 'HEAD' ? null : isData ? entry.data : entry.html, {
        status: isData ? 200 : entry.status,
        headers: {
          'content-type': isData ? 'application/json' : 'text/html; charset=utf-8',
          'x-engine-cache': cacheStatus,
        },
      });
    },

    /**
     * Prerenders every `paths()` entry of `ssg`/`isr` routes into `outDir` in
     * static-hosting layout. Read the template before building into the same
     * folder: the root page overwrites `index.html`.
     * @returns The rendered paths.
     */
    async build({ outDir }: { outDir: string }) {
      const target = fsCache(outDir);
      const rendered: string[] = [];
      for (const config of serverRoutes) {
        if ((config.mode !== 'ssg' && config.mode !== 'isr') || !config.paths) {
          continue;
        }
        for (const path of await config.paths()) {
          const url = new URL(path, 'http://localhost');
          const match = await options.router.match(url.pathname);
          if (!match) {
            throw new Error(`build: no route matches ${path}`);
          }
          await target.set(pageKey(url.pathname), await generate(url, match));
          rendered.push(path);
        }
      }

      return rendered;
    },

    /**
     * Re-renders a cached page now; the old version is served until it is ready.
     * @param path Page pathname.
     */
    async revalidate(path: string) {
      const url = new URL(path, 'http://localhost');
      const match = await options.router.match(url.pathname);
      if (match) {
        await regenerate(pageKey(url.pathname), url, match);
      }
    },
  };
}

import type { RouteMatch } from '../router/match.ts';
import type { Router } from '../router/router.ts';
import type { Route, RouteParams } from '../router/types.ts';
import type { ServerToken } from '../ssr/data.ts';
import { routeIds } from '../ssr/payload.ts';
import {
  type CacheEntry,
  fsCache,
  memoryCache,
  type PageCache,
} from './cache.ts';
import { renderPage } from './render.ts';

export type LoadContext = {
  url: URL;
  params: RouteParams;
  /** The incoming request, or undefined during a build. */
  request?: Request;
};

/** Stores JSON-serializable page data for useServer(). */
export type SetServerData = <T>(token: ServerToken<T>, value: T) => void;

/** Server rendering and data settings for a route. */
export type ServerRoute = {
  route: Route;
  /** Selects request rendering, static generation, or timed revalidation. */
  mode?: 'ssr' | 'ssg' | 'isr';
  /** Seconds before an ISR page becomes stale. */
  revalidate?: number;
  /** HTTP status for the rendered page. */
  status?: number;
  /** Paths to prerender for static and incremental modes. */
  paths?: () => Promise<readonly string[]> | readonly string[];
  /** Loads page data before rendering; matched route loaders run in parallel. */
  load?: (context: LoadContext, set: SetServerData) => Promise<void> | void;
  /** Vite manifest keys for lazy pages to preload before hydration. */
  preload?: readonly string[];
};

/** Vite client manifest entries used for preloading. */
export type ViteManifest = Record<string, { file: string; imports?: string[] }>;

export type ServerOptions = {
  /** Built HTML template containing the app container. */
  template: string;
  /** Router used to match and render requests. */
  router: Router;
  /** Route tree passed to setupRouter(). */
  routes: readonly Route[];
  serverRoutes?: readonly ServerRoute[];
  /** Builds the app synchronously inside the render container. */
  app: (container: Element) => void;
  /** Container element id. Defaults to app. */
  containerId?: string;
  /** Cache for static and incremental pages. Defaults to memoryCache(). */
  cache?: PageCache;
  /** Render timeout in milliseconds. Defaults to 10000. */
  timeout?: number;
  /** Vite client manifest used by route preloads. */
  manifest?: ViteManifest;
  /** Public base path for client assets. Defaults to /. */
  base?: string;
};

type PageResult = {
  entry: CacheEntry;
  cacheStatus: 'BYPASS' | 'HIT' | 'STALE' | 'MISS';
};

const DATA_FILE = '__data.json';

/** Normalizes a pathname for use as a cache key. */
function pageKey(pathname: string) {
  return pathname.length > 1 && pathname.endsWith('/')
    ? pathname.slice(0, -1)
    : pathname;
}

/** Creates request, build, and revalidation handlers for an app. */
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
      const config =
        configs.get(route) ?? (route.aliasOf && configs.get(route.aliasOf));
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
        loads.push(
          Promise.resolve(
            config.load({ url, params: match.params, request }, set),
          ),
        );
      }
    }
    await Promise.all(loads);

    return data;
  };

  /** Collects URLs for lazy modules used by the matched routes. */
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

  const generate = async (
    url: URL,
    match: RouteMatch,
    request?: Request,
  ): Promise<CacheEntry> => {
    const data = await loadData(match, url, request);
    const html = await renderPage(
      url,
      data,
      dataRoutes,
      preloadsFor(match.chain),
      renderOptions,
    );

    return {
      html,
      data: JSON.stringify(data),
      status: configsFor(match.chain).at(-1)?.status ?? 200,
      createdAt: Date.now(),
    };
  };

  /** Shares one regeneration job per pathname. */
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

  const page = async (
    url: URL,
    request?: Request,
  ): Promise<PageResult | undefined> => {
    const match = await options.router.match(url.pathname);
    if (!match) {
      return undefined;
    }
    const config = configsFor(match.chain).at(-1);
    const mode = config?.mode ?? 'ssr';
    if (mode === 'ssr') {
      return {
        entry: await generate(url, match, request),
        cacheStatus: 'BYPASS',
      };
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

  /** Returns page data without HTML for client navigation. */
  const pageData = async (
    url: URL,
    request: Request,
  ): Promise<PageResult | undefined> => {
    const match = await options.router.match(url.pathname);
    if (!match) {
      return undefined;
    }
    if ((configsFor(match.chain).at(-1)?.mode ?? 'ssr') !== 'ssr') {
      return page(url, request);
    }
    const data = await loadData(match, url, request);

    return {
      entry: {
        html: '',
        data: JSON.stringify(data),
        status: 200,
        createdAt: Date.now(),
      },
      cacheStatus: 'BYPASS',
    };
  };

  return {
    /** Handles GET and HEAD page or page-data requests. */
    async handle(request: Request): Promise<Response | undefined> {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return undefined;
      }

      const url = new URL(request.url);
      const isData = url.pathname.endsWith(`/${DATA_FILE}`);
      let result: PageResult | undefined;
      try {
        result = isData
          ? await pageData(
              new URL(pageKey(url.pathname.slice(0, -DATA_FILE.length)), url),
              request,
            )
          : await page(url, request);
      } catch (error) {
        console.error(error);

        return new Response('Internal Server Error', { status: 500 });
      }
      if (!result) {
        return undefined;
      }

      const { entry, cacheStatus } = result;

      return new Response(
        request.method === 'HEAD' ? null : isData ? entry.data : entry.html,
        {
          status: isData ? 200 : entry.status,
          headers: {
            'content-type': isData
              ? 'application/json'
              : 'text/html; charset=utf-8',
            'x-engine-cache': cacheStatus,
          },
        },
      );
    },

    /** Prerenders configured static and incremental paths into `outDir`. */
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

    /** Refreshes a cached page immediately. */
    async revalidate(path: string) {
      const url = new URL(path, 'http://localhost');
      const match = await options.router.match(url.pathname);
      if (match) {
        await regenerate(pageKey(url.pathname), url, match);
      }
    },
  };
}

import type { PageCache } from './cache.ts';
import {
  createServer,
  type ServerOptions,
  type ViteManifest,
} from './server.ts';

/** Everything about a server-rendered app except what the build provides. */
export type ServerAppConfig = Omit<
  ServerOptions,
  'template' | 'manifest' | 'base' | 'cache'
>;

export type ServerApp = {
  /** Creates the server once the template (and, in production, the manifest and cache) are known. */
  create(options: {
    template: string;
    manifest?: ViteManifest;
    base?: string;
    cache?: PageCache;
  }): ReturnType<typeof createServer>;
};

/**
 * Describes the app for the `lwn` CLI. Make it the default export of the
 * server entry (`src/entry-server.ts`). The server is created inside the
 * app's own bundle, so it shares the engine instance the app's components use.
 * @param config Router, routes, server routes and the app function.
 * @returns The app description.
 */
export function defineServerApp(config: ServerAppConfig): ServerApp {
  return {
    create: (options) => createServer({ ...config, ...options }),
  };
}

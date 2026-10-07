import type { PageCache } from './cache.ts';
import {
  createServer,
  type ServerOptions,
  type ViteManifest,
} from './server.ts';

/** App settings supplied before build-specific values are available. */
export type ServerAppConfig = Omit<
  ServerOptions,
  'template' | 'manifest' | 'base' | 'cache'
>;

export type ServerApp = {
  /** Creates the server after its template and build metadata are ready. */
  create(options: {
    template: string;
    manifest?: ViteManifest;
    base?: string;
    cache?: PageCache;
  }): ReturnType<typeof createServer>;
};

/** Describes an app to the LWN server CLI. */
export function defineServerApp(config: ServerAppConfig): ServerApp {
  return {
    create: (options) => createServer({ ...config, ...options }),
  };
}

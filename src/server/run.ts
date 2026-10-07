import { readFile, writeFile } from 'node:fs/promises';
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ServerApp } from './app.ts';
import { fsCache } from './cache.ts';
import { toNodeHandler } from './node.ts';
import type { ViteManifest } from './server.ts';

export type RunOptions = {
  /** Project directory. Defaults to the working directory. */
  root?: string;
  /** Server entry path relative to the project directory. */
  entry?: string;
  /** Build output directory relative to the project directory. */
  outDir?: string;
  /** Port to listen on. Defaults to PORT or 3000. */
  port?: number;
  /** Host interface to listen on. */
  host?: string;
  /** Secret required by the revalidation endpoint. Defaults to REVALIDATE_SECRET. */
  revalidateSecret?: string;
};

type Middleware = (incoming: IncomingMessage, outgoing: ServerResponse) => void;

function resolve(options: RunOptions) {
  const root = options.root ?? process.cwd();
  const entry = options.entry ?? 'src/entry-server.ts';
  const outDir = join(root, options.outDir ?? 'dist');

  return {
    root,
    entry,
    client: join(outDir, 'client'),
    server: join(outDir, 'server'),
    /** Vite names the server bundle after the entry file. */
    serverEntry: join(
      outDir,
      'server',
      entry.replace(/^.*[\\/]/u, '').replace(/\.[cm]?[jt]s$/u, '.js'),
    ),
    port: options.port ?? Number(process.env.PORT ?? 3000),
    host: options.host,
    revalidateSecret: options.revalidateSecret ?? process.env.REVALIDATE_SECRET,
  };
}

function listen(
  port: number,
  host: string | undefined,
  middleware: Middleware,
) {
  createHttpServer(middleware).listen(port, host, () => {
    console.log(`http://${host ?? 'localhost'}:${port}`);
  });
}

const importApp = async (file: string) =>
  ((await import(pathToFileURL(file).href)) as { default: ServerApp }).default;

const readManifest = async (client: string) =>
  JSON.parse(
    await readFile(join(client, '.vite/manifest.json'), 'utf8'),
  ) as ViteManifest;

/** Runs Vite middleware with server rendering from source. */
export async function dev(options: RunOptions = {}) {
  const paths = resolve(options);
  const vite = await import('vite');
  const devServer = await vite.createServer({
    root: paths.root,
    server: { host: paths.host, middlewareMode: true },
    appType: 'custom',
  });

  let handler: ReturnType<typeof toNodeHandler> | undefined;
  devServer.watcher.on('change', () => {
    handler = undefined;
  });
  const load = async () => {
    const template = await devServer.transformIndexHtml(
      '/',
      await readFile(join(paths.root, 'index.html'), 'utf8'),
    );
    const app = (
      (await devServer.ssrLoadModule(`/${paths.entry}`)) as {
        default: ServerApp;
      }
    ).default;

    return toNodeHandler(app.create({ template }), {
      revalidateSecret: paths.revalidateSecret,
    });
  };

  listen(paths.port, paths.host, (incoming, outgoing) => {
    devServer.middlewares(incoming, outgoing, () => {
      void (async () => {
        try {
          handler ??= await load();
          await handler(incoming, outgoing);
        } catch (error) {
          devServer.ssrFixStacktrace(error as Error);
          console.error(error);
          outgoing.statusCode = 500;
          outgoing.end(String(error));
        }
      })();
    });
  });
}

/** Builds client and server bundles, then prerenders configured paths. */
export async function build(options: RunOptions = {}) {
  const paths = resolve(options);

  const vite = await import('vite');
  await vite.build({
    root: paths.root,
    build: { outDir: paths.client, manifest: true, emptyOutDir: true },
  });
  await vite.build({
    root: paths.root,
    build: { ssr: paths.entry, outDir: paths.server, emptyOutDir: true },
  });

  // Keep the template because prerendering the root path replaces index.html.
  const template = await readFile(join(paths.client, 'index.html'), 'utf8');
  await writeFile(join(paths.server, 'template.html'), template);

  const app = await importApp(paths.serverEntry);
  const pages = await app
    .create({ template, manifest: await readManifest(paths.client) })
    .build({ outDir: paths.client });

  console.log(
    `prerendered ${pages.length} page${pages.length === 1 ? '' : 's'}`,
  );
}

/** Serves the production build and handles page data and revalidation. */
export async function start(options: RunOptions = {}) {
  const paths = resolve(options);
  const app = await importApp(paths.serverEntry);
  const server = app.create({
    template: await readFile(join(paths.server, 'template.html'), 'utf8'),
    manifest: await readManifest(paths.client),
    cache: fsCache(paths.client),
  });

  listen(
    paths.port,
    paths.host,
    toNodeHandler(server, {
      staticDir: paths.client,
      revalidateSecret: paths.revalidateSecret,
    }),
  );
}

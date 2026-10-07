import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';

type Handler = {
  handle(request: Request): Promise<Response | undefined>;
  revalidate?(path: string): Promise<void>;
};

export type NodeHandlerOptions = {
  /** Directory for static files; asset paths receive immutable caching. */
  staticDir?: string;
  /** Enables the revalidation endpoint when a secret is provided. */
  revalidateSecret?: string;
};

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

async function serveFile(dir: string, path: string, outgoing: ServerResponse) {
  const root = join(dir, sep);
  const file = join(dir, normalize(decodeURIComponent(path)));
  if (
    !file.startsWith(root) ||
    !(await stat(file).catch(() => null))?.isFile()
  ) {
    return false;
  }
  outgoing.setHeader(
    'content-type',
    CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
  );
  if (path.startsWith('/assets/')) {
    outgoing.setHeader('cache-control', 'public, max-age=31536000, immutable');
  }
  createReadStream(file).pipe(outgoing);

  return true;
}

async function respond(response: Response, outgoing: ServerResponse) {
  outgoing.statusCode = response.status;
  for (const [name, value] of response.headers) {
    outgoing.setHeader(name, value);
  }
  outgoing.end(
    response.body ? Buffer.from(await response.arrayBuffer()) : undefined,
  );
}

/** Adapts a server to Node HTTP middleware with optional static files and revalidation. */
export function toNodeHandler(
  server: Handler,
  options: NodeHandlerOptions = {},
) {
  return async (
    incoming: IncomingMessage,
    outgoing: ServerResponse,
    next?: (error?: unknown) => void,
  ) => {
    try {
      const url = new URL(
        incoming.url ?? '/',
        `http://${incoming.headers.host ?? 'localhost'}`,
      );

      if (
        options.revalidateSecret &&
        incoming.method === 'POST' &&
        url.pathname === '/api/revalidate'
      ) {
        if (url.searchParams.get('secret') !== options.revalidateSecret) {
          outgoing.statusCode = 401;
          outgoing.end();

          return;
        }
        const path = url.searchParams.get('path') ?? '/';
        await server.revalidate?.(path);
        await respond(Response.json({ revalidated: path }), outgoing);

        return;
      }

      const isAsset =
        extname(url.pathname) !== '' && !url.pathname.endsWith('/__data.json');
      if (
        isAsset &&
        options.staticDir &&
        (await serveFile(options.staticDir, url.pathname, outgoing))
      ) {
        return;
      }

      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (value !== undefined) {
          headers.set(name, Array.isArray(value) ? value.join(', ') : value);
        }
      }
      const response = await server.handle(
        new Request(url, { method: incoming.method, headers }),
      );
      if (response) {
        await respond(response, outgoing);
      } else if (next) {
        next();
      } else {
        outgoing.statusCode = 404;
        outgoing.end();
      }
    } catch (error) {
      if (next) {
        next(error);
      } else {
        outgoing.statusCode = 500;
        outgoing.end();
      }
    }
  };
}

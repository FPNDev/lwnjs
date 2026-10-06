import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';

/** A rendered page. */
export type CacheEntry = {
  html: string;
  /** Page data as JSON, served as `__data.json`. */
  data: string;
  status: number;
  /** `Date.now()` when rendered. */
  createdAt: number;
};

/** Stores rendered pages by pathname for SSG and ISR. */
export type PageCache = {
  get(path: string): Promise<CacheEntry | undefined>;
  set(path: string, entry: CacheEntry): Promise<void>;
  delete(path: string): Promise<void>;
};

/**
 * In-memory cache that evicts the least recently used page beyond `maxEntries`. All operations O(1).
 * @param maxEntries Maximum number of pages kept.
 * @returns The cache.
 */
export function memoryCache(maxEntries = 1000): PageCache {
  const entries = new Map<string, CacheEntry>();

  return {
    get(path) {
      const entry = entries.get(path);
      if (entry) {
        // Re-insert so Map order tracks recency.
        entries.delete(path);
        entries.set(path, entry);
      }

      return Promise.resolve(entry);
    },
    set(path, entry) {
      entries.delete(path);
      entries.set(path, entry);
      if (entries.size > maxEntries) {
        entries.delete(entries.keys().next().value!);
      }

      return Promise.resolve();
    },
    delete(path) {
      entries.delete(path);

      return Promise.resolve();
    },
  };
}

/**
 * File cache in static-hosting layout: `<dir>/<path>/index.html` and
 * `<dir>/<path>/__data.json`. SSG output uses it, so any static server can
 * serve a build, and ISR can pick it up at runtime. Entries read back with
 * status 200 and the file time as `createdAt`.
 * @param dir Output directory.
 * @returns The cache.
 */
export function fsCache(dir: string): PageCache {
  const root = resolve(dir);
  const folder = (path: string) => {
    const target = resolve(join(root, path));
    if (target !== root && !target.startsWith(root + sep)) {
      throw new Error(`fsCache: path escapes the cache directory: ${path}`);
    }

    return target;
  };

  return {
    async get(path) {
      const target = folder(path);
      try {
        const [html, data, info] = await Promise.all([
          readFile(join(target, 'index.html'), 'utf8'),
          readFile(join(target, '__data.json'), 'utf8'),
          stat(join(target, 'index.html')),
        ]);

        return { html, data, status: 200, createdAt: info.mtimeMs };
      } catch {
        // Not cached yet.
      }
    },
    async set(path, entry) {
      const target = folder(path);
      await mkdir(target, { recursive: true });
      await Promise.all([
        writeFile(join(target, 'index.html'), entry.html),
        writeFile(join(target, '__data.json'), entry.data),
      ]);
    },
    async delete(path) {
      const target = folder(path);
      await Promise.all([
        rm(join(target, 'index.html'), { force: true }),
        rm(join(target, '__data.json'), { force: true }),
      ]);
    },
  };
}

import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';

/** Cached HTML and page data. */
export type CacheEntry = {
  html: string;
  /** Serialized page data. */
  data: string;
  status: number;
  /** Render timestamp in milliseconds. */
  createdAt: number;
};

/** Stores rendered pages by pathname. */
export type PageCache = {
  get(path: string): Promise<CacheEntry | undefined>;
  set(path: string, entry: CacheEntry): Promise<void>;
  delete(path: string): Promise<void>;
};

/** Creates an LRU cache with a maximum entry count. */
export function memoryCache(maxEntries = 1000): PageCache {
  const entries = new Map<string, CacheEntry>();

  return {
    get(path) {
      const entry = entries.get(path);
      if (entry) {
        // Map order tracks least to most recently used entries.
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

/** Creates a file cache compatible with static hosting and ISR. */
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
        // Missing files indicate a cache miss.
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

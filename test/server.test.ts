// @vitest-environment node
import { createServer as createHttpServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toNodeHandler } from '../src/server/index.ts';
import { get, settle, setupApp } from './fixtures/blog.ts';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('server render', () => {
  it('renders the page with lazy outlets, escaped data and a safe payload', async () => {
    const { server } = setupApp();
    const response = (await get(server, '/posts/1'))!;
    const page = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('x-engine-cache')).toBe('BYPASS');
    expect(page).toContain('<header>Blog</header>');
    expect(page).toContain('<h1>Post 1</h1>');
    expect(page).toContain('&lt;script&gt;alert("1")&lt;/script&gt;&lt;/script&gt;');
    expect(page.match(/<\/script>/gu)).toHaveLength(1);
    expect(page).toContain('id="__engine"');
  });

  it('preloads the route modules and their imports from the Vite manifest', async () => {
    const { server } = setupApp(
      { preload: ['src/pages/Post.ts'] },
      {
        base: '/static/',
        manifest: {
          'src/pages/Post.ts': { file: 'assets/Post-1.js', imports: ['_shared.js'] },
          '_shared.js': { file: 'assets/shared-2.js' },
        },
      },
    );
    const page = await (await get(server, '/posts/1'))!.text();

    const preloads = [...page.matchAll(/<link[^>]*rel="modulepreload"[^>]*>/gu)].map(([tag]) => /href="([^"]+)"/u.exec(tag)![1]);
    expect(preloads).toEqual(['/static/assets/Post-1.js', '/static/assets/shared-2.js']);
  });

  it('uses the route status', async () => {
    const { server } = setupApp();
    expect((await get(server, '/nope'))!.status).toBe(404);
  });

  it('ignores non-GET requests', async () => {
    const { server } = setupApp();
    expect(await server.handle(new Request('http://localhost/', { method: 'POST' }))).toBeUndefined();
  });

  it('keeps concurrent renders apart', async () => {
    const { server } = setupApp();
    const pages = await Promise.all(['/posts/a', '/posts/b', '/', '/posts/c'].map(async (path) => (await get(server, path))!.text()));

    expect(pages[0]).toContain('Post a');
    expect(pages[1]).toContain('Post b');
    expect(pages[2]).toContain('<main>home</main>');
    expect(pages[3]).toContain('Post c');
  });

  it('serves page data as JSON without rendering SSR pages', async () => {
    const { server } = setupApp();
    const response = (await get(server, '/posts/7/__data.json'))!;

    expect(response.headers.get('content-type')).toBe('application/json');
    expect(await response.json()).toEqual({ post: { title: 'Post 7', body: '<script>alert("7")</script></script>' } });
  });
});

describe('ISR / SSG', () => {
  it('caches, serves stale while regenerating, then serves fresh', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { server, loads } = setupApp({ mode: 'isr', revalidate: 60 });

    expect((await get(server, '/posts/1'))!.headers.get('x-engine-cache')).toBe('MISS');
    expect((await get(server, '/posts/1/'))!.headers.get('x-engine-cache')).toBe('HIT');
    expect(loads).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + 61_000);
    expect((await get(server, '/posts/1'))!.headers.get('x-engine-cache')).toBe('STALE');
    await settle();
    expect(loads).toHaveBeenCalledTimes(2);
    expect((await get(server, '/posts/1'))!.headers.get('x-engine-cache')).toBe('HIT');
  });

  it('dedupes concurrent misses into one render', async () => {
    const { server, loads } = setupApp({ mode: 'ssg' });
    await Promise.all([get(server, '/posts/1'), get(server, '/posts/1'), get(server, '/posts/1')]);
    expect(loads).toHaveBeenCalledTimes(1);
  });

  it('revalidate re-renders on demand', async () => {
    const { server, loads } = setupApp({ mode: 'ssg' });
    await get(server, '/posts/1');
    await server.revalidate('/posts/1');
    expect(loads).toHaveBeenCalledTimes(2);
  });

  it('build writes pages and data in static-hosting layout', async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'engine-ssg-'));
    try {
      const { server } = setupApp({ mode: 'ssg', paths: () => ['/posts/1', '/posts/2'] });
      expect(await server.build({ outDir })).toEqual(['/posts/1', '/posts/2']);

      expect(await readFile(join(outDir, 'posts/2/index.html'), 'utf8')).toContain('<h1>Post 2</h1>');
      expect(JSON.parse(await readFile(join(outDir, 'posts/2/__data.json'), 'utf8'))).toEqual({
        post: { title: 'Post 2', body: '<script>alert("2")</script></script>' },
      });
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});

describe('node adapter', () => {
  it('serves static assets and the revalidate endpoint', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'engine-static-'));
    try {
      await mkdir(join(dir, 'assets'));
      await writeFile(join(dir, 'assets/app-1.js'), 'export {};');
      const { server, loads } = setupApp({ mode: 'ssg' });
      const handler = toNodeHandler(server, { staticDir: dir, revalidateSecret: 's3cret' });
      const http = createHttpServer((request, response) => {
        void handler(request, response);
      });
      await new Promise<void>((resolve) => {
        http.listen(0, resolve);
      });
      const { port } = http.address() as { port: number };
      const base = `http://localhost:${port}`;

      try {
        const asset = await fetch(`${base}/assets/app-1.js`);
        expect(asset.headers.get('cache-control')).toContain('immutable');
        expect(await asset.text()).toBe('export {};');
        expect((await fetch(`${base}/assets/missing.js`)).status).toBe(404);
        expect((await fetch(`${base}/../package.json`)).status).toBe(404);

        expect((await fetch(`${base}/api/revalidate?path=/posts/1&secret=nope`, { method: 'POST' })).status).toBe(401);
        expect(await (await fetch(`${base}/api/revalidate?path=/posts/1&secret=s3cret`, { method: 'POST' })).json()).toEqual({
          revalidated: '/posts/1',
        });
        expect(loads).toHaveBeenCalledTimes(1);
      } finally {
        http.close();
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('serves handled requests and passes the rest on', async () => {
    const { server } = setupApp();
    const handler = toNodeHandler(server);
    const http = createHttpServer((request, response) => {
      void handler(request, response, () => {
        response.statusCode = 418;
        response.end();
      });
    });
    await new Promise<void>((resolve) => {
      http.listen(0, resolve);
    });
    const { port } = http.address() as { port: number };

    try {
      const page = await fetch(`http://localhost:${port}/posts/9`);
      expect(page.status).toBe(200);
      expect(await page.text()).toContain('Post 9');
      expect((await fetch(`http://localhost:${port}/`, { method: 'DELETE' })).status).toBe(418);
    } finally {
      http.close();
    }
  });
});

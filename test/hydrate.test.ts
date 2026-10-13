import { afterEach, describe, expect, it, vi } from 'vitest';
import { component, withFrame } from '../src/core/index.ts';
import { element } from '../src/html/index.ts';
import {
  createOutlet,
  memoryHistory,
  setupRouter,
  type Route,
} from '../src/router/index.ts';
import { createServer } from '../src/server/index.ts';
import { hydrate, useServer } from '../src/ssr/index.ts';
import { PostData, TEMPLATE, get, settle, setupApp } from './fixtures/blog.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('hydration', () => {
  function showPage(page: string) {
    const parsed = new DOMParser().parseFromString(page, 'text/html');
    document.body.replaceWith(document.importNode(parsed.body, true));

    return document.querySelector('#app')!;
  }

  async function loadPage(path: string) {
    const { server, ...app } = setupApp();
    const page = await (await get(server, path))!.text();

    return { ...app, container: showPage(page) };
  }

  it('adopts the server nodes instead of creating new ones', async () => {
    const { container, App, router } = await loadPage('/posts/1');
    const serverHeader = container.querySelector('header');
    const serverArticle = container.querySelector('article');

    await hydrate(container, App, router);

    // Resolves after the lazy page hydrated, and the payload script is gone.
    expect(container.querySelector('article')).toBe(serverArticle);
    expect(document.querySelector('#__engine')).toBeNull();
    expect(container.querySelectorAll('article')).toHaveLength(1);
    expect(container.querySelectorAll('header')).toHaveLength(1);
    expect(container.querySelector('header')).toBe(serverHeader);
    expect(container.querySelector('article')).toBe(serverArticle);
    // App code moved the claimed header before the lazy page claimed its nodes (regression).
    expect([...container.children].map((child) => child.tagName)).toEqual([
      'HEADER',
      'ARTICLE',
    ]);
    // The empty text node left as a comment by the server is a text node again.
    expect(serverArticle!.childNodes[1].nodeType).toBe(3);
  });

  it('fetches page data on client navigation and renders fresh views', async () => {
    const { container, App, router } = await loadPage('/posts/1');
    await hydrate(container, App, router);
    await settle();

    const fetchData = vi.fn(() =>
      Promise.resolve(
        Response.json({ post: { title: 'Post 2', body: 'second' } }),
      ),
    );
    vi.stubGlobal('fetch', fetchData);
    await router.go('/posts/2');
    await settle();

    expect(fetchData).toHaveBeenCalledWith('/posts/2/__data.json');
    expect(container.querySelector('h1')!.textContent).toBe('Post 2');
    expect(container.querySelectorAll('article')).toHaveLength(1);
  });

  it('allows useServer only during setup and releases the data once hydrated', async () => {
    const { container, App, router } = await loadPage('/posts/1');
    await hydrate(container, App, router);

    expect(() => useServer(PostData)).toThrow(/during setup/u);
    const outlet = withFrame(container, () => createOutlet());
    expect(() =>
      outlet.show(
        component(() => {
          useServer(PostData);

          return { node: document.createElement('i') };
        }),
      ),
    ).toThrow(/no server data/u);
  });

  it('does not fetch for routes without server data', async () => {
    const { container, App, router } = await loadPage('/posts/1');
    await hydrate(container, App, router);
    const fetchData = vi.fn();
    vi.stubGlobal('fetch', fetchData);

    await router.go('/');
    await settle();
    expect(fetchData).not.toHaveBeenCalled();
    expect(container.querySelector('main')!.textContent).toBe('home');
  });
  it('refetches page data on reload', async () => {
    const { container, App, router } = await loadPage('/posts/1');
    await hydrate(container, App, router);
    await settle();

    const fetchData = vi.fn(() =>
      Promise.resolve(
        Response.json({ post: { title: 'Post 1 again', body: 'again' } }),
      ),
    );
    vi.stubGlobal('fetch', fetchData);
    await router.reload();
    await settle();

    expect(fetchData).toHaveBeenCalledWith('/posts/1/__data.json');
    expect(container.querySelector('h1')!.textContent).toBe('Post 1 again');
  });

  it('adopts views created directly in different route actions', async () => {
    const Home: Route = { path: '/' };
    const routes = [Home];
    const router = setupRouter(routes, { history: memoryHistory('/') });
    function App(container: Element) {
      withFrame(container, () => {
        router.route(Home, () => {
          const view = element('p');
          view.textContent = 'first';
          container.append(view);
        });
        router.route(Home, () => {
          const view = element('p');
          view.textContent = 'second';
          container.append(view);
        });
      });
    }
    const server = createServer({ template: TEMPLATE, router, routes, app: App });
    const container = showPage(await (await get(server, '/'))!.text());
    const [first, second] = container.querySelectorAll('p');

    await hydrate(container, App, router);

    const views = container.querySelectorAll('p');
    expect(views).toHaveLength(2);
    expect(views[0]).toBe(first);
    expect(views[1]).toBe(second);
    expect(container.textContent).toBe('firstsecond');
  });
});

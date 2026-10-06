import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOutlet } from '../src/router/index.ts';
import { hydrate, useServer } from '../src/ssr/index.ts';
import { PostData, get, settle, setupApp } from './fixtures/blog.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('hydration', () => {
  async function loadPage(path: string) {
    const { server, ...app } = setupApp();
    const page = await (await get(server, path))!.text();
    const parsed = new DOMParser().parseFromString(page, 'text/html');
    document.body.replaceWith(document.importNode(parsed.body, true));

    return { ...app, container: document.querySelector('#app')! };
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
    expect([...container.children].map((child) => child.tagName)).toEqual(['HEADER', 'ARTICLE']);
    // The empty text node left as a comment by the server is a text node again.
    expect(serverArticle!.childNodes[1].nodeType).toBe(3);
  });

  it('fetches page data on client navigation and renders fresh views', async () => {
    const { container, App, router } = await loadPage('/posts/1');
    await hydrate(container, App, router);
    await settle();

    const fetchData = vi.fn(() =>
      Promise.resolve(Response.json({ post: { title: 'Post 2', body: 'second' } })),
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
    const outlet = createOutlet(document.createElement('div'));
    await expect(
      outlet.show(() => {
        useServer(PostData);

        return document.createElement('i');
      }),
    ).rejects.toThrow(/no server data/u);
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
});

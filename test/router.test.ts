import { beforeEach, describe, expect, it, vi } from 'vitest';
import { domRenderer, setRenderer, withFrame } from '../src/core/index.ts';
import {
  createOutlet,
  lazy,
  memoryHistory,
  setupRouter,
  type Route,
} from '../src/router/index.ts';
import { flush, view } from './helpers.ts';

beforeEach(() => {
  setRenderer(domRenderer);
});

describe('router', () => {
  it('fires listeners of parent routes for nested matches (B29)', async () => {
    const profile: Route = { path: 'profile' };
    const settings: Route = { path: '/settings', children: [profile] };
    const router = setupRouter([settings], {
      history: memoryHistory('/settings/profile'),
    });

    const frame = {};
    const layout = vi.fn();
    const page = vi.fn();
    router.route(frame, settings, layout);
    router.route(frame, profile, page);
    await flush();

    expect(layout).toHaveBeenCalledTimes(1);
    expect(page).toHaveBeenCalledTimes(1);
  });

  it('does not throw on unmatched paths (B25)', async () => {
    const home: Route = { path: '/' };
    const router = setupRouter([home], { history: memoryHistory('/') });
    await expect(router.go('/nowhere')).resolves.toBeUndefined();
    expect(router.getPath()).toBe('/nowhere');
  });

  it('keeps guards on array paths and fires child listeners (B23)', async () => {
    const child: Route = { path: 'child' };
    const guarded: Route = {
      path: ['/a', '/b'],
      guardChildren: () => false,
      children: [child],
    };
    const open: Route = { path: ['/c', '/d'], children: [child] };
    const router = setupRouter([guarded, open], {
      history: memoryHistory('/'),
    });

    const action = vi.fn();
    router.route({}, child, action);

    await router.go('/b/child');
    expect(action).not.toHaveBeenCalled();
    await router.go('/d/child');
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('matches one route object placed under two parents (B24)', async () => {
    const shared: Route = { path: 'edit' };
    const router = setupRouter(
      [
        { path: '/posts', children: [shared] },
        { path: '/users', children: [shared] },
      ],
      { history: memoryHistory('/') },
    );
    const action = vi.fn();
    router.route({}, shared, action);

    await router.go('/posts/edit');
    await router.go('/users/edit');
    expect(action).toHaveBeenCalledTimes(2);

    const sharedByArray = setupRouter(
      [{ path: ['/posts', '/users'], children: [shared] }],
      { history: memoryHistory('/') },
    );
    const arrayAction = vi.fn();
    sharedByArray.route({}, shared, arrayAction);

    await sharedByArray.go('/posts/edit');
    await sharedByArray.go('/users/edit');
    expect(arrayAction).toHaveBeenCalledTimes(2);
  });

  it('fires a listener once at an array path alternative (B30)', async () => {
    const page: Route = { path: ['/page', '/alias'] };
    const router = setupRouter([page], {
      history: memoryHistory('/alias'),
    });
    await flush();

    const action = vi.fn();
    router.route({}, [page], action);
    expect(action).toHaveBeenCalledTimes(1);
  });
});

function testHistory(initialUrl: string) {
  let current = new URL(initialUrl, 'http://localhost');
  let onChange = () => {};
  const push = vi.fn((url: string) => {
    current = new URL(url, current);
  });
  const history = {
    location: () => current,
    push,
    listen: (listener: () => void) => {
      onChange = listener;

      return () => {};
    },
  };
  const pop = (url: string) => {
    current = new URL(url, current);
    onChange();
  };

  return { history, push, pop };
}

describe('navigation work', () => {
  it('waits for async route actions and lazy views started by the navigation', async () => {
    const asyncPage: Route = { path: '/async' };
    const lazyPage: Route = { path: '/lazy' };
    const router = setupRouter([{ path: '/' }, asyncPage, lazyPage], {
      history: memoryHistory('/'),
    });
    const container = document.createElement('div');
    const outlet = withFrame(container, () => createOutlet());
    let done = false;
    router.route(container, asyncPage, async () => {
      await flush();
      done = true;
    });
    router.route(container, lazyPage, () => {
      void outlet.show(lazy(() => flush().then(() => view('lazy'))));
    });

    await router.go('/async');
    expect(done).toBe(true);
    await router.go('/lazy');
    expect(container.textContent).toBe('lazy');
  });

  it('rejects go() and reload() when a route action or lazy view fails', async () => {
    const asyncPage: Route = { path: '/async' };
    const syncPage: Route = { path: '/sync' };
    const lazyPage: Route = { path: '/lazy' };
    const router = setupRouter(
      [{ path: '/' }, asyncPage, syncPage, lazyPage],
      { history: memoryHistory('/') },
    );
    const container = document.createElement('div');
    const outlet = withFrame(container, () => createOutlet());
    let shown: Promise<unknown> | undefined;
    router.route(container, asyncPage, () =>
      Promise.reject(new Error('async failed')),
    );
    router.route(container, syncPage, () => {
      throw new Error('sync failed');
    });
    router.route(container, lazyPage, () => {
      shown = outlet.show(lazy(() => Promise.reject(new Error('lazy failed'))));
    });

    await expect(router.go('/async')).rejects.toThrow('async failed');
    await expect(router.reload()).rejects.toThrow('async failed');
    await expect(router.go('/sync')).rejects.toThrow('sync failed');
    await expect(router.go('/lazy')).rejects.toThrow('lazy failed');
    expect(await shown).toBeUndefined();
  });

  it('reports failures of navigations without a caller', async () => {
    const failing: Route = { path: '/fail' };
    const { history, pop } = testHistory('/');
    const router = setupRouter([{ path: '/' }, failing], { history });
    router.route({}, failing, () => Promise.reject(new Error('popstate')));
    const deferred: (() => void)[] = [];
    const queueMicrotask = vi
      .spyOn(globalThis, 'queueMicrotask')
      .mockImplementation((task) => {
        deferred.push(task);
      });

    pop('/fail');
    await flush();
    queueMicrotask.mockRestore();
    expect(deferred).toHaveLength(1);
    expect(deferred[0]).toThrow('popstate');
  });
});

describe('same-URL navigation', () => {
  it('skips navigations to the current pathname and search', async () => {
    const page: Route = { path: '/page' };
    const { history, push, pop } = testHistory('/page?a=1');
    const load = vi.fn();
    const router = setupRouter([page], { history, load });
    await router.ready;
    expect(load).toHaveBeenCalledTimes(1);

    const action = vi.fn();
    const start = vi.fn();
    const end = vi.fn();
    router.route({}, page, action);
    router.on({}, 'start', start);
    router.on({}, 'end', end);
    action.mockClear();

    await expect(router.go('/page?a=1')).resolves.toBeUndefined();
    await router.go('/page?a=1#top');
    pop('/page?a=1#other');
    await flush();
    expect(push).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledTimes(1);
    expect(action).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
    expect(end).not.toHaveBeenCalled();

    await router.go('/page?a=2');
    expect(push).toHaveBeenCalledWith('/page?a=2');
    expect(load).toHaveBeenCalledTimes(2);
    expect(action).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('reload() re-runs the current URL without a history entry', async () => {
    const page: Route = { path: '/page' };
    const { history, push } = testHistory('/page');
    const load = vi.fn();
    const router = setupRouter([page], { history, load });
    await router.ready;
    const action = vi.fn();
    const start = vi.fn();
    const end = vi.fn();
    router.route({}, page, action);
    router.on({}, 'start', start);
    router.on({}, 'end', end);

    await expect(router.reload()).resolves.toBeUndefined();
    expect(push).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledTimes(2);
    expect(action).toHaveBeenCalledTimes(2);
    expect(start).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledTimes(1);
  });
});

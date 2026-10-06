import { beforeEach, describe, expect, it, vi } from 'vitest';
import { destroy, domRenderer, setRenderer } from '../src/core/index.ts';
import {
  aliasRoute,
  createOutlet,
  memoryHistory,
  setupRouter,
  type Route,
} from '../src/router/index.ts';

beforeEach(() => {
  setRenderer(domRenderer);
});

const flush = () =>
  new Promise((resolve) => {
    setTimeout(resolve);
  });

describe('router', () => {
  it('fires listeners of parent routes for nested matches (B29)', async () => {
    const profile: Route = { path: 'profile' };
    const settings: Route = { path: '/settings', children: [profile] };
    const router = setupRouter([settings], {
      history: memoryHistory('/settings/profile'),
    });

    const owner = {};
    const layout = vi.fn();
    const page = vi.fn();
    router.route(owner, settings, layout);
    router.route(owner, profile, page);
    await flush();

    expect(layout).toHaveBeenCalledTimes(1);
    expect(page).toHaveBeenCalledTimes(1);
  });

  it('matches index routes at the parent path, inside the parent chain', async () => {
    const overview: Route = { path: '' };
    const orders: Route = { path: 'orders' };
    const account: Route = { path: '/account', children: [overview, orders] };
    const router = setupRouter([account], { history: memoryHistory('/') });

    expect((await router.match('/account'))?.chain).toEqual([
      account,
      overview,
    ]);
    expect((await router.match('/account/'))?.chain).toEqual([
      account,
      overview,
    ]);
    expect((await router.match('/account/orders'))?.chain).toEqual([
      account,
      orders,
    ]);
  });

  it('does not throw on unmatched paths (B25)', async () => {
    const home: Route = { path: '/' };
    const router = setupRouter([home], { history: memoryHistory('/') });
    await expect(router.go('/nowhere')).resolves.toBeUndefined();
    expect(router.getPath()).toBe('/nowhere');
  });

  it('go resolves after route actions settle (B27)', async () => {
    const page: Route = { path: '/page' };
    const router = setupRouter([{ path: '/' }, page], {
      history: memoryHistory('/'),
    });
    let done = false;
    router.route({}, page, async () => {
      await flush();
      done = true;
    });

    await router.go('/page');
    expect(done).toBe(true);
  });

  it('keeps guards on aliases and fires original child listeners (B23)', async () => {
    const child: Route = { path: 'child' };
    const guarded: Route = {
      path: '/a',
      guardChildren: () => false,
      children: [child],
    };
    const alias = aliasRoute(guarded, '/b');
    const open: Route = { path: '/c', children: [child] };
    const openAlias = aliasRoute(open, '/d');
    const router = setupRouter([guarded, alias, open, openAlias], {
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
  });

  it('fires a listener once even if it lists a route and its alias (B30)', async () => {
    const page: Route = { path: '/page' };
    const alias = aliasRoute(page, '/alias');
    const router = setupRouter([page, alias], {
      history: memoryHistory('/alias'),
    });
    await flush();

    const action = vi.fn();
    router.routes({}, [page, alias], action);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('runs a listener registered during dispatch for the active route', async () => {
    const layout: Route = { path: '/app', children: [{ path: 'page' }] };
    const page = layout.children![0];
    const router = setupRouter([layout], { history: memoryHistory('/') });
    const pageAction = vi.fn();
    router.route({}, layout, () => {
      router.route({}, page, pageAction);
    });

    await router.go('/app/page');
    expect(pageAction).toHaveBeenCalledTimes(1);
  });

  it('exposes regexp params', async () => {
    const chat: Route = { path: /\/chat(?:\/(?<id>[^/]+))?/u };
    const router = setupRouter([chat], { history: memoryHistory('/chat/42') });
    await flush();
    expect(router.getParams()?.groups?.id).toBe('42');
  });

  it('stops listeners when their owner is destroyed', async () => {
    const page: Route = { path: '/page' };
    const router = setupRouter([{ path: '/' }, page], {
      history: memoryHistory('/'),
    });
    const owner = {};
    const action = vi.fn();
    router.route(owner, page, action);
    destroy(owner);

    await router.go('/page');
    expect(action).not.toHaveBeenCalled();
  });
});

describe('outlet', () => {
  const view = (text: string) => () => {
    const node = document.createElement('p');
    node.textContent = text;

    return node;
  };

  it('keeps two outlets under one owner independent (B18)', async () => {
    const owner = document.createElement('div');
    const first = document.createComment('');
    const second = document.createComment('');
    owner.append(first, second);

    await createOutlet(owner, first).show(view('a'));
    await createOutlet(owner, second).show(view('b'));
    expect(owner.textContent).toBe('ab');
  });

  it('ignores a slow lazy view superseded by a newer one (B19)', async () => {
    const owner = document.createElement('div');
    const outlet = createOutlet(owner);
    let resolveSlow: (factory: () => Node) => void = () => {};
    const slow = outlet.show(
      () =>
        new Promise((resolve) => {
          resolveSlow = resolve;
        }),
    );

    await outlet.show(view('fast'));
    resolveSlow(view('slow'));
    expect(await slow).toBeUndefined();
    expect(owner.textContent).toBe('fast');
  });

  it('accepts module loaders and keeps the view for the same factory', async () => {
    const owner = document.createElement('div');
    const outlet = createOutlet(owner);
    const factory = view('page');
    const loader = () => Promise.resolve({ default: factory });

    const shown = await outlet.show(loader);
    expect(await outlet.show(() => Promise.resolve({ default: factory }))).toBe(
      shown,
    );
    expect(owner.childNodes).toHaveLength(1);
  });

  it('replaces in place and keeps the placeholder mounted (B20)', async () => {
    const owner = document.createElement('div');
    const fragment = document.createDocumentFragment();
    const placeholder = document.createComment('');
    fragment.append(placeholder);
    const outlet = createOutlet(owner, placeholder);

    await outlet.show(view('a'));
    await outlet.show(view('b'));
    expect(fragment.textContent).toBe('b');

    outlet.clear();
    expect(fragment.childNodes).toHaveLength(1);
    expect(fragment.firstChild).toBe(placeholder);
  });

  it('passes the owner to the factory and attaches the view', async () => {
    const owner = document.createElement('div');
    const factory = vi.fn(() => document.createElement('p'));
    const shown = await createOutlet(owner).show(factory);

    expect(factory).toHaveBeenCalledWith(owner);
    destroy(owner);
    expect((shown as Node).isConnected).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { domRenderer, setRenderer } from '../src/core/index.ts';
import { memoryHistory, setupRouter, type Route } from '../src/router/index.ts';
import { flush } from './helpers.ts';

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

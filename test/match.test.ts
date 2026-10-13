import { beforeEach, describe, expect, it } from 'vitest';
import { domRenderer, setRenderer } from '../src/core/index.ts';
import { memoryHistory, setupRouter, type Route } from '../src/router/index.ts';
import { flush } from './helpers.ts';

beforeEach(() => {
  setRenderer(domRenderer);
});

describe('route matching', () => {
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

  it('exposes regexp params', async () => {
    const chat: Route = { path: /\/chat(?:\/(?<id>[^/]+))?/u };
    const router = setupRouter([chat], { history: memoryHistory('/chat/42') });
    await flush();
    expect(router.getParams()?.groups?.id).toBe('42');
  });
});

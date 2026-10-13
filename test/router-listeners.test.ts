import { beforeEach, describe, expect, it, vi } from 'vitest';
import { destroy, domRenderer, setRenderer } from '../src/core/index.ts';
import { memoryHistory, setupRouter, type Route } from '../src/router/index.ts';

beforeEach(() => {
  setRenderer(domRenderer);
});

describe('router listeners', () => {
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

  it('stops listeners when their frame is destroyed', async () => {
    const page: Route = { path: '/page' };
    const router = setupRouter([{ path: '/' }, page], {
      history: memoryHistory('/'),
    });
    const frame = {};
    const action = vi.fn();
    router.route(frame, page, action);
    destroy(frame);

    await router.go('/page');
    expect(action).not.toHaveBeenCalled();
  });
});

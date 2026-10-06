import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attach,
  attachStore,
  component,
  createEmitter,
  createStore,
  destroy,
  detach,
  domRenderer,
  getOwner,
  listen,
  onAttach,
  onDestroy,
  setRenderer,
  useStore,
} from '../src/core/index.ts';
import { createOutlet, memoryHistory, setupRouter, type Route } from '../src/router/index.ts';

beforeEach(() => {
  setRenderer(domRenderer);
});

const Theme = createStore(() => ({ color: 'red' }));

describe('implicit owner', () => {
  it('binds owner-less calls to the node a component attached first', () => {
    const ping = createEmitter();
    const button = document.createElement('button');
    const seen = vi.fn();
    const clicked = vi.fn();
    const destroyed = vi.fn();

    const Widget = component((parent: object) => {
      const node = {};
      attach(parent, node);
      ping.subscribe(seen);
      listen(button, 'click', clicked);
      onDestroy(destroyed);

      return node;
    });

    const widget = Widget({});
    ping.emit();
    button.click();
    destroy(widget);
    ping.emit();
    button.click();

    expect(seen).toHaveBeenCalledTimes(1);
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(destroyed).toHaveBeenCalledTimes(1);
  });

  it('keeps the parent as owner after a child component returns', () => {
    const owners: object[] = [];
    const Child = component((parent: object) => {
      const node = { name: 'child' };
      attach(parent, node);
      owners.push(getOwner()!);

      return node;
    });
    const Parent = component((parent: object) => {
      const node = { name: 'parent' };
      attach(parent, node);
      const child = Child(node);
      owners.push(getOwner()!);

      return { node, child };
    });

    const { node, child } = Parent({});
    expect(owners).toEqual([child, node]);
  });

  it('resolves and provides stores without the node', () => {
    const Provider = component((parent: object) => {
      const node = {};
      attach(parent, node);
      attachStore(Theme).color = 'blue';
      Reader(node);

      return node;
    });
    let color = '';
    const Reader = component((parent: object) => {
      attach(parent, {});
      color = useStore(Theme).color;
    });

    Provider({});
    expect(color).toBe('blue');
  });

  it('gives route actions and outlet pages their own frame', async () => {
    const page: Route = { path: '/page' };
    const router = setupRouter([{ path: '/' }, page], { history: memoryHistory('/') });
    const ping = createEmitter();
    const seen = vi.fn();
    const root = document.createElement('div');
    const outlet = createOutlet(root);

    // Not wrapped in component(): the outlet opens the frame.
    const Page = (parent: object) => {
      const node = document.createElement('p');
      attach(parent, node);
      router.route(page, () => {
        // In the action's frame, owned by `node`.
        ping.subscribe(seen);
      });

      return node;
    };
    router.route(root, page, () => outlet.show(Page));

    await router.go('/page');
    ping.emit();
    outlet.clear();
    ping.emit();
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('runs onAttach hooks with the attach scope as owner', () => {
    const ping = createEmitter();
    const seen = vi.fn();
    const Widget = component((parent: object) => {
      const node = {};
      attach(parent, node);
      onAttach(() => {
        ping.subscribe(seen);
      });

      return node;
    });

    const widget = Widget({});
    ping.emit();
    detach(widget);
    ping.emit();
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('throws for owner-less calls outside setup, and subscribe stays unowned there', () => {
    expect(() => listen(document, 'click', () => {})).toThrow(/no owner here/u);
    expect(() => onDestroy(() => {})).toThrow(/no owner here/u);
    const unsubscribe = createEmitter().subscribe(() => {});
    expect(typeof unsubscribe).toBe('function');
    expect(getOwner()).toBeUndefined();
  });
});

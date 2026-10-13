import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attach,
  attachStore,
  component,
  createState,
  createStore,
  destroy,
  detach,
  domRenderer,
  env,
  getParent,
  listen,
  onAttach,
  onDestroy,
  setRenderer,
  useStore,
} from '../src/core/index.ts';

beforeEach(() => {
  setRenderer(domRenderer);
});

describe('logical tree', () => {
  it('moves nodes between parents in O(1) and tracks the parent', () => {
    const a = {};
    const b = {};
    const child = {};
    attach(a, child);
    attach(b, child);
    expect(getParent(child)).toBe(b);
    detach(child);
  });

  it('a node with children but no parent is not attached (B14)', () => {
    const root = {};
    attach(root, {});

    const hook = vi.fn();
    onAttach(root, hook);
    expect(hook).not.toHaveBeenCalled();
  });

  it('runs each attach cleanup once per attachment (B12, B13)', () => {
    const child = {};
    const cleanup = vi.fn();
    attach({}, child);
    onAttach(child, () => cleanup);

    attach({}, child);
    expect(cleanup).toHaveBeenCalledTimes(1);
    attach({}, child);
    expect(cleanup).toHaveBeenCalledTimes(2);
    detach(child);
    expect(cleanup).toHaveBeenCalledTimes(3);
    detach(child);
    expect(cleanup).toHaveBeenCalledTimes(3);
  });

  it('attach frame ends frame-bound subscriptions on detach', () => {
    const child = {};
    const loading = createState(0);
    const seen: number[] = [];
    onAttach(child, () => {
      loading.subscribe((value) => seen.push(value));
    });

    attach({}, child);
    loading.set(1);
    detach(child);
    loading.set(2);
    attach({}, child);
    loading.set(3);
    expect(seen).toEqual([1, 3]);
  });

  it('destroys the subtree, children before parents, and runs every hook', () => {
    const root = {};
    const child = {};
    const grandchild = {};
    attach(root, child);
    attach(child, grandchild);

    const order: string[] = [];
    onDestroy(root, () => order.push('root'));
    onDestroy(child, () => order.push('child'));
    onDestroy(grandchild, () => order.push('grandchild'));

    destroy(root);
    expect(order).toEqual(['grandchild', 'child', 'root']);
  });

  it('destroys many children in linear time (B15)', () => {
    const root = {};
    for (let index = 0; index < 50_000; index++) {
      attach(root, {});
    }
    const start = performance.now();
    destroy(root);
    expect(performance.now() - start).toBeLessThan(500);
  });

  it('removes the root view from the live DOM before its children (B16)', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const list = document.createElement('ul');
    container.append(list);

    const removedWhileConnected: boolean[] = [];
    const Item = component(() => {
      const node = document.createElement('li');
      list.append(node);
      onDestroy(() => removedWhileConnected.push(list.isConnected));

      return { node };
    });
    const List = component(() => {
      for (let index = 0; index < 3; index++) {
        Item();
      }

      return { node: list };
    });

    destroy(List());
    expect(list.isConnected).toBe(false);
    expect(removedWhileConnected).toEqual([false, false, false]);
    container.remove();
  });

  it('unregisters a destroy hook in O(1)', () => {
    const node = {};
    const hook = vi.fn();
    const unregister = onDestroy(node, hook);
    unregister();
    destroy(node);
    expect(hook).not.toHaveBeenCalled();
  });

  it('listen removes the DOM listener when the frame is destroyed', () => {
    const frame = {};
    const button = document.createElement('button');
    const clicked = vi.fn();
    listen(frame, button, 'click', clicked);

    button.click();
    destroy(frame);
    button.click();
    expect(clicked).toHaveBeenCalledTimes(1);
  });
});

describe('stores', () => {
  const Counter = createStore(() => ({ count: 0 }));
  const Missing = createStore<string | null>(() => null);

  it('resolves the nearest provider through logical parents', () => {
    const root = {};
    const child = {};
    const value = attachStore(root, Counter);
    attach(root, child);
    expect(useStore(child, Counter)).toBe(value);
  });

  it('allows nullish store values (B22)', () => {
    const node = {};
    attachStore(node, Missing);
    expect(useStore(node, Missing)).toBeNull();
  });

  it('throws when nothing provides the store', () => {
    expect(() => useStore({}, Counter)).toThrow(/no ancestor provides/u);
  });
});

describe('env', () => {
  const modal = Symbol('modal');
  const input = Symbol('input');
  const sidebar = Symbol('sidebar');

  afterEach(() => {
    env.release(modal);
    env.release(sidebar);
  });

  it('nests an env inside an active one', () => {
    env.isolate(modal);
    env.isolate(input, modal);
    expect(env.is(modal)).toBe(true);
    expect(env.isCurrent(input)).toBe(true);
    expect(env.isCurrent(modal)).toBe(false);

    env.release(input);
    expect(env.isCurrent(modal)).toBe(true);
  });

  it('isolating a sibling releases the previous env (B36)', () => {
    env.isolate(modal);
    env.isolate(sidebar);
    expect(env.is(modal)).toBe(false);
    expect(env.isCurrent(sidebar)).toBe(true);
  });

  it('releasing a container releases everything nested in it', () => {
    env.isolate(modal);
    env.isolate(input, modal);
    env.release(modal);
    expect(env.is(input)).toBe(false);
    expect(env.current).toBeUndefined();
  });
});

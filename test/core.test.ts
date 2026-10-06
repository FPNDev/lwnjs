import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attach,
  attachStore,
  createEmitter,
  createState,
  createStore,
  destroy,
  detach,
  domRenderer,
  env,
  getParent,
  isAttached,
  listen,
  onAttach,
  onDestroy,
  setRenderer,
  useStore,
} from '../src/core/index.ts';

beforeEach(() => {
  setRenderer(domRenderer);
});

describe('emitter / state', () => {
  it('does not skip the next listener when one unsubscribes during emit (B1)', () => {
    const events = createEmitter();
    const calls: string[] = [];
    const offA = events.subscribe(() => {
      calls.push('a');
      offA();
    });
    events.subscribe(() => calls.push('b'));
    events.subscribe(() => calls.push('c'));

    events.emit();
    expect(calls).toEqual(['a', 'b', 'c']);
  });

  it('does not call a listener removed earlier in the same emit', () => {
    const events = createEmitter();
    const calls: string[] = [];
    let offB = () => {};
    events.subscribe(() => {
      calls.push('a');
      offB();
    });
    offB = events.subscribe(() => calls.push('b'));

    events.emit();
    expect(calls).toEqual(['a']);
  });

  it('does not call listeners added during the same emit (B2)', () => {
    const events = createEmitter();
    const calls: string[] = [];
    events.subscribe(() => {
      calls.push('a');
      events.subscribe(() => calls.push('late'));
    });

    events.emit();
    expect(calls).toEqual(['a']);
    events.emit();
    expect(calls).toEqual(['a', 'a', 'late']);
  });

  it('keeps calling listeners after one throws, rethrowing asynchronously (B3)', () => {
    const deferred: (() => void)[] = [];
    const queueMicrotask = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((task) => {
      deferred.push(task);
    });
    const events = createEmitter<number>();
    const seen: number[] = [];
    events.subscribe(() => {
      throw new Error('boom');
    });
    events.subscribe((value) => seen.push(value));

    events.emit(1);
    queueMicrotask.mockRestore();
    expect(seen).toEqual([1]);
    expect(deferred).toHaveLength(1);
    expect(deferred[0]).toThrow('boom');
  });

  it('owner-scoped subscriptions end when the owner is destroyed', () => {
    const owner = {};
    const events = createEmitter<number>();
    const seen: number[] = [];
    events.subscribe(owner, (value) => seen.push(value));

    events.emit(1);
    destroy(owner);
    events.emit(2);
    expect(seen).toEqual([1]);
  });

  it('state notifies on every set, including the same mutated object', () => {
    const items = createState<string[]>([]);
    const seen: number[] = [];
    items.subscribe((value) => seen.push(value.length));

    const list = items.get();
    list.push('a');
    items.set(list);
    list.push('b');
    items.notify();
    expect(seen).toEqual([1, 2]);
    expect(items.get()).toBe(list);
  });
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
    expect(isAttached(child)).toBe(false);
  });

  it('a node with children but no parent is not attached (B14)', () => {
    const root = {};
    attach(root, {});
    expect(isAttached(root)).toBe(false);

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

  it('attach scope ends owner-scoped subscriptions on detach', () => {
    const child = {};
    const loading = createState(0);
    const seen: number[] = [];
    onAttach(child, (scope) => {
      loading.subscribe(scope, (value) => seen.push(value));
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
    attach(container, list);

    const removedWhileConnected: boolean[] = [];
    for (let index = 0; index < 3; index++) {
      const item = document.createElement('li');
      list.append(item);
      attach(list, item);
      onDestroy(item, () => removedWhileConnected.push(list.isConnected));
    }

    destroy(list);
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

  it('listen removes the DOM listener when the owner is destroyed', () => {
    const owner = {};
    const button = document.createElement('button');
    const clicked = vi.fn();
    listen(owner, button, 'click', clicked);

    button.click();
    destroy(owner);
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

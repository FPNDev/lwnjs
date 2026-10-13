import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEmitter,
  createState,
  destroy,
  domRenderer,
  setRenderer,
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
    const queueMicrotask = vi
      .spyOn(globalThis, 'queueMicrotask')
      .mockImplementation((task) => {
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

  it('frame-bound subscriptions end when the frame is destroyed', () => {
    const frame = {};
    const events = createEmitter<number>();
    const seen: number[] = [];
    events.subscribe(frame, (value) => seen.push(value));

    events.emit(1);
    destroy(frame);
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

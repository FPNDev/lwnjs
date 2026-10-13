import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  component,
  createEmitter,
  destroy,
  domRenderer,
  listen,
  onDestroy,
  setRenderer,
  withFrame,
} from '../src/core/index.ts';
import { createOutlet } from '../src/router/index.ts';
import { view } from './helpers.ts';

beforeEach(() => {
  setRenderer(domRenderer);
});

describe('outlet', () => {
  it('keeps two outlets under one frame independent (B18)', () => {
    const container = document.createElement('div');
    const first = document.createComment('');
    const second = document.createComment('');
    container.append(first, second);

    withFrame(container, () => createOutlet(first)).show(view('a'));
    withFrame(container, () => createOutlet(second)).show(view('b'));
    expect(container.textContent).toBe('ab');
  });

  it('replaces in place and keeps the placeholder mounted (B20)', () => {
    const container = document.createElement('div');
    const fragment = document.createDocumentFragment();
    const placeholder = document.createComment('');
    fragment.append(placeholder);
    const outlet = withFrame(container, () => createOutlet(placeholder));

    outlet.show(view('a'));
    outlet.show(view('b'));
    expect(fragment.textContent).toBe('b');

    outlet.clear();
    expect(fragment.childNodes).toHaveLength(1);
    expect(fragment.firstChild).toBe(placeholder);
  });

  it('runs the factory in the outlet frame and releases its resources', () => {
    const container = document.createElement('div');
    const button = document.createElement('button');
    const ping = createEmitter();
    const observed = vi.fn();
    const clicked = vi.fn();
    const destroyed = vi.fn();
    const factory = vi.fn(
      component(() => {
        ping.subscribe(observed);
        listen(button, 'click', clicked);
        onDestroy(destroyed);

        return { node: button };
      }),
    );
    const outlet = withFrame(container, () => createOutlet());
    const shown = outlet.show(factory);

    expect(factory).toHaveBeenCalledWith();
    expect(shown?.node).toBe(button);
    ping.emit();
    button.click();
    destroy(container);
    ping.emit();
    button.click();

    expect(button.parentNode).toBeNull();
    expect(observed).toHaveBeenCalledTimes(1);
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(destroyed).toHaveBeenCalledTimes(1);
  });

  it('returns one node for a component page', () => {
    const container = document.createElement('div');
    const outlet = withFrame(container, () => createOutlet());
    const singleNode = document.createElement('p');
    const SinglePage = component(() => ({ node: singleNode }));

    expect((outlet.show(SinglePage))?.node).toBe(singleNode);
    outlet.clear();
    expect(container.childNodes).toHaveLength(0);
  });
});

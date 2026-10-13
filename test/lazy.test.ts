import { beforeEach, describe, expect, it } from 'vitest';
import { domRenderer, setRenderer, withFrame } from '../src/core/index.ts';
import { createOutlet, lazy, type ViewFactory } from '../src/router/index.ts';
import { view } from './helpers.ts';

beforeEach(() => {
  setRenderer(domRenderer);
});

describe('lazy outlet pages', () => {
  it('ignores a slow lazy view superseded by a newer one (B19)', async () => {
    const container = document.createElement('div');
    const outlet = withFrame(container, () => createOutlet());
    let resolveSlow: (factory: ViewFactory) => void = () => {};
    const slow = outlet.show(
      lazy(
        () =>
          new Promise((resolve) => {
            resolveSlow = resolve;
          }),
      ),
    );

    outlet.show(view('fast'));
    resolveSlow(view('slow'));
    expect(await slow).toBeUndefined();
    expect(container.textContent).toBe('fast');
  });

  it('accepts module loaders and keeps the view for the same factory', async () => {
    const container = document.createElement('div');
    const outlet = withFrame(container, () => createOutlet());
    const factory = view('page');
    const shown = await outlet.show(
      lazy(() => Promise.resolve({ default: factory })),
    );
    expect(await outlet.show(lazy(() => Promise.resolve(factory)))).toBe(shown);
    expect(container.childNodes).toHaveLength(1);
  });
});

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
  getFrame,
  getParent,
  listen,
  onAttach,
  onDestroy,
  setRenderer,
  useStore,
  withFrame,
} from '../src/core/index.ts';
import {
  createOutlet,
  memoryHistory,
  setupRouter,
  type Route,
} from '../src/router/index.ts';
import { frameOf } from '../src/core/frame.ts';

beforeEach(() => {
  setRenderer(domRenderer);
});

const Theme = createStore(() => ({ color: 'red' }));

describe('implicit frame', () => {
  it('binds calls without an explicit frame to the component frame created before setup', () => {
    const ping = createEmitter();
    const button = document.createElement('button');
    const seen = vi.fn();
    const clicked = vi.fn();
    const destroyed = vi.fn();

    const Widget = component(() => {
      const node = {};
      ping.subscribe(seen);
      listen(button, 'click', clicked);
      onDestroy(destroyed);

      return { node };
    });

    const widget = Widget();
    ping.emit();
    button.click();
    destroy(widget);
    ping.emit();
    button.click();

    expect(seen).toHaveBeenCalledTimes(1);
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(destroyed).toHaveBeenCalledTimes(1);
  });

  it('keeps the parent frame after a child component returns', () => {
    let childFrame: object | undefined;
    const Child = component(() => {
      childFrame = getFrame()!;

      return { node: { name: 'child' } };
    });
    let parentFrame: object | undefined;
    const Parent = component(() => {
      parentFrame = getFrame()!;
      const child = Child();
      expect(getFrame()).toBe(parentFrame);

      return { node: { name: 'parent' }, child };
    });

    Parent();
    expect(childFrame).not.toBe(parentFrame);
  });

  it('resolves and provides stores without the node', () => {
    const Provider = component(() => {
      attachStore(Theme).color = 'blue';
      Reader();
    });
    let color = '';
    const Reader = component(() => {
      color = useStore(Theme).color;
    });

    Provider();
    expect(color).toBe('blue');
  });

  it('resolves stores from component parents after attaching existing components', () => {
    const Placement = createStore(() => ({ area: 'page' }));
    const Provider = component(() => {
      attachStore(Placement).area = 'dock';

      return { node: document.createElement('div') };
    });
    const Reader = component(() => ({ node: document.createElement('p') }));
    const provider = Provider();
    const reader = Reader();
    attach(provider, reader);

    expect(withFrame(reader, () => useStore(Placement).area)).toBe('dock');
    destroy(provider);
  });

  it('gives route actions and outlet pages their own frame', async () => {
    const page: Route = { path: '/page' };
    const router = setupRouter([{ path: '/' }, page], {
      history: memoryHistory('/'),
    });
    const ping = createEmitter();
    const seen = vi.fn();
    const root = document.createElement('div');
    const outlet = withFrame(root, () => createOutlet());

    const Page = component(() => {
      const node = document.createElement('p');
      router.route(page, () => {
        // In the action's frame, bound to this component frame.
        ping.subscribe(seen);
      });

      return { node };
    });
    router.route(root, page, () => outlet.show(Page));

    await router.go('/page');
    ping.emit();
    outlet.clear();
    ping.emit();
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('runs onAttach hooks with the attach frame as the current frame', () => {
    const ping = createEmitter();
    const seen = vi.fn();
    const Widget = component(() => {
      onAttach(() => {
        ping.subscribe(seen);
      });
    });

    const widget = Widget();
    attach({}, widget);
    ping.emit();
    detach(widget);
    ping.emit();
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('moves a controller frame and releases its resources on detach and destroy', () => {
    const parentFrames: object[] = [];
    const Parent = component(() => {
      parentFrames.push(getFrame()!);

      return { node: document.createElement('div') };
    });
    const firstParent = Parent();
    const secondParent = Parent();
    const host = document.createElement('div');
    const button = document.createElement('button');
    const ping = createEmitter();
    const seen = vi.fn();
    const clicked = vi.fn();
    const destroyed = vi.fn();
    const attached = vi.fn();
    host.append(button);

    const Widget = component(() => {
      onAttach(() => {
        attached();
        ping.subscribe(seen);
      });
      listen(button, 'click', clicked);
      onDestroy(destroyed);

      return { node: button };
    });

    const widget = Widget();
    attach(firstParent, widget);
    expect(getParent(widget)).toBe(parentFrames[0]);
    ping.emit();
    button.click();

    detach(widget);
    expect(getParent(widget)).toBeUndefined();
    ping.emit();

    attach(secondParent, widget);
    expect(getParent(widget)).toBe(parentFrames[1]);
    ping.emit();
    button.click();

    destroy(widget);
    ping.emit();
    button.click();

    expect(attached).toHaveBeenCalledTimes(2);
    expect(seen).toHaveBeenCalledTimes(2);
    expect(clicked).toHaveBeenCalledTimes(2);
    expect(destroyed).toHaveBeenCalledTimes(1);
    expect(button.parentNode).toBeNull();
    destroy(firstParent);
    destroy(secondParent);
  });

  it('does not bind one controller object to multiple live component frames', () => {
    const shared = { node: document.createElement('div') };
    const Widget = component(() => shared);

    Widget();
    expect(() => Widget()).toThrow(/unique controller object/u);
  });

  it('destroys setup tree state through the bound component controller', () => {
    const child = {};
    const controllerDestroyed = vi.fn();
    const childDestroyed = vi.fn();
    let frame: object | undefined;
    const Widget = component(() => {
      const controller = { node: document.createElement('div') };
      frame = getFrame()!;
      attach(frame, child);
      onDestroy(controllerDestroyed);
      onDestroy(child, childDestroyed);

      return controller;
    });

    const controller = Widget();

    expect(frameOf(controller)).toBe(frame);
    expect(getParent(child)).toBe(frame);
    destroy(controller);
    expect(controllerDestroyed).toHaveBeenCalledTimes(1);
    expect(childDestroyed).toHaveBeenCalledTimes(1);
  });

  it('throws for calls without a frame outside setup, and subscribe stays unbound there', () => {
    expect(() => listen(document, 'click', () => {})).toThrow(/no frame here/u);
    expect(() => onDestroy(() => {})).toThrow(/no frame here/u);
    const unsubscribe = createEmitter().subscribe(() => {});
    expect(typeof unsubscribe).toBe('function');
    expect(getFrame()).toBeUndefined();
  });
});

import { getRenderer } from '../core/renderer.ts';
import {
  DEAD,
  frameOf,
  HELD,
  requireCurrent,
  setCurrent,
  type Frame,
} from '../core/frame.ts';
import { hydration } from '../core/hydration.ts';
import {
  afterSetup,
  attachFrames,
  createChildFrame,
  destroy,
  onDestroy,
  release,
} from '../core/tree.ts';
import { type ComponentController } from '../core/component.ts';
import { report } from '../core/report.ts';
import { noop } from '../core/cleanup.ts';
import { collectWork, trackWork, work } from './listeners.ts';

/** Creates a component controller for an outlet view. */
export type ViewFactory = () => ComponentController;

/** A view factory loaded on first show; see lazy(). */
export type Lazy = {
  /** Loads the factory once; later calls share the same promise. */
  readonly load: () => Promise<ViewFactory>;
  /** The loaded factory; undefined until the load resolves. */
  readonly factory: ViewFactory | undefined;
};

/** A view factory, or a lazy one. */
export type ViewSource = ViewFactory | Lazy;

export type Outlet = {
  /** Shows a view now, or at the owner's setup end; returns the controller only if it drew. */
  show(source: ViewFactory): ComponentController | undefined;
  /** Loads, then shows a view; resolves undefined if it did not draw. */
  show(source: Lazy): Promise<ComponentController | undefined>;
  /** Destroys the current view and cancels a pending one. */
  clear(): void;
};

/** Wraps a loader so the outlet loads it once and dedupes it by identity. */
export function lazy(
  loader: () => Promise<ViewFactory | { default: ViewFactory }>,
): Lazy {
  let pending: Promise<ViewFactory> | undefined;
  const source: Lazy = {
    factory: undefined,
    load: () =>
      (pending ??= loader().then(
        (loaded) =>
          ((source as { factory?: ViewFactory }).factory =
            typeof loaded === 'function' ? loaded : loaded.default),
        (error: unknown) => {
          pending = undefined;
          throw error;
        },
      )),
  };

  return source;
}

function fail(showFrame: Frame, message: string) {
  destroy(showFrame);
  return new Error(message);
}

/** Creates an outlet for the current frame. */
export function createOutlet(placeholder?: object): Outlet {
  const frame = requireCurrent('createOutlet');
  let factory: ViewFactory | undefined;
  let controller: ComponentController | undefined;
  let deferred: ViewFactory | undefined;
  let version = 0;
  // Keep outlet keys stable between server rendering and hydration.
  const hydrationKey = hydration ? hydration.nextKey() : '';

  const draw = (nextFactory: ViewFactory, v: number) => {
    const showFrame = createChildFrame(frame);
    const previous = setCurrent(showFrame);
    let next: ComponentController;
    try {
      const h = hydration;
      next = h ? h.scope(hydrationKey, nextFactory) : nextFactory();
    } catch (error) {
      setCurrent(previous);
      destroy(showFrame);
      throw error;
    }
    setCurrent(previous);
    if (version !== v) {
      destroy(showFrame);

      return;
    }
    const pageFrame = next ? frameOf(next) : undefined;
    if (!pageFrame || pageFrame.controller !== next) {
      report(new Error('Outlet: factory must return a component().'));
      destroy(showFrame);

      return;
    }
    const renderer = getRenderer();
    if (!renderer) {
      throw fail(showFrame, 'Outlet: no renderer set. Call setRenderer() at startup.');
    }
    const before = controller?.node ?? controller?.nodes![0] ?? placeholder;
    let parent: object | undefined;
    if (!before) {
      const owner = frame.controller;
      if (owner?.nodes && owner.nodes.length > 1) {
        throw fail(
          showFrame,
          'Outlet: frame has multiple rendered roots; pass a placeholder view.',
        );
      }
      parent = owner ? (owner.node ?? owner.nodes![0]) : frame.host;
      if (!parent) {
        throw fail(
          showFrame,
          'Outlet: frame has no rendered root; pass a placeholder view.',
        );
      }
    }

    if (next.node) {
      if (before) {
        renderer.insertBefore(before, next.node);
      } else {
        renderer.append(parent!, next.node);
      }
    } else {
      for (const view of next.nodes!) {
        if (before) {
          renderer.insertBefore(before, view);
        } else {
          renderer.append(parent!, view);
        }
      }
    }
    destroy(controller);

    factory = nextFactory;
    controller = next;
    onDestroy(next, () => {
      factory = controller = undefined;
      destroy(showFrame);
    });
    if (pageFrame.parent !== showFrame) {
      attachFrames(showFrame, pageFrame);
    }
    release(showFrame);

    return next;
  };

  const flush = () => {
    const next = deferred;
    deferred = undefined;
    if (next) {
      draw(next, version);
    }
  };

  const showFactory = (nextFactory: ViewFactory) => {
    if (frame.state & DEAD) {
      return;
    }
    version++;
    if (nextFactory === factory) {
      deferred = undefined;

      return controller;
    }
    if (frame.state & HELD) {
      if (!deferred) {
        afterSetup(frame, flush);
      }
      deferred = nextFactory;

      return;
    }
    deferred = undefined;

    return draw(nextFactory, version);
  };

  function show(nextSource: ViewFactory): ComponentController | undefined;
  function show(nextSource: Lazy): Promise<ComponentController | undefined>;
  function show(nextSource: ViewSource) {
    const nextFactory =
      typeof nextSource === 'function' ? nextSource : nextSource.factory;
    if (nextFactory || frame.state & DEAD) {
      const shown = nextFactory && showFactory(nextFactory);

      return typeof nextSource === 'function' ? shown : Promise.resolve(shown);
    }
    const current = ++version;
    deferred = undefined;
    const into = work;
    const loading = (nextSource as Lazy)
      .load()
      .then((loaded) =>
        current === version
          ? collectWork(into, () => showFactory(loaded))
          : undefined,
      );
    hydration?.track(loading);
    trackWork(loading);

    return loading.then(undefined, noop);
  }

  return {
    show,

    clear() {
      version++;
      deferred = undefined;
      destroy(controller);
    },
  };
}

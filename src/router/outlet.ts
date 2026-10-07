import { getRenderer } from '../core/renderer.ts';
import { requireFrame, withFrame } from '../core/frame.ts';
import {
  nextHydrationKey,
  trackPending,
  withHydration,
} from '../core/hydration.ts';
import {
  attach,
  destroy,
  ensureLogicalRecord,
  onDestroy,
} from '../core/tree.ts';
import { type ComponentController } from '../core/component.ts';

/** Creates a component controller for an outlet view. */
export type ViewFactory = () => ComponentController;

/** Loads a view factory on demand. */
export type ViewLoader = () => Promise<{ default: ViewFactory } | ViewFactory>;

export type ViewSource = () =>
  ComponentController | Promise<{ default: ViewFactory } | ViewFactory>;

export type Outlet = {
  /** Shows a view, replacing the current one unless its factory is unchanged. */
  show(source: ViewSource): Promise<ComponentController | undefined>;
  /** Destroys the current view, if any. */
  clear(): void;
};

function requireRenderer() {
  const renderer = getRenderer();
  if (!renderer) {
    throw new Error('Outlet: no renderer set. Call setRenderer() at startup.');
  }

  return renderer;
}

/** Creates an outlet for the current frame. */
export function createOutlet(placeholder?: object): Outlet {
  const frame = requireFrame('createOutlet');
  const rootViews = ensureLogicalRecord(frame).views;
  if (!placeholder && rootViews && rootViews.size > 1) {
    throw new Error(
      'Outlet: frame has multiple rendered roots; pass a placeholder view.',
    );
  }
  if (!placeholder && rootViews?.size === 0) {
    throw new Error(
      'Outlet: frame has no rendered root; pass a placeholder view.',
    );
  }
  const renderParent = placeholder
    ? undefined
    : (rootViews?.values().next().value ?? frame);
  let source: ViewSource | undefined;
  let factory: ViewSource | undefined;
  let controller: ComponentController | undefined;
  let unregisterCurrent: (() => void) | undefined;
  let version = 0;
  // Keep outlet keys stable between server rendering and hydration.
  const hydrationKey = nextHydrationKey() ?? '';
  const build = <T>(run: () => T): T =>
    withHydration(hydrationKey, () => withFrame(frame, run));

  onDestroy(frame, () => {
    version++;
  });

  const mount = (
    nextSource: ViewSource,
    nextFactory: ViewSource,
    nextController: ComponentController,
  ) => {
    attach(frame, nextController);

    const renderer = requireRenderer();
    const previousViews = controller
      ? ensureLogicalRecord(controller).views
      : undefined;
    const anchor = previousViews
      ? (previousViews.values().next().value ?? placeholder)
      : (controller?.node ?? placeholder);

    const nextViews = ensureLogicalRecord(nextController).views;

    const place = (root: object) => {
      if (anchor) {
        renderer.insertBefore(anchor, root);
        return;
      }

      renderer.append(renderParent!, root);
    };

    for (const root of nextViews!) {
      place(root);
    }

    unregisterCurrent?.();
    destroy(controller);

    source = nextSource;
    factory = nextFactory;
    controller = nextController;
    unregisterCurrent = onDestroy(nextController, () => {
      source = factory = controller = unregisterCurrent = undefined;
    });

    return nextController;
  };

  const show = async (nextSource: ViewSource) => {
    if (controller && nextSource === source) {
      return controller;
    }

    const current = ++version;
    const built = build(nextSource);
    if (!(built instanceof Promise)) {
      return Promise.resolve().then(() => mount(nextSource, nextSource, built));
    }

    const loaded = await built;
    if (current !== version) {
      return;
    }

    const nextFactory = typeof loaded === 'function' ? loaded : loaded.default;
    if (controller && nextFactory === factory) {
      source = nextSource;

      return controller;
    }

    return mount(nextSource, nextFactory, build(nextFactory));
  };

  return {
    show: (nextSource) => trackPending(show(nextSource)),

    clear() {
      version++;
      destroy(controller);
    },
  };
}

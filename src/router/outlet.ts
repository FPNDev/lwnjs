import { getRenderer } from '../core/renderer.ts';
import { runInFrame } from '../core/owner.ts';
import { nextScopeKey, trackPending, withScope } from '../core/scope.ts';
import { attach, destroy, onDestroy } from '../core/tree.ts';

/** Builds a view. Receives the outlet owner, which becomes the view's logical parent. */
export type ViewFactory = (parent: object) => object;

/** Lazily loads a view factory, e.g. `() => import('./Page')`. */
export type ViewLoader = () => Promise<{ default: ViewFactory } | ViewFactory>;

export type ViewSource = ViewFactory | ViewLoader;

export type Outlet = {
  /**
   * Shows the view from `source`, replacing the current one. Showing the same
   * factory again keeps the current view. Resolves to the shown view, or
   * `undefined` when a later `show`/`clear` superseded this one.
   */
  show(source: ViewSource): Promise<object | undefined>;
  /** Destroys the current view. */
  clear(): void;
};

function requireRenderer() {
  const renderer = getRenderer();
  if (!renderer) {
    throw new Error('Outlet: no renderer set. Call setRenderer() at startup.');
  }

  return renderer;
}

/**
 * Creates a slot that shows one view at a time under `owner`.
 * @param owner Logical parent of shown views; without `placeholder`, views are appended to it.
 * @param placeholder View that marks the position; shown views are inserted before it and it stays mounted.
 * @returns The outlet.
 */
export function createOutlet(owner: object, placeholder?: object): Outlet {
  let source: ViewSource | undefined;
  let factory: ViewFactory | undefined;
  let view: object | undefined;
  let unregisterView: (() => void) | undefined;
  let version = 0;
  // Views are built in a scope keyed by this outlet's position, which keeps hydration deterministic.
  // Outside any scope (after hydration) the key is empty: the scope still marks setup for `useServer`.
  const scopeKey = nextScopeKey() ?? '';
  // Factories run in a frame of their own: pages need no `component()` wrapper.
  const build = (run: ViewSource) => withScope(scopeKey, () => runInFrame(undefined, () => run(owner)));

  onDestroy(owner, () => {
    version++;
  });

  const mount = (
    nextSource: ViewSource,
    nextFactory: ViewFactory,
    nextView: object,
  ) => {
    attach(owner, nextView);

    const renderer = requireRenderer();
    const anchor = view ?? placeholder;
    if (anchor) {
      renderer.insertBefore(anchor, nextView);
    } else {
      renderer.append(owner, nextView);
    }

    unregisterView?.();
    destroy(view);

    source = nextSource;
    factory = nextFactory;
    view = nextView;
    unregisterView = onDestroy(nextView, () => {
      source = factory = view = unregisterView = undefined;
    });

    return nextView;
  };

  const show = async (nextSource: ViewSource) => {
      if (view && nextSource === source) {
        return view;
      }

      const current = ++version;
      const result = build(nextSource);
      if (!(result instanceof Promise)) {
        return mount(nextSource, nextSource as ViewFactory, result);
      }

      const loaded = await (result as ReturnType<ViewLoader>);
      if (current !== version) {
        return;
      }

      const nextFactory =
        typeof loaded === 'function' ? loaded : loaded.default;
      if (view && nextFactory === factory) {
        source = nextSource;

        return view;
      }

      return mount(nextSource, nextFactory, build(nextFactory) as object);
  };

  return {
    show: (nextSource) => trackPending(show(nextSource)),

    clear() {
      version++;
      destroy(view);
    },
  };
}

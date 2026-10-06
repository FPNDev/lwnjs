import { claimOwner, requireOwner, runInFrame } from './owner.ts';
import { getRenderer } from './renderer.ts';
import { runIsolated } from './report.ts';

/**
 * Runs when a node gets a logical parent. `scope` is an owner that is destroyed
 * on the next detach, so owner-scoped subscriptions made with it end on detach.
 * A returned function also runs on detach.
 */
export type AttachHook = (scope: object) => (() => void) | void;

type LogicalNode = {
  parent?: object;
  children?: Set<object>;
  attachHooks?: AttachHook[];
  attachScope?: object;
  destroyHooks?: Set<() => void>;
};

const tree = new WeakMap<object, LogicalNode>();

function entryOf(node: object) {
  let entry = tree.get(node);
  if (!entry) {
    entry = {};
    tree.set(node, entry);
  }

  return entry;
}

/**
 * Makes `child` a logical child of `parent`, moving it from its previous parent if needed.
 * Runs `onAttach` hooks. O(1) plus hooks.
 * @param parent Logical parent.
 * @param child Node to attach.
 */
export function attach(parent: object, child: object) {
  claimOwner(child);
  const entry = entryOf(child);
  if (entry.parent === parent) {
    return;
  }
  if (entry.parent) {
    detachEntry(child, entry);
  }

  entry.parent = parent;
  (entryOf(parent).children ??= new Set()).add(child);

  if (entry.attachHooks) {
    const scope = (entry.attachScope = {});
    for (const hook of entry.attachHooks) {
      runAttachHook(hook, scope);
    }
  }
}

/**
 * Removes `child` from its logical parent without destroying it. Ends its attach scope. O(1) plus hooks.
 * @param child Node to detach.
 */
export function detach(child: object) {
  const entry = tree.get(child);
  if (entry?.parent) {
    detachEntry(child, entry);
  }
}

/**
 * Destroys a node and its logical subtree: unmounts views through the renderer
 * (the root first, so only one live mutation happens), then runs destroy hooks,
 * children before parents. O(subtree).
 * @param node Root node to destroy. `undefined` is ignored.
 */
export function destroy(node?: object) {
  if (!node) {
    return;
  }

  getRenderer()?.remove(node);
  dispose(node);
}

/**
 * Registers a hook that runs whenever `node` is attached, and right away if it
 * already is. The hook runs in a frame owned by its scope, so owner-less calls
 * inside it end on detach. Without `node`: the current owner.
 */
export function onAttach(hook: AttachHook): void;
export function onAttach(node: object, hook: AttachHook): void;
export function onAttach(
  nodeOrHook: object | AttachHook,
  maybeHook?: AttachHook,
) {
  const node = maybeHook ? nodeOrHook : requireOwner('onAttach');
  const hook = maybeHook ?? (nodeOrHook as AttachHook);
  const entry = entryOf(node);
  (entry.attachHooks ??= []).push(hook);

  if (entry.parent) {
    runAttachHook(hook, (entry.attachScope ??= {}));
  }
}

/**
 * Registers a hook that runs once when `node` (default: the current owner) is destroyed.
 * @returns A function that unregisters the hook. O(1).
 */
export function onDestroy(hook: () => void): () => void;
export function onDestroy(node: object, hook: () => void): () => void;
export function onDestroy(
  nodeOrHook: object | (() => void),
  maybeHook?: () => void,
) {
  const node = maybeHook ? nodeOrHook : requireOwner('onDestroy');
  const hook = maybeHook ?? (nodeOrHook as () => void);
  const hooks = (entryOf(node).destroyHooks ??= new Set());
  const registered = () => {
    hook();
  };
  hooks.add(registered);

  return () => {
    hooks.delete(registered);
  };
}

/**
 * @param node Node to inspect.
 * @returns Its logical parent, which may differ from where its view is mounted.
 */
export function getParent(node: object) {
  return tree.get(node)?.parent;
}

/**
 * @param node Node to inspect.
 * @returns Whether the node currently has a logical parent.
 */
export function isAttached(node?: object) {
  return node !== undefined && tree.get(node)?.parent !== undefined;
}

function runAttachHook(hook: AttachHook, scope: object) {
  runIsolated(() => {
    const cleanup = runInFrame(scope, () => hook(scope));
    if (cleanup) {
      onDestroy(scope, cleanup);
    }
  });
}

function detachEntry(child: object, entry: LogicalNode) {
  tree.get(entry.parent!)?.children?.delete(child);
  entry.parent = undefined;

  const scope = entry.attachScope;
  if (scope) {
    entry.attachScope = undefined;
    dispose(scope);
  }
}

function dispose(node: object) {
  const entry = tree.get(node);
  if (!entry) {
    return;
  }
  tree.delete(node);

  if (entry.children) {
    for (const child of entry.children) {
      destroy(child);
    }
  }

  if (entry.parent) {
    detachEntry(node, entry);
  } else if (entry.attachScope) {
    dispose(entry.attachScope);
  }

  if (entry.destroyHooks) {
    for (const hook of entry.destroyHooks) {
      runIsolated(hook);
    }
  }
}

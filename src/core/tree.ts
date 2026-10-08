import type { ComponentController } from './component.ts';
import { componentFrames, frameOf, requireFrame, runInFrame } from './frame.ts';
import { getRenderer } from './renderer.ts';
import { runIsolated } from './report.ts';

/** Runs after attachment and may return cleanup for detachment. */
export type AttachHook = (frame: object) => (() => void) | void;

type LogicalRecord = {
  parent?: object;
  children?: Set<object>;
  attachHooks?: AttachHook[];
  attachFrame?: object;
  destroyHooks?: Set<() => void>;
  controller?: ComponentController;
  views?: Set<object>;
};

const tree = new WeakMap<object, LogicalRecord>();

export function ensureLogicalRecord(node: object) {
  const frame = frameOf(node);
  let record = tree.get(frame);
  if (!record) {
    record = {};
    tree.set(frame, record);
  }

  return record;
}

/** Moves `child` under `parent` in the logical tree. */
export function attach(parent: object, child: object) {
  attachLogical(frameOf(parent), frameOf(child));
}

function attachLogical(parent: object, child: object) {
  const record = ensureLogicalRecord(child);

  if (record.parent === parent) {
    return;
  }

  if (record.parent) {
    detachLogicalChild(child, record);
  }

  record.parent = parent;
  (ensureLogicalRecord(parent).children ??= new Set()).add(child);

  if (record.attachHooks) {
    const attachFrame = (record.attachFrame = {});
    for (const hook of record.attachHooks) {
      runAttachHook(hook, frameOf(child), attachFrame);
    }
  }
}

/** Detaches `child` while keeping it alive. */
export function detach(child: object) {
  const logicalChild = frameOf(child);
  const record = tree.get(logicalChild);
  if (record?.parent) {
    detachLogicalChild(logicalChild, record);
  }
}

/** Destroys a logical node and its descendants, removing their views. */
export function destroy(node?: object) {
  if (!node) {
    return;
  }

  const frame = frameOf(node);
  if (frame) {
    destroyFrame(frame);
  }
}

function destroyFrame(frame: object) {
  const views = ensureLogicalRecord(frame).views ?? [frame];
  if (views) {
    for (const view of views) {
      if (!view) {
        continue;
      }

      getRenderer()?.remove(view);
    }
  }

  dispose(frame);
}

/** Associates a controller and its renderer roots with a frame. */
export function bindComponentController(
  frame: object,
  controller: ComponentController,
) {
  const frameRecord = ensureLogicalRecord(frame);

  const hasNode = Object.hasOwn(controller, 'node');
  const hasNodes = Object.hasOwn(controller, 'nodes');
  if (hasNode === hasNodes) {
    throw new TypeError(
      'component(): setup must return { node }, { nodes }, or void.',
    );
  }

  if (componentFrames.has(controller)) {
    throw new TypeError(
      'component(): each invocation must return a unique controller object.',
    );
  }

  frameRecord.controller = controller;
  frameRecord.views = new Set(hasNode ? [controller.node!] : controller.nodes!);

  componentFrames.set(controller, frame);
}

/** Runs a hook for each attachment and destroys its frame on detachment. */
export function onAttach(hook: AttachHook): void;
export function onAttach(node: object, hook: AttachHook): void;
export function onAttach(
  nodeOrHook: object | AttachHook,
  maybeHook?: AttachHook,
) {
  const frame = maybeHook ? frameOf(nodeOrHook) : requireFrame('onAttach');
  const hook = maybeHook ?? (nodeOrHook as AttachHook);

  const record = ensureLogicalRecord(frame);
  if (!record) {
    return;
  }

  (record.attachHooks ??= []).push(hook);
  record.attachFrame ??= {};

  if (record.parent) {
    runAttachHook(hook, frame, record.attachFrame);
  }
}

/** Registers cleanup for destruction and returns an unregister function. */
export function onDestroy(hook: () => void): () => void;
export function onDestroy(node: object, hook: () => void): () => void;
export function onDestroy(
  nodeOrHook: object | (() => void),
  maybeHook?: () => void,
) {
  const frame = maybeHook ? frameOf(nodeOrHook) : requireFrame('onDestroy');
  const hook = maybeHook ?? (nodeOrHook as () => void);

  const record = ensureLogicalRecord(frame);
  if (!record) {
    return;
  }

  const hooks = (record.destroyHooks ??= new Set());

  hooks.add(hook);

  return () => {
    hooks.delete(hook);
  };
}

/** Returns the logical parent of a node or controller. */
export function getParent(node: object) {
  return tree.get(frameOf(node))?.parent;
}

function runAttachHook(
  hook: AttachHook,
  parentFrame: object,
  attachFrame: object,
) {
  attachLogical(parentFrame, attachFrame);

  runIsolated(() => {
    const cleanup = runInFrame(attachFrame, () => hook(attachFrame));
    if (cleanup) {
      onDestroy(attachFrame, cleanup);
    }
  });
}

function detachLogicalChild(child: object, record: LogicalRecord) {
  tree.get(record.parent!)?.children?.delete(child);
  record.parent = undefined;

  const attachFrame = record.attachFrame;
  if (attachFrame) {
    record.attachFrame = undefined;
    dispose(attachFrame);
  }
}

function dispose(node: object) {
  const record = tree.get(node);
  if (!record) {
    return;
  }
  tree.delete(node);

  if (record.controller) {
    componentFrames.delete(record.controller);
  }
  if (record.children) {
    for (const child of record.children) {
      destroy(child);
    }
  }

  if (record.parent) {
    detachLogicalChild(node, record);
  }

  if (record.attachFrame) {
    dispose(record.attachFrame);
  }

  if (record.destroyHooks) {
    for (const hook of record.destroyHooks) {
      runIsolated(hook);
    }
  }
}

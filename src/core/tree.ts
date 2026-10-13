import { runCleanups } from './cleanup.ts';
import type { ComponentController } from './component.ts';
import {
  createFrame,
  DEAD,
  ensureFrame,
  frameOf,
  HELD,
  PENDING,
  tagController,
  WAITING,
  type Frame,
} from './frame.ts';
import { lift, runAttachHooks } from './lifecycle.ts';
import { getRenderer, type Renderer } from './renderer.ts';
import { report } from './report.ts';

export { onDestroy } from './cleanup.ts';
export {
  afterSetup,
  onAttach,
  release,
  type AttachHook,
} from './lifecycle.ts';

function link(parent: Frame, child: Frame) {
  const last = parent.last;
  child.parent = parent;
  child.prev = last;
  if (last) {
    last.next = child;
  } else {
    parent.first = child;
  }
  parent.last = child;
}

function unlink(child: Frame) {
  const parent = child.parent!;
  if (parent.attachFrame === child) {
    parent.attachFrame = undefined;
  } else {
    const { prev, next } = child;
    if (prev) {
      prev.next = next;
    } else {
      parent.first = next;
    }
    if (next) {
      next.prev = prev;
    } else {
      parent.last = prev;
    }
    child.prev = child.next = undefined;
  }
  child.parent = undefined;
}

/** Creates the frame of a component or show build under `parent`. */
export function createChildFrame(parent: Frame | undefined) {
  if (parent && parent.state & DEAD) {
    return createFrame(DEAD);
  }

  const frame = createFrame(
    parent && parent.state & PENDING ? HELD | WAITING : HELD,
  );
  if (parent) {
    link(parent, frame);
  }

  return frame;
}

/** Moves `child` under `parent` in the logical tree. */
export function attach(parent: object, child: object) {
  attachFrames(ensureFrame(parent), ensureFrame(child));
}

/** Moves the `child` frame under the `parent` frame; for engine callers. */
export function attachFrames(parent: Frame, child: Frame) {
  if (child.state & DEAD) {
    return;
  }
  if (parent.state & DEAD) {
    destroyFrame(child, getRenderer());
    return;
  }
  if (child.parent === parent) {
    return;
  }
  if (child.parent) {
    detachFrame(child);
  }

  link(parent, child);

  if (parent.state & PENDING) {
    child.state |= WAITING;
  } else if ((child.state & PENDING) === 0) {
    runAttachHooks(child);
  } else {
    lift(child, WAITING);
  }
}

/** Detaches `child` while keeping it alive. */
export function detach(child: object) {
  const frame = frameOf(child);
  if (frame?.parent) {
    detachFrame(frame);
  }
}

function detachFrame(frame: Frame) {
  unlink(frame);
  if (frame.attachFrame) {
    destroyFrame(frame.attachFrame, getRenderer());
  }
}

/** Destroys a logical node and its descendants, removing their views. */
export function destroy(node?: object) {
  if (!node) {
    return;
  }

  const frame = frameOf(node);
  const renderer = getRenderer();
  if (frame) {
    destroyFrame(frame, renderer);
  } else if (renderer) {
    removeView(renderer, node);
  }
}

/** Destroys `frame`: own views, then children, then its cleanups in order. */
export function destroyFrame(frame: Frame, renderer: Renderer | undefined) {
  if (frame.state & DEAD) {
    return;
  }

  frame.state = DEAD;
  if (frame.parent) {
    unlink(frame);
  }
  const { controller, host } = frame;
  if (renderer) {
    if (controller) {
      removeViews(renderer, controller);
    } else if (host) {
      removeView(renderer, host);
    }
  }
  while (frame.first) {
    destroyFrame(frame.first, renderer);
  }
  if (frame.attachFrame) {
    destroyFrame(frame.attachFrame, renderer);
  }
  runCleanups(frame);
  frame.controller = undefined;
}

function removeViews(renderer: Renderer, controller: ComponentController) {
  if (controller.nodes) {
    for (const view of controller.nodes) {
      removeView(renderer, view);
    }
  } else {
    removeView(renderer, controller.node!);
  }
}

function removeView(renderer: Renderer, view: object) {
  try {
    renderer.remove(view);
  } catch (error) {
    report(error);
  }
}

/** Associates a controller and its renderer roots with a frame. */
export function bindController(frame: Frame, controller: ComponentController) {
  if (Object.hasOwn(controller, 'node') === Object.hasOwn(controller, 'nodes')) {
    throw new TypeError(
      'component(): setup must return { node }, { nodes }, or void.',
    );
  }

  tagController(controller, frame);
  frame.controller = controller;
}

/** Returns the logical parent; may be an internal engine frame (show or attach frame). */
export function getParent(node: object): object | undefined {
  const parent = frameOf(node)?.parent;
  return parent && (parent.host ?? parent);
}

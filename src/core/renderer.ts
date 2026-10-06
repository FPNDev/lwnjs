/**
 * Places views. The engine only ever needs these three operations, so any
 * view system (DOM, WebGL scene graph, terminal, ...) can plug in.
 */
export type Renderer<V extends object = object> = {
  /** Appends `view` as the last child of `parent`. */
  append(parent: V, view: V): void;
  /** Inserts `view` right before `anchor`, under the same parent. */
  insertBefore(anchor: V, view: V): void;
  /** Removes `view` from wherever it is mounted. Called for every destroyed node, so it must ignore objects that are not views. */
  remove(view: V): void;
};

let activeRenderer: Renderer | undefined;

/**
 * Sets the renderer used by `destroy` and outlets. Call once at startup.
 * @param renderer Renderer to use.
 */
export function setRenderer<V extends object>(renderer: Renderer<V>) {
  activeRenderer = renderer as unknown as Renderer;
}

/** @returns The renderer set by `setRenderer`, if any. */
export function getRenderer() {
  return activeRenderer;
}

/** Renderer for DOM nodes. Touches no globals, so it also works with server-side DOM implementations. */
export const domRenderer: Renderer<Node> = {
  append(parent, view) {
    (parent as ParentNode).append(view);
  },
  insertBefore(anchor, view) {
    anchor.parentNode?.insertBefore(view, anchor);
  },
  remove(view) {
    if (view instanceof Node && 'remove' in view) {
      (view as ChildNode).remove();
    }
  },
};

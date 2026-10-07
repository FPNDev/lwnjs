/** Operations for placing and removing renderer views. */
export type Renderer<V extends object = object> = {
  /** Appends a view to a parent. */
  append(parent: V, view: V): void;
  /** Inserts a view before an anchor. */
  insertBefore(anchor: V, view: V): void;
  /** Removes a view when it is managed by this renderer. */
  remove(view: V): void;
};

let activeRenderer: Renderer | undefined;

/** Selects the renderer used by outlets and destruction. */
export function setRenderer<V extends object>(renderer: Renderer<V>) {
  activeRenderer = renderer as unknown as Renderer;
}

export function getRenderer() {
  return activeRenderer;
}

/** Renderer for browser and server DOM implementations. */
export const domRenderer: Renderer<Node> = {
  append(parent, view) {
    (parent as ParentNode).append(view);
  },
  insertBefore(anchor, view) {
    anchor.parentNode?.insertBefore(view, anchor);
  },
  remove(view) {
    const ViewNode = view.ownerDocument?.defaultView?.Node;
    if (ViewNode && view instanceof ViewNode && 'remove' in view) {
      (view as ChildNode).remove();
    }
  },
};

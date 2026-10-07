import { hydrationContext, type HydrationContext } from '../core/hydration.ts';

/** Hooks view creation into server rendering and client hydration. */
export type CreationHook = {
  /** Returns claimed server views during hydration. */
  claim?(context: HydrationContext, index: number): Node[] | undefined;
  /** Records views created during server rendering. */
  record?(context: HydrationContext, index: number, nodes: Node[]): void;
};

let hook: CreationHook | undefined;

/** Sets or clears the active creation hook. */
export function setCreationHook(next: CreationHook | undefined) {
  hook = next;
}

/** Creates views or claims the matching server views during hydration. */
export function create(build: () => Node[]): Node[] {
  const context = hydrationContext();
  if (!context || !hook) {
    return build();
  }

  const index = context.created++;
  const claimed = hook.claim?.(context, index);
  if (claimed) {
    return claimed;
  }

  const nodes = build();
  hook.record?.(context, index, nodes);

  return nodes;
}

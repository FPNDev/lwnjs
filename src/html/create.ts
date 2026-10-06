import { currentScope, type RenderScope } from '../core/scope.ts';

/** Lets SSR record created views on the server and claim server views on the client. */
export type CreationHook = {
  /** Client: returns the server-rendered nodes for this creation, if any. */
  claim?(scope: RenderScope, index: number): Node[] | undefined;
  /** Server: records the nodes of this creation. */
  record?(scope: RenderScope, index: number, nodes: Node[]): void;
};

let hook: CreationHook | undefined;

/**
 * Installs or removes the creation hook.
 * @param next Hook to install, or `undefined`.
 */
export function setCreationHook(next: CreationHook | undefined) {
  hook = next;
}

/**
 * Creates nodes through the hook: inside a render scope they can be claimed
 * from server-rendered markup (client) or recorded for it (server).
 * @param build Creates the nodes when nothing is claimed.
 * @returns The created or claimed nodes.
 */
export function create(build: () => Node[]): Node[] {
  const scope = currentScope();
  if (!scope || !hook) {
    return build();
  }

  const index = scope.created++;
  const claimed = hook.claim?.(scope, index);
  if (claimed) {
    return claimed;
  }

  const nodes = build();
  hook.record?.(scope, index, nodes);

  return nodes;
}

import { runInFrame } from '../core/frame.ts';
import {
  type HydrationContext,
  whenSettledHydration,
  withHydration,
} from '../core/hydration.ts';
import { setCreationHook } from '../html/create.ts';
import type { Router } from '../router/router.ts';
import { setServerData } from './data.ts';
import { enableServerData } from './load.ts';
import { type Payload, takePayload } from './payload.ts';

function resolvePath(container: Node, path: string): Node | undefined {
  const isPlaceholder = path.startsWith('~');
  let node: Node | undefined = container;
  for (const position of (isPlaceholder ? path.slice(1) : path).split('.')) {
    node = node?.childNodes[Number(position)];
  }
  if (!node || !isPlaceholder) {
    return node;
  }

  // The server uses comments where HTML serialization drops empty text nodes.
  const textNode = document.createTextNode('');
  (node as ChildNode).replaceWith(textNode);

  return textNode;
}

function resolveEntry(container: Node, entry: string | null) {
  if (!entry) {
    return;
  }
  const nodes: Node[] = [];
  for (const path of entry.split('|')) {
    const node = resolvePath(container, path);
    if (!node) {
      return;
    }
    nodes.push(node);
  }

  return nodes;
}

function claimsFor(container: Node, frames: Payload['frames']) {
  // Resolve paths before app code can move views.
  const pending = new Map<string, (Node[] | undefined)[]>();
  for (const [key, entries] of Object.entries(frames)) {
    pending.set(
      key,
      entries.map((entry) => resolveEntry(container, entry)),
    );
  }
  const taken = new WeakMap<HydrationContext, (Node[] | undefined)[]>();

  return {
    claim(context: HydrationContext, index: number) {
      let claims = taken.get(context);
      if (!claims) {
        claims = pending.get(context.key);
        if (!claims) {
          return;
        }
        // Each context claims its views once; later renders create new ones.
        pending.delete(context.key);
        taken.set(context, claims);
      }

      return claims[index];
    },
  };
}

/** Hydrates server views and resolves after lazy views have settled. */
export async function hydrate(
  container: Element,
  app: (container: Element) => void,
  router: Router,
) {
  const payload = takePayload();
  await router.ready;
  if (!payload) {
    runInFrame(undefined, () => {
      app(container);
    });

    return;
  }

  setServerData(payload.data);
  enableServerData(payload.dataRoutes);
  setCreationHook(claimsFor(container, payload.frames));
  withHydration('r', () => {
    runInFrame(undefined, () => {
      app(container);
    });
  });
  await whenSettledHydration();
  setCreationHook(undefined);
  // Page data is available during setup and can now be released.
  setServerData({});
}

import { runInFrame } from '../core/owner.ts';
import { type RenderScope, whenSettled, withScope } from '../core/scope.ts';
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

  // Empty text nodes do not survive HTML, so the server left a comment in their place.
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

function claimsFor(container: Node, scopes: Payload['scopes']) {
  // Resolve every path before app code runs: positions shift as soon as it moves nodes.
  const pending = new Map<string, (Node[] | undefined)[]>();
  for (const [key, entries] of Object.entries(scopes)) {
    pending.set(
      key,
      entries.map((entry) => resolveEntry(container, entry)),
    );
  }
  const taken = new WeakMap<RenderScope, (Node[] | undefined)[]>();

  return {
    claim(scope: RenderScope, index: number) {
      let claims = taken.get(scope);
      if (!claims) {
        claims = pending.get(scope.key);
        if (!claims) {
          return;
        }
        // Each scope hydrates once; later renders with the same key create fresh views.
        pending.delete(scope.key);
        taken.set(scope, claims);
      }

      return claims[index];
    },
  };
}

/**
 * Starts the app on the client. With a server payload in the page, views
 * created by `engine-ts/html` adopt the server-rendered nodes at their
 * recorded `childNodes` paths instead of creating new ones; without one, the
 * app is simply mounted. Resolves once lazy pages have hydrated too; then
 * unclaimed server nodes are released and view creation stops checking for claims.
 * @param container Element the server rendered the app into.
 * @param app Same app function the server rendered.
 * @param router The app's router.
 */
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
  setCreationHook(claimsFor(container, payload.scopes));
  withScope('r', () => {
    runInFrame(undefined, () => {
      app(container);
    });
  });
  await whenSettled();
  setCreationHook(undefined);
  // Page data is for setup only; the page has settled.
  setServerData({});
}

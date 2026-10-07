import { parseHTML } from 'linkedom';
import { runInFrame } from '../core/frame.ts';
import { withHydration, whenSettledHydration } from '../core/hydration.ts';
import { destroy } from '../core/tree.ts';
import { setCreationHook } from '../html/create.ts';
import type { Router } from '../router/router.ts';
import { setServerData } from '../ssr/data.ts';
import { suspendServerData } from '../ssr/load.ts';
import { PAYLOAD_ID, type Payload } from '../ssr/payload.ts';

export type RenderOptions = {
  template: string;
  containerId: string;
  router: Router;
  app: (container: Element) => void;
  timeout: number;
};

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;
/** Tags where placeholder comments would become visible text. */
const RAW_TEXT = new Set([
  'SCRIPT',
  'STYLE',
  'TEXTAREA',
  'TITLE',
  'XMP',
  'IFRAME',
  'NOEMBED',
  'NOFRAMES',
  'PLAINTEXT',
  'TEMPLATE',
]);

let queue: Promise<unknown> = Promise.resolve();

/** Serializes renders because they share document, router, and page data state. */
function locked<T>(run: () => Promise<T>): Promise<T> {
  const result = queue.then(run, run);
  queue = result.catch(() => {});

  return result;
}

/** Adds placeholders so adjacent and empty text nodes survive HTML parsing. */
function normalize(parent: Node, replaced: Map<Node, Node>) {
  let previousIsText = false;
  // Copy live childNodes before inserting or replacing entries.
  // oxlint-disable-next-line unicorn/no-useless-spread
  for (const child of [...parent.childNodes]) {
    if (child.nodeType === TEXT_NODE) {
      if ((child as Text).data === '') {
        const placeholder = child.ownerDocument!.createComment('');
        (child as ChildNode).replaceWith(placeholder);
        replaced.set(child, placeholder);
        previousIsText = false;
        continue;
      }
      if (previousIsText) {
        (child as ChildNode).before(child.ownerDocument!.createComment(''));
      }
      previousIsText = true;
      continue;
    }

    previousIsText = false;
    if (
      child.nodeType === ELEMENT_NODE &&
      !RAW_TEXT.has((child as Element).tagName)
    ) {
      normalize(child, replaced);
    }
  }

  return replaced;
}

/** Collects paths for wanted nodes in one tree walk. */
function collectPaths(
  parent: Node,
  prefix: string,
  wanted: Set<Node>,
  paths: Map<Node, string>,
) {
  for (const [position, child] of parent.childNodes.entries()) {
    const path = prefix ? `${prefix}.${position}` : String(position);
    if (wanted.has(child)) {
      paths.set(child, path);
    }
    if (child.firstChild) {
      collectPaths(child, path, wanted, paths);
    }
  }
}

function serializeHydrationPath(
  container: Element,
  recorded: Map<string, Node[][]>,
) {
  const replaced = normalize(container, new Map());
  const wanted = new Set<Node>();
  for (const creations of recorded.values()) {
    for (const nodes of creations) {
      for (const node of nodes) {
        wanted.add(replaced.get(node) ?? node);
      }
    }
  }
  const paths = new Map<Node, string>();
  collectPaths(container, '', wanted, paths);

  const frames: Payload['frames'] = {};
  for (const [key, creations] of recorded) {
    const entries = creations.map((nodes) => {
      const parts: string[] = [];
      for (const node of nodes) {
        const path = paths.get(replaced.get(node) ?? node);
        if (path === undefined) {
          return null;
        }
        parts.push(replaced.has(node) ? `~${path}` : path);
      }

      return parts.join('|');
    });
    while (entries.length > 0 && entries.at(-1) === null) {
      entries.pop();
    }
    if (entries.length > 0) {
      frames[key] = entries;
    }
  }

  return frames;
}

function timeoutAfter(ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const promise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Render did not settle within ${ms}ms`));
    }, ms);
  });

  return {
    promise,
    cancel: () => {
      clearTimeout(timer);
    },
  };
}

/** Renders a page into the template and embeds its hydration payload. */
export function renderPage(
  url: URL,
  data: Record<string, unknown>,
  dataRoutes: number[],
  preloads: readonly string[],
  options: RenderOptions,
) {
  return locked(async () => {
    const { document } = parseHTML(options.template);
    const container = document.querySelector(`#${options.containerId}`);
    if (!container) {
      throw new Error(
        `Template has no element with id "${options.containerId}"`,
      );
    }

    const frame = globalThis as { document?: unknown };
    const previousDocument = frame.document;
    frame.document = document;
    const recorded = new Map<string, Node[][]>();
    setCreationHook({
      record(hydration, index, nodes) {
        let creations = recorded.get(hydration.key);
        if (!creations) {
          creations = [];
          recorded.set(hydration.key, creations);
        }
        creations[index] = nodes;
      },
    });
    setServerData(data);
    suspendServerData(true);

    const timeout = timeoutAfter(options.timeout);
    try {
      await Promise.race([
        options.router.go(url.pathname + url.search),
        timeout.promise,
      ]);
      withHydration('r', () => {
        runInFrame(undefined, () => {
          options.app(container);
        });
      });
      await Promise.race([whenSettledHydration(), timeout.promise]);

      const payload: Payload = {
        path: url.pathname,
        data,
        frames: serializeHydrationPath(container, recorded),
        dataRoutes,
      };
      const script = document.createElement('script');
      script.setAttribute('type', 'application/json');
      script.setAttribute('id', PAYLOAD_ID);
      // Escape `<` so serialized data cannot close the script element.
      script.textContent = JSON.stringify(payload).replaceAll('<', '\\u003c');
      document.body.append(script);
      for (const href of preloads) {
        const link = document.createElement('link');
        link.setAttribute('rel', 'modulepreload');
        link.setAttribute('href', href);
        document.head.append(link);
      }

      return `<!DOCTYPE html>${document.documentElement.outerHTML}`;
    } finally {
      timeout.cancel();
      destroy(container);
      setCreationHook(undefined);
      setServerData({});
      suspendServerData(false);
      if (previousDocument === undefined) {
        delete frame.document;
      } else {
        frame.document = previousDocument;
      }
    }
  });
}

import { vi } from 'vitest';
import {
  attach,
  component,
  domRenderer,
  setRenderer,
  withFrame,
} from '../../src/core/index.ts';
import { html, text } from '../../src/html/index.ts';
import {
  createOutlet,
  memoryHistory,
  setupRouter,
  type Route,
} from '../../src/router/index.ts';
import {
  createServer,
  memoryCache,
  type ServerRoute,
} from '../../src/server/index.ts';
import { loadServerData, serverToken, useServer } from '../../src/ssr/index.ts';

setRenderer(domRenderer);

export const TEMPLATE =
  '<!DOCTYPE html><html><head><title>t</title></head><body><div id="app"></div></body></html>';

type Post = { title: string; body: string };
export const PostData = serverToken<Post>('post');

export const settle = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 10);
  });

export function setupApp(
  postConfig: Omit<ServerRoute, 'route'> = {},
  serverOptions: Partial<Parameters<typeof createServer>[0]> = {},
) {
  const Home: Route = { path: '/' };
  const PostRoute: Route = { path: /\/posts\/(?<id>\w+)/u };
  const Missing: Route = { path: /.*/u };
  const routes = [Home, PostRoute, Missing];
  const router = setupRouter(routes, {
    history: memoryHistory('/'),
    load: loadServerData(routes),
  });

  const PostPage = component(() => {
    const post = useServer(PostData);
    const title = html`<h1>${post.title}</h1>`;
    const status = text('');
    // prettier-ignore
    const node = html`<article>${title}${status}<p>${post.body}</p></article>`;
    // The outlet keeps this page across post navigations; the page follows the route itself.
    router.route(PostRoute, () => {
      title.textContent = useServer(PostData).title;
    });

    return { node };
  });

  const HomePage = component(() => ({
    node: html`<main>home</main>`,
  }));
  const MissingPage = component(() => ({
    node: html`<p>Not found</p>`,
  }));

  function App(container: Element) {
    withFrame(container, () => {
      const header = html`<header>${'Blog'}</header>`;
      container.append(header);
      attach(container, header);
      const page = createOutlet();
      router.route(Home, () => page.show(HomePage));
      router.route(PostRoute, () =>
        page.show(() => Promise.resolve({ default: PostPage })),
      );
      router.route(Missing, () => page.show(MissingPage));
    });
  }

  const loads = vi.fn();
  const serverRoutes: ServerRoute[] = [
    {
      route: PostRoute,
      load: ({ params }, set) => {
        loads();
        const id = params?.groups?.id ?? '';
        set(PostData, {
          title: `Post ${id}`,
          body: `<script>alert("${id}")</script></script>`,
        });
      },
      ...postConfig,
    },
    { route: Missing, status: 404 },
  ];
  const server = createServer({
    template: TEMPLATE,
    router,
    routes,
    serverRoutes,
    app: App,
    cache: memoryCache(),
    ...serverOptions,
  });

  return { router, routes, App, server, loads };
}

export const get = (
  server: ReturnType<typeof setupApp>['server'],
  path: string,
) => server.handle(new Request(`http://localhost${path}`));

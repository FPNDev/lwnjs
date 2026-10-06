import type { ServerRoute } from 'lwnjs/server';
import { collection, featuredCollections, orders, product, user } from './api';
import {
  CollectionData,
  FeaturedData,
  OrdersData,
  ProductData,
  UserData,
} from './data';
import {
  AccountRoute,
  CollectionRoute,
  HomeRoute,
  NotFoundRoute,
  OrdersRoute,
  ProductRoute,
  SearchRoute,
} from './routes';

/** The signed-in user, from a cookie. A real app would verify a session here. */
function userId(request?: Request) {
  const match = /(?:^|;\s*)user=(\d+)/u.exec(
    request?.headers.get('cookie') ?? '',
  );

  return match ? Number(match[1]) : 1;
}

/**
 * Server-only: imported by entry-server.ts, never by the client bundle.
 *
 * How to choose a mode:
 * - ssg: the same for everyone and rarely changes (home, the search shell).
 * - isr: the same for everyone but changes over time (prices, stock): serve
 *   from cache, re-render in the background after `revalidate` seconds.
 * - ssr: depends on the request (cookies, the signed-in user). Never cached.
 * - client: per-visitor and interactive (search results, the cart): not
 *   server data at all, the browser fetches or stores it.
 */
export const serverRoutes: ServerRoute[] = [
  {
    route: HomeRoute,
    mode: 'ssg',
    paths: () => ['/'],
    load: async (_, set) => {
      set(FeaturedData, await featuredCollections());
    },
  },
  {
    route: CollectionRoute,
    mode: 'isr',
    revalidate: 300,
    paths: async () => {
      const featured = await featuredCollections();
      const paths: string[] = [];
      for (const item of featured) {
        paths.push(`/collections/${item.handle}`);
      }

      return paths;
    },
    load: async ({ params }, set) => {
      set(CollectionData, await collection(params?.groups?.handle ?? ''));
    },
    preload: ['src/pages/Collection.ts'],
  },
  {
    route: ProductRoute,
    mode: 'isr',
    revalidate: 60,
    // Prerender the featured products; the rest render on first request and are cached after.
    paths: async () => {
      // A product can sit in several collections: a Set keeps one path each.
      const paths = new Set<string>();
      for (const item of await featuredCollections()) {
        for (const featured of item.products) {
          paths.add(`/products/${featured.handle}`);
        }
      }

      return [...paths];
    },
    load: async ({ params }, set) => {
      set(ProductData, await product(params?.groups?.handle ?? ''));
    },
    preload: ['src/pages/Product.ts'],
  },
  {
    route: SearchRoute,
    mode: 'ssg',
    paths: () => ['/search'],
    preload: ['src/pages/Search.ts'],
  },
  {
    // The layout's data: loaded for /account and /account/orders alike.
    route: AccountRoute,
    mode: 'ssr',
    load: async ({ request }, set) => {
      set(UserData, await user(userId(request)));
    },
    preload: ['src/account/AccountLayout.ts'],
  },
  {
    // Runs in parallel with the layout's loader.
    route: OrdersRoute,
    mode: 'ssr',
    load: async ({ request }, set) => {
      set(OrdersData, await orders(userId(request)));
    },
  },
  { route: NotFoundRoute, status: 404 },
];

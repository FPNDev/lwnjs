import type { ServerRoute } from 'lwn-js/server';
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

/** Reads the demo user ID from the request cookie. */
function userId(request?: Request) {
  const match = /(?:^|;\s*)user=(\d+)/u.exec(
    request?.headers.get('cookie') ?? '',
  );

  return match ? Number(match[1]) : 1;
}

/**
 * Server-only route data configuration.
 *
 * SSG is shared and stable. ISR is shared and periodically refreshed. SSR
 * depends on the request. Visitor-specific interactive data stays in the client.
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
    // Prerender featured products and cache other products after their first request.
    paths: async () => {
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
    // Both account pages use this request-specific user data.
    route: AccountRoute,
    mode: 'ssr',
    load: async ({ request }, set) => {
      set(UserData, await user(userId(request)));
    },
    preload: ['src/layout/AccountLayout.ts', 'src/pages/Overview.ts'],
  },
  {
    // Loads order data alongside the account layout's user data.
    route: OrdersRoute,
    mode: 'ssr',
    load: async ({ request }, set) => {
      set(OrdersData, await orders(userId(request)));
    },
  },
  { route: NotFoundRoute, status: 404 },
];

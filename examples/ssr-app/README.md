# ssr-app

A mock shop that demonstrates static generation, incremental regeneration, server rendering, client-side data, and hydration. Product and collection data comes from mock.shop. Demo users and orders come from dummyjson.

## Run

From the repository root:

```sh
npm install
npm run build
cd examples/ssr-app
npm install
npm run dev
```

Build and start the production server from this directory:

```sh
npm run build
npm start
```

## Routes and rendering

| Route                        | Mode      | Behavior                                                                                                                                        |
| ---------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| /                            | SSG       | Builds the home page at build time.                                                                                                             |
| /collections/:handle         | ISR       | Revalidates cached collection pages every 300 seconds.                                                                                          |
| /products/:handle            | ISR       | Revalidates cached product pages every 60 seconds. Featured products are generated at build time; other products render on their first request. |
| /search                      | SSG shell | Renders the search page, then fetches results in the browser as the query changes.                                                              |
| /account and /account/orders | SSR       | Loads demo user data for each request using the user cookie.                                                                                    |
| Unknown paths                | 404       | Renders the not-found page on the server.                                                                                                       |

The cart is browser-local and is populated after hydration.

## Hydration note

The server and initial client render must create the same view structure. Keep browser-only values such as local storage out of the initial structure, then apply them after hydration. The account cookie selects a sample user only; it is not authentication. Request-specific account pages are not cached.

## Source

- **src/entry-server.ts** configures the server app used by the LWN CLI.
- **src/entry-client.ts** starts client hydration.
- **src/app.ts** creates the shared header, route outlet, and route actions.
- **src/routes.ts** defines the route tree and client router.
- **src/server-routes.ts** selects rendering modes, generated paths, data loaders, revalidation intervals, and lazy-page preloads.
- **src/data.ts** declares typed server data tokens.
- **src/api.ts** fetches and maps shop, user, and order data into page models.
- **src/cart.ts** persists the browser cart and exposes its shared state.
- **src/components/Header.ts** provides site navigation and the cart control.
- **src/components/ProductCard.ts** presents a product summary.
- **src/components/CartDrawer.ts** displays the current cart.
- **src/pages/Home.ts** shows featured collections.
- **src/pages/Collection.ts** and **src/pages/Product.ts** show catalog pages.
- **src/pages/Search.ts** provides interactive client-side product search.
- **src/layout/AccountLayout.ts** provides account navigation and a nested outlet.
- **src/pages/Overview.ts** shows the selected user's account details.
- **src/pages/Orders.ts** lists that user's orders.
- **src/pages/NotFound.ts** renders the not-found page.

To exercise on-demand revalidation in production, set REVALIDATE_SECRET and send a POST request to /api/revalidate?path=/products/example&secret=your-secret.

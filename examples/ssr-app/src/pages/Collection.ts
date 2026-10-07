import { component, destroy } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { useServer } from 'lwn-js/ssr';
import type { ProductSummary } from '../api';
import { ProductCard } from '../components/ProductCard';
import { CollectionData } from '../data';
import { CollectionRoute, router } from '../routes';
import classes from '../styles/ui.module.scss';

/** Reuses the ISR page across collections and updates its product grid per route. */
const ProductGrid = component((products: ProductSummary[]) => ({
  node: html`<div class=${classes.grid}>
    ${products.map((product) => ProductCard(product))}
  </div>`,
}));

const Collection = component(() => {
  const title = html`<h1 class=${classes.title}></h1>`;
  const gridHost = html`<div></div>`;

  let grid: ReturnType<typeof ProductGrid> | undefined;
  // Route actions run after loaders, so `useServer` can read this route's data.
  router.route(CollectionRoute, () => {
    const collection = useServer(CollectionData);
    title.textContent = collection?.title ?? 'Collection not found';
    const next = ProductGrid(collection?.products ?? []);

    destroy(grid);
    gridHost.replaceChildren(next.node);
    grid = next;
  });

  return { node: html`<div>${title}${gridHost}</div>` };
});

export default Collection;

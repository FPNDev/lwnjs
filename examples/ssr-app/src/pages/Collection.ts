import { attach, destroy } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { useServer } from 'lwn-js/ssr';
import { ProductCard } from '../components/ProductCard';
import { CollectionData } from '../data';
import { CollectionRoute, router } from '../routes';
import classes from '../styles/ui.module.scss';

/**
 * ISR, lazy. Switching collections keeps this page (the outlet sees the same
 * factory); the page follows the route and swaps only its grid.
 */
export default function Collection(parent: object) {
  const title = html`<h1 class=${classes.title}></h1>`;
  const node = html`<div>${title}</div>`;
  attach(parent, node);

  let grid: HTMLElement | undefined;
  // Route actions run during setup on the first render and after each navigation's
  // data has loaded, so `useServer` is valid in them.
  router.route(CollectionRoute, () => {
    const collection = useServer(CollectionData);
    title.textContent = collection?.title ?? 'Collection not found';
    destroy(grid);
    const next = html`<div class=${classes.grid}></div>`;
    attach(node, next);
    for (const product of collection?.products ?? []) {
      next.append(ProductCard(next, product));
    }
    node.append(next);
    grid = next;
  });

  return node;
}

import { attach, listen, useStore } from 'lwnjs/core';
import { html } from 'lwnjs/html';
import { useServer } from 'lwnjs/ssr';
import type { ProductDetail } from '../api';
import { CartStore } from '../cart';
import { ProductData } from '../data';
import { ProductRoute, router } from '../routes';
import classes from '../styles/ui.module.scss';

/**
 * ISR (revalidate 60s), lazy, preloaded by the server. Going from one
 * product to another keeps this page: the same factory is showing, so the
 * outlet leaves it alone and the page updates its nodes in place from the
 * new page data. Nothing is re-created.
 */
export default function Product(parent: object) {
  const image = html<HTMLImageElement>`<img alt="" width="600" height="600" />`;
  const title = html`<h1 class=${classes.title}></h1>`;
  const price = html`<div class=${classes.price}></div>`;
  const description = html`<p class=${classes.muted}></p>`;
  const add = html`<button class=${classes.button}>Add to cart</button>`;
  const node = html`<article class=${classes.product}>${image}<div>${title}${price}${add}${description}</div></article>`;
  attach(parent, node);
  const cart = useStore(CartStore);

  let shown: ProductDetail | null = null;
  router.route(ProductRoute, () => {
    shown = useServer(ProductData);
    image.src = shown?.image ?? '';
    title.textContent = shown?.title ?? 'Product not found';
    price.textContent = shown?.price ?? '';
    description.textContent = shown?.description ?? '';
    add.hidden = !shown;
  });

  // An event handler: it uses the value read during setup, never `useServer`.
  listen(add, 'click', () => {
    if (shown) {
      cart.add(shown);
    }
  });

  return node;
}

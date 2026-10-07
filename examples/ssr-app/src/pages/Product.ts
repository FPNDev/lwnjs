import { component, listen, useStore } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { useServer } from 'lwn-js/ssr';
import type { ProductDetail } from '../api';
import { CartStore } from '../cart';
import { ProductData } from '../data';
import { ProductRoute, router } from '../routes';
import classes from '../styles/ui.module.scss';

/** Reuses the ISR page across products and updates its content from route data. */
const Product = component(() => {
  const image = html<HTMLImageElement>`<img alt="" width="600" height="600" />`;
  const title = html`<h1 class=${classes.title}></h1>`;
  const price = html`<div class=${classes.price}></div>`;
  const description = html`<p class=${classes.muted}></p>`;
  const add = html`<button class=${classes.button}>Add to cart</button>`;
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

  return {
    node: html`
      <article class=${classes.product}>
        ${image}
        <div>${title}${price}${add}${description}</div>
      </article>
    `,
  };
});

export default Product;

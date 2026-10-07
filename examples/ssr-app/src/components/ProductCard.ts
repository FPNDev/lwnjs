import { component } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import type { ProductSummary } from '../api';
import { routerLink } from '../routes';
import classes from '../styles/ui.module.scss';

export const ProductCard = component((product: ProductSummary) => {
  return {
    node: routerLink(html<HTMLAnchorElement>`
      <a class=${classes.card} href=${`/products/${product.handle}`}>
        <img
          src=${product.image}
          alt=""
          loading="lazy"
          width="480"
          height="480"
        />
        <strong>${product.title}</strong>
        <span class=${classes.muted}>${product.price}</span>
      </a>
    `),
  };
});

import { attach, component } from 'lwnjs/core';
import { html } from 'lwnjs/html';
import type { ProductSummary } from '../api';
import { routerLink } from '../routes';
import classes from '../styles/ui.module.scss';

export const ProductCard = component(
  (parent: object, product: ProductSummary) => {
    const node = html<HTMLAnchorElement>`
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
    `;
    attach(parent, node);
    routerLink(node);

    return node;
  },
);

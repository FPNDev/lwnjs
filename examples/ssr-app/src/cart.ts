import { createState, createStore } from 'lwn-js/core';
import { isServer } from 'lwn-js/ssr';
import type { ProductSummary } from './api';

export type CartLine = ProductSummary & { quantity: number };

const KEY = 'lwn-js-shop-cart';

/** Renders an empty cart on the server and restores the visitor's cart after hydration. */
function createCart() {
  const lines: CartLine[] = isServer
    ? []
    : (JSON.parse(localStorage.getItem(KEY) ?? '[]') as CartLine[]);
  const state = createState(lines);
  state.subscribe(() => {
    localStorage.setItem(KEY, JSON.stringify(lines));
  });

  return {
    state,
    count() {
      let count = 0;
      for (const line of lines) {
        count += line.quantity;
      }

      return count;
    },
    add(product: ProductSummary) {
      const line = lines.find((item) => item.handle === product.handle);
      if (line) {
        line.quantity++;
      } else {
        lines.push({ ...product, quantity: 1 });
      }
      state.notify();
    },
    remove(handle: string) {
      lines.splice(
        lines.findIndex((item) => item.handle === handle),
        1,
      );
      state.notify();
    },
  };
}

export type Cart = ReturnType<typeof createCart>;

export const CartStore = createStore(createCart);

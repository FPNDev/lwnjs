import { attach } from 'lwnjs/core';
import { html } from 'lwnjs/html';
import { useServer } from 'lwnjs/ssr';
import { ProductCard } from '../components/ProductCard';
import { FeaturedData } from '../data';
import { routerLink } from '../routes';
import classes from '../styles/ui.module.scss';

/** SSG: built once at build time. Eager, so it is in the entry chunk. */
export function Home(parent: object) {
  const node = html`<div><h1 class=${classes.title}>Featured</h1></div>`;
  attach(parent, node);

  // Read the page data once, during setup; children get plain values.
  for (const featured of useServer(FeaturedData)) {
    const more = html<HTMLAnchorElement>`<a
      href=${`/collections/${featured.handle}`}
      >View all</a
    >`;
    routerLink(more);
    const grid = html`<div class=${classes.grid}></div>`;
    for (const product of featured.products) {
      grid.append(ProductCard(node, product));
    }
    node.append(html`
      <section class=${classes.section}>
        <div class=${classes.sectionHeader}>
          <h2>${featured.title}</h2>
          ${more}
        </div>
        ${grid}
      </section>
    `);
  }

  return node;
}

import { attach } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { useServer } from 'lwn-js/ssr';
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
    
    const grid = html`<div class=${classes.grid}>
      ${featured.products.map((product) => ProductCard(node, product))}
    </div>`;

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

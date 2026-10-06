import { attach, destroy, listen } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { searchProducts } from '../api';
import { ProductCard } from '../components/ProductCard';
import classes from '../styles/ui.module.scss';

/**
 * SSG shell, client data: the page is prerendered once (input + empty grid)
 * and results come straight from the API in the browser. Search results are
 * per visitor and change with every keystroke: nothing to prerender or cache.
 */
export default function Search(parent: object) {
  const input = html<HTMLInputElement>`<input
    class=${classes.search}
    type="search"
    placeholder="Search products…"
  />`;
  const status = html`<p class=${classes.muted}>Type to search.</p>`;
  const node = html`<div>
    <h1 class=${classes.title}>Search</h1>
    ${input}${status}
  </div>`;
  attach(parent, node);

  let grid: HTMLElement | undefined;
  let latest = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const search = async (term: string) => {
    const request = ++latest;
    status.textContent = 'Searching…';
    const results = await searchProducts(term);
    if (request !== latest) {
      return;
    }
    destroy(grid);
    const next = html`<div class=${classes.grid}></div>`;
    attach(node, next);
    for (const product of results) {
      next.append(ProductCard(next, product));
    }
    node.append(next);
    grid = next;
    status.textContent = results.length > 0 ? '' : 'No results.';
  };

  listen(input, 'input', () => {
    clearTimeout(timer);
    const term = input.value.trim();
    timer = setTimeout(() => {
      if (term) {
        void search(term);
      }
    }, 250);
  });

  return node;
}

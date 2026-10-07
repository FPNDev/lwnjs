import { component, destroy, getFrame, listen, withFrame } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { searchProducts, type ProductSummary } from '../api';
import { ProductCard } from '../components/ProductCard';
import classes from '../styles/ui.module.scss';

/** Prerenders the search shell and fetches visitor-specific results in the browser. */
const ProductGrid = component((products: ProductSummary[]) => ({
  node: html`<div class=${classes.grid}>
    ${products.map((product) => ProductCard(product))}
  </div>`,
}));

const Search = component(() => {
  const input = html<HTMLInputElement>`<input
    class=${classes.search}
    type="search"
    placeholder="Search products..."
  />`;
  const status = html`<p class=${classes.muted}>Type to search.</p>`;
  const gridHost = html`<div></div>`;
  const frame = getFrame()!;

  let grid: ReturnType<typeof ProductGrid> | undefined;
  let latest = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const search = async (term: string) => {
    const request = ++latest;
    status.textContent = 'Searching...';
    const results = await searchProducts(term);
    if (request !== latest) {
      return;
    }
    destroy(grid);
    const next = withFrame(frame, () => ProductGrid(results));
    gridHost.replaceChildren(next.node);
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

  return {
    node: html`<div>
      <h1 class=${classes.title}>Search</h1>
      ${input}${status}${gridHost}
    </div>`,
  };
});

export default Search;

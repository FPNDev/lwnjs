import {
  attach,
  component,
  domRenderer,
  listen,
  setRenderer,
} from 'lwn-js/core';
import { html } from 'lwn-js/html';

// Tell the engine how to place views. Once, before anything is shown.
setRenderer(domRenderer);

/** A counter. One component owns the value, so a plain variable and a setter are all it needs. */
const Counter = component((parent: object) => {
  const value = html`<output>0</output>`;

  const decrement = html<HTMLButtonElement>`
    <button aria-label="Decrement" disabled>−</button>
  `;
  const increment = html<HTMLButtonElement>`
    <button aria-label="Increment">+</button>
  `;

  const node = html`
    <section class="counter">
      <h1>Hello, LWN</h1>
      <div class="row">${decrement}${value}${increment}</div>
      <small>Press ↑ / ↓ too</small>
    </section>
  `;
  // Join the logical tree first: everything below is owned by `node`.
  attach(parent, node);

  let count = 0;
  const setCount = (next: number) => {
    count = Math.max(0, next);
    value.textContent = String(count);
    decrement.disabled = count === 0;
  };

  // Removed automatically when the counter is destroyed, including the `window` listener.
  listen(decrement, 'click', () => {
    setCount(count - 1);
  });
  listen(increment, 'click', () => {
    setCount(count + 1);
  });
  listen(window, 'keydown', (event) => {
    if (event.key === 'ArrowUp') {
      setCount(count + 1);
    } else if (event.key === 'ArrowDown') {
      setCount(count - 1);
    }
  });

  return node;
});

const app = document.querySelector('#app')!;
app.append(Counter(app));

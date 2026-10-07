import { component, domRenderer, listen, setRenderer } from 'lwn-js/core';
import { html } from 'lwn-js/html';

// Configure view placement before mounting.
setRenderer(domRenderer);

const Counter = component(() => {
  const value = html`<output>0</output>`;

  const decrement = html<HTMLButtonElement>`
    <button aria-label="Decrement" disabled>−</button>
  `;
  const increment = html<HTMLButtonElement>`
    <button aria-label="Increment">+</button>
  `;

  let count = 0;
  const setCount = (next: number) => {
    count = Math.max(0, next);
    value.textContent = String(count);
    decrement.disabled = count === 0;
  };

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

  return {
    node: html`
      <section class="counter">
        <h1>Hello, LWN</h1>
        <div class="row">${decrement}${value}${increment}</div>
        <small>Press ↑ or ↓ to change the count</small>
      </section>
    `,
  };
});

const app = document.querySelector('#app')!;
app.append(Counter().node);

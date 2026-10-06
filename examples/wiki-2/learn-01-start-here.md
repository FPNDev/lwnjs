# 01. Start here

This page builds a small client-side app and introduces the pattern used throughout LWN. You will create a view, attach it to an owner, and update it in response to events.

## Install

~~~sh
npm install lwnjs
~~~

The package publishes ESM modules with TypeScript declarations. A bundler must support package exports. The examples use Vite, but the engine does not require a particular bundler for client-side use.

For a strict TypeScript app, these settings are a useful starting point:

~~~json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "strict": true
  }
}
~~~

## Build a counter

Create src/main.ts:

~~~ts
import { attach, component, domRenderer, listen, setRenderer } from 'lwnjs/core';
import { html } from 'lwnjs/html';

setRenderer(domRenderer);

const Counter = component((parent: object) => {
  const output = html`<output>0</output>`;
  const decrement = html<HTMLButtonElement>`<button disabled>Decrease</button>`;
  const increment = html<HTMLButtonElement>`<button>Increase</button>`;
  const node = html`
    <section>
      <h1>Counter</h1>
      ${decrement}
      ${output}
      ${increment}
    </section>
  `;

  attach(parent, node);

  let count = 0;
  const update = (next: number) => {
    count = Math.max(0, next);
    output.textContent = String(count);
    decrement.disabled = count === 0;
  };

  listen(decrement, 'click', () => {
    update(count - 1);
  });
  listen(increment, 'click', () => {
    update(count + 1);
  });

  return node;
});

const container = document.querySelector('#app')!;
container.append(Counter(container));
~~~

The page needs a mount point:

~~~html
<div id="app"></div>
~~~

The app has three parts:

- setRenderer(domRenderer) tells outlets and destroy how to place and remove DOM nodes. Set it once before an outlet shows a view.
- Counter builds a section and attaches it to the parent it receives.
- The last line mounts the returned DOM view. This direct append is normal DOM code. Logical attachment and DOM mounting are related, but separate operations.

The counter uses a plain let because only this component needs its value. The update function changes both the number and the disabled state. No shared state primitive is needed.

## Why call attach?

attach(parent, node) records ownership. It does not insert a DOM node. Once attached, the node owns resources registered during setup. If the node is destroyed, its listeners and children are cleaned up with it.

The owner-less listener form works because component() establishes a setup frame:

~~~ts
listen(increment, 'click', handler);
~~~

You can always make the owner explicit:

~~~ts
listen(node, increment, 'click', handler);
~~~

The explicit form also works later in event handlers, timers, and other callbacks.

## Run the example

The smallest working project is in [examples/hello-world](../hello-world/README.md). It adds keyboard input and shows the Vite project files.

After this counter, continue with [Components](learn-02-components.md). To learn why the listener is released automatically, read [Lifetimes and ownership](learn-03-lifetimes.md).

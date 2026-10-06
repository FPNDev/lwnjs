# 02. Components

A component is a function that creates a view and connects it to behavior. It runs once during setup. Later, event handlers or subscriptions update the specific nodes that need to change.

## A component function

```ts
import { attach, component, listen } from 'lwnjs/core';
import { html } from 'lwnjs/html';

type SearchBoxOptions = {
  onSearch(term: string): void;
};

export const SearchBox = component(
  (parent: object, options: SearchBoxOptions) => {
    const input = html<HTMLInputElement>`<input
      type="search"
      placeholder="Search"
    />`;
    const node = html`<form>${input}<button>Search</button></form>`;

    attach(parent, node);

    listen(node, 'submit', (event) => {
      event.preventDefault();
      options.onSearch(input.value.trim());
    });

    return node;
  },
);
```

The parent argument describes logical ownership. It does not have to be the view's DOM parent. The caller decides where to mount the returned view:

```ts
const search = SearchBox(appNode, { onSearch });
mainElement.append(search);
```

This separation lets the same component work inside a page, a modal, or a different renderer.

## Attach before wiring behavior

Build the component root, then attach it before making owner-less calls such as listen, subscribe, useStore, or onDestroy.

```ts
const node = html`<section></section>`;
attach(parent, node);

listen(window, 'resize', updateLayout);
onDestroy(() => {
  releaseSomething();
});
```

The setup frame uses the first attached node as its owner. Calls made after that point belong to the component root.

## Components inside components

Wrap reusable components with component() when they may use owner-less engine APIs. Each wrapped call opens a separate setup frame, so its first attached node owns its own listeners and subscriptions.

```ts
const Page = component((parent: object) => {
  const node = html`<main></main>`;
  attach(parent, node);

  const header = Header(node);
  const body = Body(node);
  node.append(header, body);

  return node;
});
```

If Header is a plain function and it attaches its root, that attachment happens in the page's active frame. Owner-less calls inside the plain function can then belong to the page. A child that needs its own lifetime should be wrapped with component().

A page shown by an outlet already receives a setup frame. Route actions and onAttach hooks also receive frames. Those functions do not need another wrapper just to use owner-less APIs.

## Pass information in, report events out

Components stay easier to reuse when they receive inputs and callbacks rather than importing details from the caller.

```ts
type TodoFormOptions = {
  onAdd(title: string): void;
};

const TodoForm = component((parent: object, options: TodoFormOptions) => {
  const input = html<HTMLInputElement>`<input />`;
  const form = html`<form>${input}<button>Add</button></form>`;
  attach(parent, form);

  listen(form, 'submit', (event) => {
    event.preventDefault();
    const title = input.value.trim();
    if (title) {
      options.onAdd(title);
      input.value = '';
    }
  });

  return form;
});
```

The form reports a title. It does not need to know which store saves it or which page will display the result.

## Return a controller when needed

A plain node is enough when the caller only mounts and destroys a component. Return a controller when the caller needs to update it later:

```ts
type CounterView = {
  node: HTMLElement;
  setValue(value: number): void;
};

const Counter = component((parent: object): CounterView => {
  const value = html`<output>0</output>`;
  const node = html`<section>${value}</section>`;
  attach(parent, node);

  return {
    node,
    setValue(next) {
      value.textContent = String(next);
    },
  };
});
```

Keep the controller focused on a few operations, such as update(data), focus(), or setTitle(text). Callbacks are inputs; a controller is an output.

## Local state belongs in the component

If only one component uses a value, store it in a local variable and update the view next to the change.

```ts
let expanded = false;

listen(toggle, 'click', () => {
  expanded = !expanded;
  details.hidden = !expanded;
});
```

Use createState when other independent parts of the app need to observe a value. The next chapter explains how owners keep those subscriptions and other work tied to the right lifetime.

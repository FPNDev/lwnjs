# hello-world

A small counter app that demonstrates a component, local state, DOM events, keyboard input, and mounting a rendered view.

## Run

From the repository root:

```sh
npm install
npm run build
cd examples/hello-world
npm install
npm run dev
```

Open the local URL printed by Vite.

## Source

- **src/main.ts** selects the DOM renderer, defines the counter, handles button and keyboard events, and mounts the component in the page.
- **index.html** provides the page and the app mount element.

The counter state stays local to its component. Its listeners are tied to the component frame and are removed when the component is destroyed.

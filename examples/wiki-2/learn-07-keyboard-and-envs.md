# 07. Keyboard input and envs

A keydown event on document reaches listeners throughout an app. Isolated envs let each component decide when it owns a key. This is useful for keeping application shortcuts quiet while an input or dialog is active.

## Create an env for the component

An env is a symbol. Isolate it when the component takes control of input, then release it when that interaction ends.

~~~ts
import { attach, component, env, listen, onDestroy } from 'lwnjs/core';
import { html } from 'lwnjs/html';

const Composer = component((parent: object, sendMessage: () => void) => {
  const input = html<HTMLTextAreaElement>`<textarea></textarea>`;
  const node = html`<div></div>`;
  node.append(input);
  attach(parent, node);

  const composerEnv = Symbol('composer');
  listen(input, 'focusin', () => {
    env.isolate(composerEnv);
  });
  listen(node, 'focusout', (event) => {
    if (!node.contains(event.relatedTarget as Node | null)) {
      env.release(composerEnv);
    }
  });
  onDestroy(() => {
    env.release(composerEnv);
  });

  listen(input, 'keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && env.isCurrent(composerEnv)) {
      event.preventDefault();
      sendMessage();
    }
  });

  return node;
});
~~~

env.isCurrent(id) is true only when id is the innermost active env. This lets a focused control take a key away from its parent.

## Let app shortcuts yield

Register an app shortcut from an attached app component. It can run only when there is no current env:

~~~ts
const App = component((parent: object, newItemInput: HTMLInputElement) => {
  const node = html`<main></main>`;
  attach(parent, node);

  listen(document, 'keydown', (event) => {
    if (event.key === 'n' && env.current === undefined) {
      newItemInput.focus();
    }
  });

  return node;
});
~~~

While a component has isolated its env, the app shortcut stays quiet. The component that owns the focused control can handle the same key.

In a real app, focus events are a convenient way to enter and leave an env. The simple-app example has an isolateOnFocus helper that listens for focusin and focusout, and releases the env when focus leaves the watched area.

## Nest an input inside a modal

A modal can own Escape while an input inside it owns Enter. Isolate the input within the modal env:

~~~ts
env.isolate(modalEnv);
env.isolate(inputEnv, modalEnv);

env.is(modalEnv);            // true while the input is current
env.isCurrent(modalEnv);     // false while the input is current
env.isCurrent(inputEnv);     // true
~~~

Use env.is(modalEnv) for Escape if it should work anywhere inside the modal. Use env.isCurrent(inputEnv) for a key the innermost control should handle.

Releasing an env also releases envs nested inside it. Releasing the input returns control to the modal.

## Release envs with their owners

An env is global module state. The engine does not automatically connect it to a node. Pair isolation with cleanup in onDestroy, as in the composer example, or use an owner-scoped helper that does this for you.

For focus helpers, make sure listeners are owned by the component that created the helper. That way they are removed if the component goes away while focused.

The [Core reference](reference-core.md) lists the env methods and their behavior.

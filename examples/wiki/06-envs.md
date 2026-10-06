# 6. Isolated envs

Keyboard input is global: a `keydown` on `document` reaches every listener. Isolated envs decide **who owns the keyboard right now**, so an input can take Enter, a modal can take Escape, and app shortcuts stay quiet while you type.

## The model

- An env is a `Symbol` that a component creates for itself.
- At most one env is **current**. It can sit inside a chain of containing envs: an input inside a modal is `[modal, input]`.
- **Each component checks its own env.** Nobody asks "who else is active"; a component asks "am I current?" or "am I active?".

```ts
import { env } from 'lwnjs/core';

const id = Symbol('composer');

env.isolate(id); // id becomes current; any other chain is released
env.isolate(id, modalId); // id becomes current, nested in modalId (if modalId is active)
env.release(id); // id and anything nested in it are released
env.isCurrent(id); // id is the innermost env
env.is(id); // id is current or contains the current env
env.current; // the innermost env, or undefined
```

| Call                         | Cost             |
| ---------------------------- | ---------------- |
| `isolate`, `release`         | O(released envs) |
| `is`, `isCurrent`, `current` | O(1)             |

## Three rules cover most apps

**1. Inputs isolate their env while focused.**

```ts
export function isolateOnFocus(
  element: HTMLElement,
  id: symbol,
  within?: symbol,
) {
  listen(element, 'focusin', () => env.isolate(id, within));
  listen(element, 'focusout', (event) => {
    if (!element.contains(event.relatedTarget as Node | null)) {
      env.release(id);
    }
  });
  onDestroy(() => env.release(id));
}
```

`focusin`/`focusout` bubble, and the `relatedTarget` check ignores focus moving inside the element.

**2. App shortcuts run only when nobody has isolated an env.**

```ts
listen(document, 'keydown', (event) => {
  if (event.key === 'n' && env.current === undefined) {
    newItemInput.focus();
  }
});
```

While an input is focused or a modal is open, `env.current` is set and the shortcut stays quiet. The focused input can even bind the same key for itself.

**3. A component's own keys check its own env.**

```ts
listen(textarea, 'keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && env.isCurrent(composerId)) {
    event.preventDefault();
    send();
  }
});
```

## Nesting: modals with inputs

A modal isolates its env when it opens. Inputs inside it isolate **within** the modal's env, so the modal stays active:

```ts
const modalId = Symbol('new chat');
env.isolate(modalId);
onDestroy(modalNode, () => env.release(modalId));

isolateOnFocus(nameInput, Symbol('name'), modalId); // [modal, name] while typing

listen(modalNode, document, 'keydown', (event) => {
  // `is`, not `isCurrent`: Escape closes the modal even while its input has focus.
  if (event.key === 'Escape' && env.is(modalId)) {
    destroy(modalNode);
  }
});
```

- While typing in the input, `env.isCurrent(nameId)` is true (Enter submits the form) and `env.is(modalId)` is true (Escape still closes).
- An app shortcut checking `env.current === undefined` stays quiet.
- When the input blurs, the chain goes back to `[modal]`.
- When the modal closes, `release(modalId)` releases it and anything nested in it.

## Siblings never stay active by accident

`env.isolate(id)` without `within`, or with a `within` that isn't active, releases everything else. Focusing an input in the sidebar while another panel's env was current leaves only the sidebar's env. Stale envs can't accumulate.

## Choosing `is` or `isCurrent`

| Question                                                            | Check                       |
| ------------------------------------------------------------------- | --------------------------- |
| Does this key belong to me, and only if nothing inside me wants it? | `env.isCurrent(myId)`       |
| Should this work anywhere inside me (Escape to close)?              | `env.is(myId)`              |
| Is this a global shortcut?                                          | `env.current === undefined` |

## Lifecycle

- Release your env with your component: `onDestroy(() => env.release(id))`. The focus helper does it for you.
- `env` is module-level: one keyboard, one env chain per page.

## Not only keyboard

Envs answer "who is in control right now". Gesture handlers, global drop zones, or "click outside to close" logic can check them the same way.

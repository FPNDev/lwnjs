import { env, listen, onDestroy } from 'lwnjs/core';

/**
 * Makes `id` the current env while focus is inside `element`, nested in
 * `within` when given (an input inside a modal). Call
 * it during setup: the listeners belong to the current owner, and the env is
 * released when the owner is destroyed.
 * @param element Element to watch.
 * @param id Env to isolate.
 * @param within Env that contains this one.
 */
export function isolateOnFocus(
  element: HTMLElement,
  id: symbol,
  within?: symbol,
) {
  listen(element, 'focusin', () => {
    env.isolate(id, within);
  });
  listen(element, 'focusout', (event) => {
    if (!element.contains(event.relatedTarget as Node | null)) {
      env.release(id);
    }
  });
  onDestroy(() => {
    env.release(id);
  });
}

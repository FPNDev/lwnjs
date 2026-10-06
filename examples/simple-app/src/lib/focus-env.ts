import { env, listen, onDestroy } from 'engine-ts/core';

/**
 * Makes `id` the current env while focus is inside `element`. Call
 * it during setup: the listeners belong to the current owner, and the env is
 * released when the owner is destroyed.
 * @param element Element to watch.
 * @param id Env to isolate.
 */
export function isolateOnFocus(element: HTMLElement, id: symbol) {
  listen(element, 'focusin', () => {
    env.isolate(id);
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

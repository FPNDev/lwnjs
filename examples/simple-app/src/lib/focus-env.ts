import { env, listen, onDestroy } from 'lwn-js/core';

/** Activates an environment while the element contains focus. */
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

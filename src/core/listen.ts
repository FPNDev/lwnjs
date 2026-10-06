import { requireOwner } from './owner.ts';
import { onDestroy } from './tree.ts';

type ListenerOrObject<E extends Event> =
  | ((event: E) => void)
  | { handleEvent(event: E): void };

type Options = boolean | AddEventListenerOptions;

/**
 * Adds an event listener that is removed when `owner` (default: the current
 * owner) is destroyed.
 * @returns A function that removes the listener early.
 */
export function listen<K extends keyof HTMLElementEventMap>(
  target: HTMLElement,
  type: K,
  listener: (this: HTMLElement, event: HTMLElementEventMap[K]) => void,
  options?: Options,
): () => void;

export function listen<K extends keyof WindowEventMap>(
  target: Window,
  type: K,
  listener: (this: Window, event: WindowEventMap[K]) => void,
  options?: Options,
): () => void;

export function listen<K extends keyof DocumentEventMap>(
  target: Document,
  type: K,
  listener: (this: Document, event: DocumentEventMap[K]) => void,
  options?: Options,
): () => void;

export function listen<E extends Event>(
  target: EventTarget,
  type: string,
  listener: ListenerOrObject<E>,
  options?: Options,
): () => void;

export function listen<K extends keyof HTMLElementEventMap>(
  owner: object,
  target: HTMLElement,
  type: K,
  listener: (this: HTMLElement, event: HTMLElementEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions,
): () => void;

export function listen<K extends keyof WindowEventMap>(
  owner: object,
  target: Window,
  type: K,
  listener: (this: Window, event: WindowEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions,
): () => void;

export function listen<K extends keyof DocumentEventMap>(
  owner: object,
  target: Document,
  type: K,
  listener: (this: Document, event: DocumentEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions,
): () => void;

export function listen<E extends Event>(
  owner: object,
  target: EventTarget,
  type: string,
  listener: ListenerOrObject<E>,
  options?: boolean | AddEventListenerOptions,
): () => void;

export function listen(...args: unknown[]) {
  // `listen(target, type, …)` has the type string second; `listen(owner, target, type, …)` third.
  const implicit = typeof args[1] === 'string';
  const owner = implicit ? requireOwner('listen') : (args[0] as object);
  const [target, type, listener, options] = (implicit ? args : args.slice(1)) as [
    EventTarget,
    string,
    EventListenerOrEventListenerObject,
    Options | undefined,
  ];
  target.addEventListener(type, listener, options);
  const remove = () => {
    target.removeEventListener(type, listener, options);
  };
  const unregister = onDestroy(owner, remove);

  return () => {
    unregister();
    remove();
  };
}

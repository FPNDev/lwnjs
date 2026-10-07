import { bindFrame, frameOf, requireFrame } from './frame.ts';
import { onDestroy } from './tree.ts';

type ListenerOrObject<E extends Event> =
  ((event: E) => void) | { handleEvent(event: E): void };

type Options = boolean | AddEventListenerOptions;

/** Adds a frame-bound listener and returns a function to remove it early. */
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
  frame: object,
  target: HTMLElement,
  type: K,
  listener: (this: HTMLElement, event: HTMLElementEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions,
): () => void;

export function listen<K extends keyof WindowEventMap>(
  frame: object,
  target: Window,
  type: K,
  listener: (this: Window, event: WindowEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions,
): () => void;

export function listen<K extends keyof DocumentEventMap>(
  frame: object,
  target: Document,
  type: K,
  listener: (this: Document, event: DocumentEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions,
): () => void;

export function listen<E extends Event>(
  frame: object,
  target: EventTarget,
  type: string,
  listener: ListenerOrObject<E>,
  options?: boolean | AddEventListenerOptions,
): () => void;

export function listen(...args: unknown[]) {
  // The explicit-frame overload adds one argument before the event type.
  const implicit = typeof args[1] === 'string';
  const frame = implicit ? requireFrame('listen') : frameOf(args[0] as object)!;
  const [target, type, listener, options] = (
    implicit ? args : args.slice(1)
  ) as [
    EventTarget,
    string,
    EventListenerOrEventListenerObject,
    Options | undefined,
  ];

  const boundListener =
    typeof listener === 'function'
      ? bindFrame(frame, listener)
      : {
          handleEvent: bindFrame(frame, listener.handleEvent.bind(listener)),
        };
  target.addEventListener(type, boundListener, options);
  const remove = () => {
    target.removeEventListener(type, boundListener, options);
  };
  const unregister = onDestroy(frame, remove);

  return () => {
    unregister();
    remove();
  };
}

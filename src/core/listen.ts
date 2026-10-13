import {
  ensureFrame,
  requireCurrent,
  setCurrent,
  DEAD,
  type Cleanup,
} from './frame.ts';
import { addCleanup, noop, unregister } from './cleanup.ts';

type ListenerOrObject<E extends Event> =
  ((event: E) => void) | { handleEvent(event: E): void };

type Options = boolean | AddEventListenerOptions;

type ListenEntry = Cleanup & {
  handleEvent(event: Event): void;
  target: EventTarget;
  type: string;
  listener: EventListenerOrEventListenerObject;
  options: Options | undefined;
};

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
  options?: Options,
): () => void;

export function listen<K extends keyof WindowEventMap>(
  frame: object,
  target: Window,
  type: K,
  listener: (this: Window, event: WindowEventMap[K]) => void,
  options?: Options,
): () => void;

export function listen<K extends keyof DocumentEventMap>(
  frame: object,
  target: Document,
  type: K,
  listener: (this: Document, event: DocumentEventMap[K]) => void,
  options?: Options,
): () => void;

export function listen<E extends Event>(
  frame: object,
  target: EventTarget,
  type: string,
  listener: ListenerOrObject<E>,
  options?: Options,
): () => void;

export function listen(
  a: object,
  b: unknown,
  c: unknown,
  d?: unknown,
  e?: unknown,
) {
  // The explicit-frame overload adds one argument before the event type.
  const implicit = typeof b === 'string';
  const frame = implicit ? requireCurrent('listen') : ensureFrame(a);
  if (frame.state & DEAD) {
    return noop;
  }

  const entry: ListenEntry = {
    dispose: disposeListen,
    owner: undefined,
    prevCleanup: undefined,
    nextCleanup: undefined,
    handleEvent,
    target: (implicit ? a : b) as EventTarget,
    type: (implicit ? b : c) as string,
    listener: (implicit ? c : d) as EventListenerOrEventListenerObject,
    options: (implicit ? d : e) as Options | undefined,
  };
  entry.target.addEventListener(entry.type, entry, entry.options);
  addCleanup(frame, entry);

  return unregister(entry);
}

function handleEvent(this: ListenEntry, event: Event) {
  const previous = setCurrent(this.owner);
  try {
    const listener = this.listener;
    if (typeof listener === 'function') {
      listener.call(event.currentTarget, event);
    } else {
      listener.handleEvent(event);
    }
  } finally {
    setCurrent(previous);
  }
}

function disposeListen(this: ListenEntry) {
  this.target.removeEventListener(this.type, this, this.options);
}

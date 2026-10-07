import { createListeners, type Subscribe } from './listeners.ts';

/** Notifies subscribers without storing a value. */
export type Emitter<T> = {
  emit(value: T): void;
  subscribe: Subscribe<T>;
};

/** Stores a value and notifies subscribers. */
export type State<T> = {
  get(): T;
  /** Sets the value and notifies subscribers. */
  set(value: T): void;
  /** Notifies subscribers with the current value. */
  notify(): void;
  subscribe: Subscribe<T>;
};

export function createEmitter<T = void>(): Emitter<T> {
  const { call, subscribe } = createListeners<T>();

  return { emit: call, subscribe };
}

export function createState<T>(initialValue: T): State<T> {
  const { call, subscribe } = createListeners<T>();
  let value = initialValue;

  return {
    get: () => value,
    set(nextValue) {
      value = nextValue;
      call(nextValue);
    },
    notify() {
      call(value);
    },
    subscribe,
  };
}

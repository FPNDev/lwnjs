# Core reference

Import these APIs from lwnjs/core.

~~~ts
import {
  attach, detach, destroy, onAttach, onDestroy, getParent, isAttached,
  component, getOwner, createState, createEmitter, createStore, attachStore,
  useStore, env, listen, setRenderer, getRenderer, domRenderer,
} from 'lwnjs/core';
~~~

## Ownership links

| API | Signature | Behavior |
|---|---|---|
| attach | attach(parent, child): void | Adds child under parent, or moves it from its old parent. Runs attach hooks. |
| detach | detach(child): void | Removes child from its parent but leaves it and its direct resources alive. Ends its attach scope. |
| destroy | destroy(node?): void | Removes the view through the current renderer, destroys descendants, and runs cleanup hooks. Undefined is ignored. |
| getParent | getParent(node): object or undefined | Returns the logical parent. |
| isAttached | isAttached(node?): boolean | True when the node has a logical parent. A root can own children and still return false. |

attach and detach are O(1) plus hooks. destroy is O(size of subtree). The ownership model does not detect cycles, so do not attach a node below itself or any descendant.

## Lifecycle hooks

- onDestroy(callback) uses the current owner; onDestroy(node, callback) names it explicitly. The callback runs once when that node is destroyed. The call returns an unregister function.
- onAttach(hook) uses the current owner; onAttach(node, hook) names it explicitly. The hook runs every time the node is attached and immediately if it is already attached.
- An attach hook receives a scope owner. The scope is destroyed at the next detach or move. A returned callback runs when the scope ends.

Destroying a node removes its own view first, then disposes descendants and hooks. Each child view is removed too, which also handles portals mounted elsewhere. Hook errors are isolated so other cleanup continues, then are rethrown asynchronously.

## Setup frames

component(setup) wraps a function in a setup frame. The first child attached in that frame becomes its implicit owner. Owner-less calls to listen, subscribe, useStore, attachStore, onDestroy, onAttach, and router listeners use that owner while setup is active.

Frames are synchronous. They are not carried through await, event handlers, timers, or subscription callbacks. Pass the owner explicitly in those contexts.

- getOwner() returns the current setup owner, or undefined.
- Capture getOwner() before an await if later asynchronous work needs an owner.

Pages shown by outlets, router actions, onAttach hooks, and app setup under hydrate or server rendering also run in frames.

## State and emitter

~~~ts
type State<T> = {
  get(): T;
  set(value: T): void;
  notify(): void;
  subscribe: Subscribe<T>;
};

type Emitter<T> = {
  emit(value: T): void;
  subscribe: Subscribe<T>;
};

type Subscribe<T> = {
  (listener: (value: T) => void): () => void;
  (owner: object, listener: (value: T) => void): () => void;
};
~~~

- createState(initialValue) stores a current value.
- set(value) replaces the value and notifies on every call. There is no equality check.
- notify() sends the current value again, useful after in-place mutation.
- createEmitter() creates an Emitter<void>. createEmitter<T>() creates an emitter for values.
- emit(value) notifies synchronously and stores no history.

Subscribe with an owner to stop automatically at destroy time. Without an explicit owner, subscribe(listener) uses the current setup owner if present. Outside a frame it is unowned. Every subscription returns an idempotent unsubscribe function.

Listeners run in subscription order. A delivery reaches listeners subscribed when delivery began, if each is still subscribed when its turn arrives. Listeners added during delivery wait for the next notification. A throwing listener does not block the remaining listeners; its error is reported asynchronously. Subscribe and unsubscribe are O(1), delivery is O(number of listeners).

## Stores

~~~ts
type Store<T> = {
  readonly init: () => T;
};

const ThemeStore = createStore(() => ({ color: 'navy' }));
const theme = attachStore(node, ThemeStore);
const sameTheme = useStore(childNode, ThemeStore);
~~~

- createStore(init) returns an identifier. The initializer runs each time the store is provided.
- attachStore(store) provides the value on the current setup owner. attachStore(node, store) names the provider explicitly.
- useStore(store) searches from the current setup owner. useStore(node, store) searches from that node.
- Lookup starts at the node itself, then walks logical parents. The nearest provider wins. Lookup is O(depth).
- The store value may be undefined. A separate presence check tracks whether the store is provided.
- Attach the consumer before lookup. For movable components, resolve parent-dependent stores in onAttach.

## Isolated environments

env holds one current symbol and an optional chain of containing symbols.

| Member | Behavior |
|---|---|
| env.isolate(id, within?) | Makes id current. If within is active, nests id inside it. Otherwise releases other envs. |
| env.release(id) | Releases id and any envs nested inside it. |
| env.is(id) | True when id is active, including as a containing env. |
| env.isCurrent(id) | True only when id is innermost. |
| env.current | Innermost symbol, or undefined. |

is and isCurrent are O(1). Isolating or releasing work is proportional to the envs removed. env is module-level state; pair it with owner cleanup.

## Event listeners

listen(target, type, listener, options?) uses the current owner. listen(owner, target, type, listener, options?) names the owner explicitly. The target can be an HTMLElement, Window, Document, or EventTarget.

Both forms return a function that removes the listener early. Destruction also removes it. The function is safe to call more than once.

## Renderers

~~~ts
type Renderer<V extends object> = {
  append(parent: V, view: V): void;
  insertBefore(anchor: V, view: V): void;
  remove(view: V): void;
};
~~~

setRenderer(renderer) sets module-level renderer state for outlets and destroy. getRenderer() returns it. domRenderer is the DOM implementation. See [HTML and renderer reference](reference-html-renderers.md).

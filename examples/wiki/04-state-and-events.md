# 4. State and events

LWN has two messaging primitives, `createState` and `createEmitter`, and one strong recommendation: **don't use them unless something needs to subscribe.**

## Start with a variable

If only one component reads a value, keep it in a `let` and update the DOM where the value changes:

```ts
let count = 0;
const setCount = (next: number) => {
  count = next;
  value.textContent = String(count);
  minus.disabled = count === 0;
};
```

No allocations, no indirection, nothing to clean up. Most component-local state (open/closed, the selected tab, the current filter, edit mode) looks like this.

## `createState`: a value others observe

Use it when **several independent components** must react to the same value, which usually means it lives in a store:

```ts
import { createState } from 'lwnjs/core';

const lists = createState<TodoList[]>([]);

lists.get();                    // current value
lists.set(nextArray);           // replace the value, notify
lists.notify();                 // notify with the current value (after mutating it)
lists.subscribe((value) => …);  // see "Owners" below
```

### Mutate, then notify

The engine never compares values. Change your data in place and announce it:

```ts
const all = lists.get();
all.push({ id, name, todos: [] });
lists.notify();

todo.done = !todo.done;
lists.notify();

presence.get().set(peerId, 'online');   // a Map
presence.notify();
```

- `set(value)` replaces the stored value and notifies, always, even with the same value.
- `notify()` re-announces the current value without a `get()`.
- There are no immutable updates and no reference checks. If you call `notify`, listeners run.

### Granularity

One state holding a whole collection is usually right: observers re-render the parts they own, and keyed lists make that cheap. Split into several states only when observers truly care about different things (presence vs contacts in a chat).

## `createEmitter`: things that happen

For events rather than values: a submit, an abort, a message arriving, a toast to show.

```ts
import { createEmitter } from 'lwnjs/core';

const messageAdded = createEmitter<Message>();
messageAdded.subscribe((message) => list.add(message));
messageAdded.emit(message);

const closed = createEmitter();   // Emitter<void>
closed.emit();
```

An emitter has no current value. Late subscribers don't get past events.

## Owners

Both primitives share one `subscribe`:

```ts
state.subscribe(owner, fn);   // ends when `owner` is destroyed
state.subscribe(fn);          // during setup: owned by the current owner
                              // outside setup: unowned, ends only via the returned function
```

Every form returns an unsubscribe function: O(1) and idempotent.

| Situation | What to write |
|---|---|
| A component reacting to a store | `store.value.subscribe(fn)` during setup |
| A subscription created later (in a handler) | `store.value.subscribe(node, fn)`, with the owner explicit |
| A store persisting itself | `value.subscribe(fn)` inside the store's `init`. It's owned by the providing component, so it lives as long as the store |
| A module-level service that lives forever | `subscribe(fn)` outside any setup: unowned |

## Delivery rules

- **Order:** listeners run in subscription order.
- **Snapshot:** a notification reaches the listeners that were subscribed when it started and are still subscribed when their turn comes:
  - Unsubscribing during a notification never skips a neighbour.
  - Listeners added during a notification wait for the next one.
- **Errors:** a throwing listener doesn't stop the others. The error is rethrown asynchronously (`queueMicrotask`), so it still reaches the console and error trackers.
- **Synchronous:** `set`, `notify` and `emit` call listeners before returning.
- **Cost:** subscribe and unsubscribe are O(1) (a linked list); a notification is O(listeners) and allocates nothing.

## Patterns

### Derived values

There is no `computed`. Derive where you render:

```ts
lists.subscribe((all) => {
  let open = 0;
  for (const list of all) {
    open += countOpen(list);
  }
  badge.textContent = String(open);
});
```

If several components need the same derived value, compute it in a store action and keep it in its own state.

### Streams that end

Return an emitter and a promise:

```ts
function download(url: string) {
  const progress = createEmitter<number>();
  const done = fetchWithProgress(url, (fraction) => progress.emit(fraction));

  return { progress, done };
}

const { progress, done } = download(url);
const stop = progress.subscribe(node, (fraction) => bar.style.width = `${fraction * 100}%`);
await done;
stop();
```

### Request/response over an emitter

Don't. Call a function and await its promise; emitters are for broadcasting.

### Avoiding notification storms

Several mutations in a row? Mutate everything, then `notify()` once:

```ts
for (const todo of list.todos) {
  todo.done = true;
}
lists.notify();
```

## Choosing

| You have | Use |
|---|---|
| A value one component reads | `let` + setter |
| A value several components observe | `createState`, usually in a store |
| Something that happens | `createEmitter` |
| A one-off async result | a `Promise` |
| A sequence that ends | an emitter + a promise |

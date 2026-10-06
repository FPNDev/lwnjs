# 04. State and stores

Use the smallest way to hold a value. A local variable is right for a value one component reads. A state or emitter is useful when independent parts of the app need to observe it. A store makes a value available to logical descendants.

## Start with a local variable

```ts
let count = 0;

const updateCount = (next: number) => {
  count = next;
  output.textContent = String(count);
};
```

The component owns both the value and the nodes that display it, so there is no need for a messaging primitive.

## Use state for an observed value

createState(initial) stores a current value and notifies subscribers when you call set or notify.

```ts
import { createState } from 'lwn-js/core';

type Todo = { id: string; title: string; done: boolean };

const todos = createState<Todo[]>([]);
todos.set([{ id: 'a', title: 'Read', done: false }]);
todos.get();
```

State does not compare old and new values. set(value) always notifies, even when the same object is passed. For in-place updates, mutate first and call notify() once:

```ts
const items = todos.get();
const nextTodo: Todo = { id: 'b', title: 'Write docs', done: false };
items.push(nextTodo);
todos.notify();
```

This is intentional. Components choose which part of the view to update. A state update does not rerun a component function.

## Use an emitter for an event

An emitter represents an event with no stored current value. Late subscribers do not receive past events.

```ts
import { createEmitter } from 'lwn-js/core';

const messageAdded = createEmitter<string>();
const seen: string[] = [];
const unsubscribe = messageAdded.subscribe((message) => {
  seen.push(message);
});
messageAdded.emit('connected');
unsubscribe();
```

Use a promise for one result. For a finite stream, return an emitter for progress and a promise for completion.

## Subscriptions belong to owners

Every subscribe call returns a function that unsubscribes early. If you pass an owner, the engine also unsubscribes when that owner is destroyed.

```ts
todos.subscribe(todoListNode, renderTodos);
```

Inside component setup, an owner can be omitted:

```ts
todos.subscribe(renderTodos);
```

Outside a setup frame, subscribe(callback) is unowned. Keep its returned unsubscribe function and call it when the listener is no longer needed. The listener runs synchronously when state changes or an event is emitted. One failing listener does not prevent the others from running.

## Share data through a store

A store is an identifier for a value provided by an owner. It is not a global singleton. Each attachStore call runs the store initializer and makes that fresh value available to the owner and its logical descendants.

```ts
import {
  attach,
  attachStore,
  component,
  createStore,
  useStore,
} from 'lwn-js/core';
import { html } from 'lwn-js/html';

const ThemeStore = createStore(() => ({ color: 'navy' }));

const App = component((parent: object) => {
  const node = html`<main></main>`;
  attach(parent, node);
  attachStore(ThemeStore);
  node.append(Panel(node));
  return node;
});

const Panel = component((parent: object) => {
  const node = html`<section>Shared theme</section>`;
  attach(parent, node);
  const theme = useStore(ThemeStore);
  node.style.color = theme.color;
  return node;
});
```

A store value can contain state, emitters, actions, or plain data. Keep domain mutations inside actions when that gives the app one clear place to maintain its rules.

useStore searches from the supplied node up through its logical parents and returns the nearest provider. Attach the consumer before resolving its store. For a component that can move between providers, resolve it in onAttach.

## A shared store in a small app

The todo example has a single TodosStore. The app provides it. The sidebar and the current list page both observe its list state. The store mutates todo objects in place and calls notify, while each component updates only its own rows and labels.

For a larger app, create stores by concern: account data, chat service, cart, or UI services. Avoid making every value global by default. A value belongs at the highest owner that needs to provide it.

## Choosing the tool

| Need                                                | Use                                |
| --------------------------------------------------- | ---------------------------------- |
| One component reads and updates a value             | Local variable and update function |
| Several owners observe a current value              | createState                        |
| Several owners need to hear that something happened | createEmitter                      |
| A descendant needs an ancestor's value or service   | Store                              |
| One asynchronous result                             | Promise                            |

For the exact listener rules and store overloads, see the [Core reference](reference-core.md).

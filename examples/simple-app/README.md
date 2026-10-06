# simple-app: todo lists

Todo lists in a sidebar, saved to localStorage and synced across tabs, styled with SCSS modules.

```sh
npm install
npm run dev
```

## Structure

```
src/
  main.ts                 setRenderer + mount
  App.ts                  layout, store provider, outlet, routes
  router.ts               routes, router, routerLink helper
  store/todos.ts          the lists: one createState + actions, persisted
  components/
    KeyedList.ts          example-local keyed view helper
    Sidebar.ts            list rows, active highlight, new-list form
    ListHeader.ts         list name + delete
    NewTodoForm.ts        new-todo input and its `n` shortcut
    TodoFilters.ts        All / Active / Done
    TodoItems.ts          todo views, filtering by `hidden`
    TodoItem.ts           one todo: toggle, inline rename, delete
    TodoFooter.ts         items left, clear done
  pages/
    ListPage.ts           lazy page: wires the store and route to the components
    Welcome.ts
  lib/focus-env.ts        isolate an env while an input has focus
  styles/_tokens.scss     variables + mixins used by every module
```

## What to look at

- **One store, two observers.** `TodosStore` holds the lists in a `createState`. The sidebar and the list page both subscribe, each with its own node as owner, so the subscriptions end when the views go away. Everything only one component cares about (the filter, edit mode, the current list id) is a plain variable.
- **Plain mutation.** Actions change the objects in place (`todo.done = !todo.done`, `todos.push(…)`) and call `lists.notify()`: no copies, no reference checks.
- **Small components, thin pages.** Each component owns its view, listeners and shortcuts and takes callbacks for what it reports. `ListPage` only connects them to the store and the route.
- **Keyed rendering example.** `components/KeyedList.ts` is a helper owned by this example, not an engine API. It keeps a `Map<id, view>`, updates retained views, and destroys views whose items disappeared. Filtering toggles `hidden` without recreating todo views. In an ordinary app, explicit add and delete actions with callbacks are often simpler; this helper stays here to demonstrate keyed reuse.
- **The logical tree is not the DOM tree.** Pages are logical children of the layout node but mounted inside `<main>`, through `createOutlet(node, slot)`.
- **Lazy page that stays.** `ListPage` loads on first visit. Switching lists keeps the same page: the outlet sees the same factory, and the page follows `ListRoute` itself.
- **Shortcuts with envs.** Focused inputs isolate an env (`lib/focus-env.ts`). The <kbd>n</kbd> shortcut in `NewTodoForm` runs only when `env.current` is `undefined`, i.e. nobody is typing.
- **Cleanup for free.** `listen(node, window, 'storage', …)` and `listen(node, document, 'keydown', …)` go away with their owners. No manual `removeEventListener`.
- **SCSS.** `_tokens.scss` holds variables and mixins (`button($variant)`, `input`, `card`, `focus-ring`); every `*.module.scss` does `@use '../styles/tokens' as *;`. `vite.config.ts` maps `.kebab-case` classes to `classes.camelCase`.

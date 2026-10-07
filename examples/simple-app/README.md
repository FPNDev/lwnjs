# simple-app

A todo app with multiple lists, filters, inline editing, browser storage, cross-tab updates, and client-side routes.

## Run

From the repository root:

```sh
npm install
npm run build
cd examples/simple-app
npm install
npm run dev
```

Open the local URL printed by Vite.

## Features

- Create and delete lists.
- Add, complete, edit, and remove todos.
- Filter todos by status and clear completed items.
- Keep data in localStorage and reload changes made in another tab.
- Navigate between the welcome page and individual lists without a full page load.

## Source

- **src/main.ts** configures the DOM renderer and mounts the app.
- **src/App.ts** provides the todo store, builds the sidebar and page outlet, and connects route actions.
- **src/router.ts** defines the home, list, and fallback routes, and provides link navigation helpers.
- **src/store/todos.ts** contains list and todo state, actions, localStorage persistence, and cross-tab updates.
- **src/pages/Welcome.ts** renders the empty-state page.
- **src/pages/ListPage.ts** composes the selected list header, form, filters, items, and footer.
- **src/components/Sidebar.ts** lists saved lists and creates new ones.
- **src/components/ListHeader.ts** displays a list name and its delete action.
- **src/components/NewTodoForm.ts** adds todos and handles the N shortcut.
- **src/components/TodoFilters.ts** selects All, Active, or Done.
- **src/components/TodoItems.ts** filters the visible todo views.
- **src/components/TodoItem.ts** toggles, edits, and deletes one todo.
- **src/components/TodoFooter.ts** displays the remaining count and clears completed todos.
- **src/components/KeyedList.ts** reuses todo views by ID as the list changes.
- **src/lib/focus-env.ts** tracks focused inputs so page shortcuts do not interrupt typing.
- **src/styles/** contains shared design tokens and component styles.

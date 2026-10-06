import { createState, createStore } from 'lwnjs/core';

export type Todo = {
  id: string;
  title: string;
  done: boolean;
};

export type TodoList = {
  id: string;
  name: string;
  todos: Todo[];
};

export const STORAGE_KEY = 'lwnjs-todos';

function read(): TodoList[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    return raw ? (JSON.parse(raw) as TodoList[]) : [];
  } catch {
    return [];
  }
}

/**
 * All todo lists, persisted to localStorage.
 * The sidebar and the list page both observe them, which is what `createState`
 * is for. Actions change the objects in place and call `notify()`.
 */
function createTodos() {
  let all = read();
  const lists = createState(all);
  // The store lives as long as the app, so this subscription needs no owner.
  lists.subscribe((value) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  });

  const changed = () =>{  lists.notify(); };
  const find = (id: string) => all.find((list) => list.id === id);
  const findTodo = (listId: string, todoId: string) => find(listId)!.todos.find((todo) => todo.id === todoId)!;

  return {
    lists,
    find,
    /** Re-reads storage, e.g. after another tab changed it. */
    reload() {
      all = read();
      lists.set(all);
    },
    addList(name: string) {
      const list: TodoList = { id: crypto.randomUUID().slice(0, 8), name, todos: [] };
      all.push(list);
      changed();

      return list;
    },
    removeList(id: string) {
      all.splice(all.indexOf(find(id)!), 1);
      changed();
    },
    addTodo(listId: string, title: string) {
      find(listId)!.todos.push({ id: crypto.randomUUID(), title, done: false });
      changed();
    },
    toggleTodo(listId: string, todoId: string) {
      const todo = findTodo(listId, todoId);
      todo.done = !todo.done;
      changed();
    },
    renameTodo(listId: string, todoId: string, title: string) {
      findTodo(listId, todoId).title = title;
      changed();
    },
    removeTodo(listId: string, todoId: string) {
      const { todos } = find(listId)!;
      todos.splice(todos.indexOf(findTodo(listId, todoId)), 1);
      changed();
    },
    clearDone(listId: string) {
      // Compact in place: keep the open todos at the front, then cut the tail.
      const { todos } = find(listId)!;
      let kept = 0;
      for (const todo of todos) {
        if (!todo.done) {
          todos[kept++] = todo;
        }
      }
      todos.length = kept;
      changed();
    },
  };
}

export type Todos = ReturnType<typeof createTodos>;

/** Number of todos not done yet. */
export function countOpen(list: TodoList) {
  let open = 0;
  for (const todo of list.todos) {
    if (!todo.done) {
      open++;
    }
  }

  return open;
}

/** Provided by the app root; any component below finds it with `useStore`. */
export const TodosStore = createStore(createTodos);

import { createState, createStore } from 'lwn-js/core';

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

export const STORAGE_KEY = 'lwn-js-todos';

function read(): TodoList[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    return raw ? (JSON.parse(raw) as TodoList[]) : [];
  } catch {
    return [];
  }
}

/** Creates shared todo state and its persistence subscription. */
function createTodos() {
  let all = read();
  const lists = createState(all);
  // Keep persistence subscribed for the lifetime of the shared store.
  lists.subscribe((value) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  });

  const changed = () => {
    lists.notify();
  };
  const find = (id: string) => all.find((list) => list.id === id);
  const findTodo = (listId: string, todoId: string) =>
    find(listId)!.todos.find((todo) => todo.id === todoId)!;

  return {
    lists,
    find,
    /** Reloads lists from localStorage. */
    reload() {
      all = read();
      lists.set(all);
    },
    addList(name: string) {
      const list: TodoList = {
        id: crypto.randomUUID().slice(0, 8),
        name,
        todos: [],
      };
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
      // Compact the list before truncating completed items.
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

export function countOpen(list: TodoList) {
  let open = 0;
  for (const todo of list.todos) {
    if (!todo.done) {
      open++;
    }
  }

  return open;
}

/** Shared todo data provided by the app. */
export const TodosStore = createStore(createTodos);

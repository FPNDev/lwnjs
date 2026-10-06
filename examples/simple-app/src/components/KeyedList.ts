import { destroy } from 'engine-ts/core';

export type KeyedView<Item> = {
  node: Node;
  update(item: Item): void;
};

type Entry<View> = {
  view: View;
  pass: number;
};

/**
 * Example-only helper that keeps views for items with stable keys.
 * The engine provides ownership and destruction; this example chooses the
 * optional policy of reusing views by key.
 */
export function createKeyedList<Item, Key, View extends KeyedView<Item>>(
  owner: object,
  container: ParentNode,
  keyOf: (item: Item) => Key,
  create: (owner: object, item: Item) => View,
) {
  const entries = new Map<Key, Entry<View>>();
  let pass = 0;

  return {
    render(
      items: Iterable<Item>,
      afterUpdate?: (view: View, item: Item) => void,
    ) {
      const currentPass = ++pass;

      for (const item of items) {
        const key = keyOf(item);
        let entry = entries.get(key);

        if (entry) {
          entry.pass = currentPass;
        } else {
          const view = create(owner, item);
          entry = { view, pass: currentPass };
          entries.set(key, entry);
          container.append(view.node);
        }

        entry.view.update(item);
        afterUpdate?.(entry.view, item);
      }

      for (const [key, entry] of entries) {
        if (entry.pass !== currentPass) {
          destroy(entry.view.node);
          entries.delete(key);
        }
      }
    },

    get(key: Key) {
      return entries.get(key)?.view;
    },

    clear() {
      for (const entry of entries.values()) {
        destroy(entry.view.node);
      }
      entries.clear();
    },
  };
}

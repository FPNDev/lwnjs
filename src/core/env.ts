/** Tracks nested keyboard environments. */
const path: symbol[] = [];
const depths = new Map<symbol, number>();

function truncate(length: number) {
  while (path.length > length) {
    depths.delete(path.pop()!);
  }
}

export const env = {
  /** Activates `id`, optionally inside another environment. */
  isolate(id: symbol, within?: symbol) {
    if (id === within) {
      return;
    }

    const existingDepth = depths.get(id);
    if (existingDepth !== undefined) {
      truncate(existingDepth);
    }

    const withinDepth = within === undefined ? undefined : depths.get(within);
    truncate(withinDepth === undefined ? 0 : withinDepth + 1);

    depths.set(id, path.length);
    path.push(id);
  },

  /** Releases `id` and its nested environments. */
  release(id: symbol) {
    const depth = depths.get(id);
    if (depth !== undefined) {
      truncate(depth);
    }
  },

  /** Checks whether `id` is active or contains the active environment. */
  is(id: symbol) {
    return depths.has(id);
  },

  /** Checks whether `id` is the active innermost environment. */
  isCurrent(id: symbol) {
    return path.at(-1) === id;
  },

  get current() {
    return path.at(-1);
  },
};

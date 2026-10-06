/**
 * Isolated envs: one env is current at a time, optionally nested inside
 * another (an input inside a modal). Components keep their own `Symbol()` and
 * ask whether it is active (`is`) or innermost (`isCurrent`).
 */
const path: symbol[] = [];
const depths = new Map<symbol, number>();

function truncate(length: number) {
  while (path.length > length) {
    depths.delete(path.pop()!);
  }
}

export const env = {
  /**
   * Makes `id` the current env. If `within` is active, `id` nests inside it
   * and `within` stays active; otherwise every other env is released.
   * O(released envs).
   * @param id Env to isolate.
   * @param within Env that contains `id`.
   */
  isolate(id: symbol, within?: symbol) {
    const existingDepth = depths.get(id);
    if (existingDepth !== undefined) {
      truncate(existingDepth);
    }

    const withinDepth = within === undefined ? undefined : depths.get(within);
    truncate(withinDepth === undefined ? 0 : withinDepth + 1);

    depths.set(id, path.length);
    path.push(id);
  },

  /**
   * Releases `id` and every env nested inside it; its container becomes current.
   * @param id Env to release.
   */
  release(id: symbol) {
    const depth = depths.get(id);
    if (depth !== undefined) {
      truncate(depth);
    }
  },

  /** @returns Whether `id` is current or contains the current env. O(1). */
  is(id: symbol) {
    return depths.has(id);
  },

  /** @returns Whether `id` is the innermost (current) env. O(1). */
  isCurrent(id: symbol) {
    return path.at(-1) === id;
  },

  /** The innermost env, if any. */
  get current() {
    return path.at(-1);
  },
};

export type RouteParams = RegExpMatchArray | null;

/** A path entry with optional guards and nested routes. */
export type Route = {
  /** String paths join their parents with `/`; RegExp paths are concatenated as is. A child with `''` is an index route: it matches the parent's exact path. */
  path: string | RegExp;
  /** Must pass (truthy) for this route to be the final match. */
  guard?(params: RouteParams): unknown;
  /** Must pass (truthy) before this route's children are searched. */
  guardChildren?(params: RouteParams): unknown;
  children?: readonly Route[];
  /** Set by `aliasRoute`: listeners of the original route also fire for the alias. */
  aliasOf?: Route;
};

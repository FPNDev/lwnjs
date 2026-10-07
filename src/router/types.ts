export type RouteParams = RegExpMatchArray | null;

/** A route path with optional guards and child routes. */
export type Route = {
  /** String paths join parent paths; regular expressions concatenate, and an empty child path matches its parent exactly. */
  path: string | RegExp;
  /** Must return a truthy value for this route to match. */
  guard?(params: RouteParams): unknown;
  /** Must return a truthy value before matching child routes. */
  guardChildren?(params: RouteParams): unknown;
  children?: readonly Route[];
  /** Set by aliasRoute so original route listeners also run for this route. */
  aliasOf?: Route;
};

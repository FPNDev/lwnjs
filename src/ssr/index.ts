export { serverToken, useServer } from './data.ts';
export type { ServerToken } from './data.ts';
export { hydrate } from './hydrate.ts';
export { loadServerData } from './load.ts';

/** Whether the current runtime has no browser window. */
export const isServer = typeof window === 'undefined';

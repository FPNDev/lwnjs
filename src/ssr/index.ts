export { serverToken, useServer } from './data.ts';
export type { ServerToken } from './data.ts';
export { hydrate } from './hydrate.ts';
export { loadServerData } from './load.ts';

/** Whether this code runs without a browser `window` (server render, build). */
export const isServer = typeof window === 'undefined';

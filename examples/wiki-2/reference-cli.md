# CLI reference

The CLI is the package's Node server workflow. It uses Vite to serve the app in development, bundle the client and server for production, prerender configured pages, and start a production server.

## Commands

```sh
lwn dev
lwn build
lwn start
```

With no command, `lwn` runs `dev`. Flags may also come first, which still selects development mode.

| Command | What it does                                                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `dev`   | Starts a Vite middleware server. It serves client assets, renders requests from source, and reloads the server entry after source changes. |
| `build` | Builds the client with a Vite manifest, builds the server entry, then prerenders every configured SSG and ISR path.                        |
| `start` | Starts the production Node server. It serves client assets, pages, and page data from the build output.                                    |

The project needs an `index.html`, Vite configuration, and a server entry whose default export is created with `defineServerApp(...)`. The default server entry path is `src/entry-server.ts`.

## Options

| Option                                                          | Meaning                                                          | Default                                  |
| --------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------- |
| `--root <path>`                                                 | Project directory containing `index.html` and Vite configuration | Current working directory                |
| `--entry <path>`                                                | Server entry, relative to root                                   | `src/entry-server.ts`                    |
| `--out-dir <path>` or `--outDir <path>`                         | Build output directory, relative to root                         | `dist`                                   |
| `--port <number>`                                               | HTTP port                                                        | `PORT` environment variable, then `3000` |
| `--host <host>`                                                 | Interface or hostname to listen on                               | Node and Vite defaults                   |
| `--revalidate-secret <secret>` or `--revalidateSecret <secret>` | Secret for on-demand ISR                                         | `REVALIDATE_SECRET` environment variable |
| `--help`                                                        | Print usage                                                      | Not applicable                           |

Options accept separate values or an equals sign.

```sh
lwn dev --root ./examples/shop --port 4173
lwn build --root ./examples/shop --out-dir ./output
lwn start --root ./examples/shop --port=8080
```

The parser rejects unknown commands and options, missing values, non-numeric ports, and ports above 65,535. Omitting the command is equivalent to `dev`.

## Development

```sh
lwn dev
```

The development command starts Vite in middleware mode and serves the app over Node HTTP. Vite handles client modules and assets. The server entry is loaded from source for each rebuild. The server app renders the page using the current `index.html` template.

Set `--root` when invoking the CLI outside the project directory. `--entry` is resolved relative to that root.

## Production build

```sh
lwn build
```

The build produces separate client and server directories:

```text
dist/
  client/
    index.html
    assets/
    .vite/manifest.json
    ...prerendered pages
  server/
    entry-server.js
    template.html
```

The client build writes the Vite manifest used to preload route modules. The server build bundles the server entry. The CLI saves an untouched copy of the built HTML template as `dist/server/template.html`, then prerenders every `paths()` value declared by an SSG or ISR server route into `dist/client`.

The output is static-hosting friendly. Each rendered path uses an `index.html` and `__data.json` pair. The root page is written to `dist/client/index.html`. The preserved template under `dist/server` lets the runtime render later requests without trying to use the already-rendered root page as a template.

If an SSG or ISR route has no `paths` function, the build does not prerender its URLs. The first request to such a path can still render and cache it when the production server runs.

## Production server

```sh
lwn start
```

The production command loads the server bundle and manifest, uses the client output as the ISR file cache, and serves static assets from the client directory. Files under `/assets/` receive an immutable one-year cache header, so use hashed asset names there.

The server listens on `PORT` or port 3000 by default. Set `--host` to choose the listening interface.

## On-demand revalidation

Set a secret with the CLI option or `REVALIDATE_SECRET`. The Node adapter then enables `POST /api/revalidate?path=/products/tea&secret=...`. A successful request waits for that path to be regenerated and returns JSON containing the path. Requests with the wrong secret receive status 401.

This endpoint is available only when a secret is configured. Revalidation refreshes cached SSG or ISR content. It does not change SSR pages, which render on every request.

## Dependencies and hosting

The CLI imports Vite at runtime. The server rendering path uses linkedom to provide a DOM on Node. These are optional peer dependencies in the package manifest, so install the ones needed by the parts of the application you use.

For an Express-style server or custom host, use `createServer` and `toNodeHandler` from `lwn-js/server` directly. See [Server reference](reference-server.md).

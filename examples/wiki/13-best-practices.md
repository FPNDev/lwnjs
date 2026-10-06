# 13. Best practices

## Structure

- **Small components, thin pages.** A component owns its view, its listeners and its keyboard handling, and takes callbacks for what it reports (`NewTodoForm(parent, onAdd)`). A page only connects components to stores and routes.
- **Wrap components in `component()`** so owner-less calls belong to them. Pages shown by outlets and route actions don't need it.
- **One module for routes.** Route objects are identities: define them once and import them everywhere.
- **Server-only code in server-only modules:** loaders, server routes, secrets. The client bundle never imports them.
- **Stores per concern,** provided at the highest component that needs them. Expose actions, not raw setters.
- **Services are logical nodes too.** A connection attached to a service root closes on `destroy`; a page that opens a socket owns it.

## State

- **Plain variables first.** `createState` is for values several independent components observe; `createEmitter` is for events.
- **Mutate in place, then `notify()` once.** No copies to "signal" a change, no reference checks.
- **Read once during setup.** Read stores and server data once and keep the references or values; handlers use those.

## Rendering

- **Change only what changes.** Keep references to the nodes you update (`title.textContent = …`). Never rebuild a view to update it.
- **Keyed lists** with a `Map<id, view>` and mark-and-sweep. Create new items, destroy removed ones, update the rest in place, and move only rows that are out of place.
- **Filter by `hidden`,** not by re-creating.
- **Batch DOM writes:** build detached subtrees and append once (`list.append(...nodes)`).
- **Use templates for structure,** not `innerHTML` with interpolated strings. Templates are cached per call site and can't inject markup.

## Ownership

- **`attach(parent, node)` first thing,** right after building the root.
- **Every global listener goes through `listen`:** `window`, `document`, `matchMedia`, `ResizeObserver` callbacks wrapped in `onDestroy`.
- **Timers:** `const timer = setInterval(…); onDestroy(() => clearInterval(timer));`.
- **Portals:** `attach(owner, view)` plus mounting it wherever it belongs. Closing with the owner is automatic.
- **Moving components:** `attach(newParent, node)` plus a DOM move. Re-read location-dependent things in `onAttach`, from the node.
- **Group with plain objects** when a set of things must end together without a view of their own.

## Async code

- **Capture what you need before the first `await`:** the owner (`getOwner()`), store references, server data.
- **Check that the owner is still alive** when an async result arrives late, if it matters: route-level work is already guarded by outlets (latest wins), so this is mostly needed for your own fetches.
- **Latest-wins for your own requests:** keep a counter and ignore stale responses.

```ts
let latest = 0;
async function search(term: string) {
  const request = ++latest;
  const results = await api.search(term);
  if (request === latest) {
    render(results);
  }
}
```

## Keyboard

- **Inputs isolate an env while focused.**
- **App shortcuts run when `env.current === undefined`.**
- **A component's own keys check its own env** (`env.isCurrent(myId)`).
- **A modal's Escape uses `env.is(modalId)`,** so it works while its inputs have focus.

## Routing

- **Pages that stay across params follow their route** instead of being re-created.
- **Layouts own an outlet and their child routes,** with an index route (`path: ''`) for the default child.
- **Lazy-load pages,** keep the shell eager.
- **Real anchors** with a click helper, so middle-click and copy-link keep working.

## Server rendering

- **Pick the mode from the data:**
  - the same for everyone → `ssg`/`isr`,
  - request-dependent → `ssr`,
  - visitor-dependent → client.
- **Loaders return small, page-shaped objects.**
- **`preload` lazy page modules** and pass the Vite manifest.
- **Client-only differences change text, not structure.**
- **No randomness, time or storage reads** where views are created.

## Performance notes

| Operation | Cost |
|---|---|
| attach / detach / move | O(1) + hooks |
| destroy | O(subtree), one live DOM mutation |
| subscribe / unsubscribe / owner release | O(1) |
| emit / set / notify | O(listeners), no allocations |
| env `is` / `isCurrent` / `current` | O(1) |
| `useStore` | O(depth), once per setup |
| `html` (cached) | clone + O(slots) |
| route dispatch | O(depth of the active chain) |
| route match | O(routes), precompiled |
| hydration claim / `useServer` | O(1) after one resolve pass |

## Checklist for a new component

- [ ] Wrapped in `component()` (unless it's a page shown by an outlet)
- [ ] `attach(parent, node)` right after building the root
- [ ] Global listeners through `listen`, timers cleared in `onDestroy`
- [ ] Store and server data read once during setup
- [ ] Callbacks in, controller out (when the caller needs to drive it)
- [ ] Mounting left to the caller

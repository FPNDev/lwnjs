# complex-app: peer-to-peer encrypted chat

Chat directly between browsers over WebRTC, end-to-end encrypted, with history in IndexedDB.

Requires HTTPS for Cryptography functionality - run ngrok with your account
to test on remote devices

```sh
npm install
npm run dev

# Must run for mobile testing, since 192.168.x.x is not a secure context
# Add your domain to server.allowedHosts in vite.config.ts
ngrok http 5173
```

Open the app in two browsers (or a normal and a private window). Copy the ID from one, then in the other press <kbd>Ctrl</kbd> <kbd>K</kbd> and paste it.

## How it works

- **Signaling.** [PeerJS](https://peerjs.com) gives every device an ID and brokers the WebRTC handshake through its free public server. After that, data flows browser to browser. Self-host [peerjs-server](https://github.com/peers/peerjs-server) for anything real.
- **Encryption.** WebRTC already encrypts the channel (DTLS), but the signaling server could, in theory, sit in the middle. So each device has its own ECDH P-256 identity (`services/crypto.ts`). Its private key is non-extractable and stored as a `CryptoKey` in IndexedDB. Peers exchange public keys in a `hello` frame and derive a shared AES-GCM key, and every message is sealed with a fresh IV.
  - A contact's key is pinned on first contact: a different key later refuses the connection.
  - "Verify" shows a safety number both sides can compare out of band.
  - Static keys mean no forward secrecy; a real messenger would add a ratchet.
- **Offline delivery.** Messages are stored as `pending` and sent when the contact connects; `✓` means sent, `✓✓` means delivered.

## Structure

```
src/
  main.ts                    starts the chat service, then mounts App
  App.ts                     layout, stores, outlet, Ctrl+K
  router.ts
  store/chat.ts              the chat service: PeerJS, links, handshake, send/receive
  store/ui.ts                UiStore (toasts, dock), PlacementStore
  services/                  db (IndexedDB), crypto (WebCrypto), encoding
  components/
    Modal.ts                 portal modal with an env
    Toasts.ts                portal toasts, owned by whoever shows them
    Dock.ts                  floating window that keeps a conversation alive
    Conversation.ts          one chat: header + messages + composer
    ConversationHeader.ts    presence, verify, placement buttons
    MessageList.ts           keyed, time-ordered bubbles
    Composer.ts
    IdentityCard.ts, ContactList.ts, NewChatDialog.ts, SafetyNumberDialog.ts
  pages/Welcome.ts, pages/ChatPage.ts (lazy)
```

## Engine features to look at

- **Logical nodes that are not views.** A peer connection (`Link` in `store/chat.ts`) is a plain object attached to the service's root node. `destroy(link)` closes its WebRTC channel through `onDestroy`; a refused handshake, a closed channel or a replacement link all end the same way.
- **Portals for free.** `openModal(owner, …)` attaches the modal to its owner and mounts it in `<body>`. The safety-number dialog is owned by the conversation header, so if that conversation goes away, the dialog closes with it. Toasts work the same way.
- **Move a live component.** "Pop out" moves the conversation node into the dock with `attach(dock, conversation.node)`. Nothing is re-created: history, scroll position, the half-typed message and every subscription stay. Navigating away destroys the chat page, but the docked conversation isn't its child any more, so it lives on. Opening that chat again moves it back.
- **Context that depends on where you are.** The page and the dock each provide a `PlacementStore`. The conversation reads it in `onAttach`, which re-runs after every move, and switches its buttons accordingly.
- **Envs for keyboard ownership.**
  - Each component checks its own env. App shortcuts (`Ctrl+K`) run only when `env.current` is `undefined`, so a focused input or an open modal owns the keyboard.
  - Modal inputs isolate _within_ the modal's env, so Escape (checked with `env.is(modal)`) closes the dialog even while you type.
  - The composer sends on Enter only while it is `env.isCurrent`.
- **State only where it is shared.** The service exposes `createState` for contacts, presence and its own connection status, and emitters for message events. Each component subscribes with its node as owner. Everything else is plain variables, mutated in place: `contact.unread++`, `presence.get().set(id, 'online')`, then `notify()`.
- **Ready before render.** `main.ts` awaits `startChat()`, so every component reads identity and contacts synchronously.

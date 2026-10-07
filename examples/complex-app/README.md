# complex-app

A peer-to-peer chat demo with WebRTC connections, encrypted messages, offline delivery, contact history, and detachable conversation windows.

## Run

From the repository root:

```sh
npm install
npm run build
cd examples/complex-app
npm install
npm run dev
```

Open the app in two browser profiles. Copy an identity from one profile, then use Ctrl+K in the other to start a chat. Web Crypto requires a secure context. localhost works locally; remote devices need HTTPS.

## Source

- **src/main.ts** starts the chat service before mounting the app.
- **src/App.ts** builds the app shell, connects the chat and UI services, and handles the global new-chat shortcut.
- **src/router.ts** defines chat routes and link helpers.
- **src/store/chat.ts** coordinates PeerJS connections, contacts, presence, handshakes, message delivery, and persistence.
- **src/store/ui.ts** stores toast and dock views and tracks conversation placement.
- **src/services/db.ts** stores identity, contacts, and messages in IndexedDB.
- **src/services/crypto.ts** creates ECDH identities, derives AES-GCM session keys, encrypts messages, and computes verification numbers.
- **src/services/encoding.ts** converts between byte arrays and Base64.
- **src/components/IdentityCard.ts** shows and edits the local identity and copies its ID.
- **src/components/ContactList.ts** lists contacts and their latest activity.
- **src/components/Conversation.ts** combines a conversation header, message history, and composer.
- **src/components/ConversationHeader.ts** shows contact details, presence, verification controls, and conversation placement actions.
- **src/components/MessageList.ts** displays messages in time order and updates delivery status.
- **src/components/Composer.ts** edits and sends a message.
- **src/components/Modal.ts** provides the dialog container used by chat dialogs.
- **src/components/NewChatDialog.ts** collects a contact ID and name.
- **src/components/SafetyNumberDialog.ts** displays the number peers can compare out of band.
- **src/components/Toasts.ts** displays temporary notices.
- **src/components/Dock.ts** keeps a detached conversation available while navigating.
- **src/pages/Welcome.ts** introduces the app.
- **src/pages/ChatPage.ts** displays the conversation selected by the route.
- **src/lib/format.ts** formats message times and contact initials.
- **src/lib/focus-env.ts** coordinates keyboard shortcuts with focused inputs.
- **src/styles/** contains the chat layout and component styles.

## Security note

The demo uses the public PeerJS signaling service by default. Its identity keys do not provide forward secrecy, and the app has not been security audited. Treat it as an example, not as a secure messaging product.

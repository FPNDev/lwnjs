import {
  attach,
  createEmitter,
  createState,
  createStore,
  destroy,
  onDestroy,
} from 'engine-ts/core';
import Peer, { type DataConnection } from 'peerjs';
import {
  createKeys,
  decrypt,
  deriveSessionKey,
  encrypt,
  exportPublicKey,
  safetyNumber,
} from '../services/crypto';
import {
  openDb,
  type Contact,
  type Db,
  type Identity,
  type Message,
} from '../services/db';

export type Presence = 'offline' | 'connecting' | 'online';

type Frame =
  | { type: 'hello'; name: string; key: string }
  | { type: 'message'; id: string; at: number; iv: string; data: string }
  | { type: 'ack'; id: string };

/**
 * One peer connection, as a logical node. It is not a view: logical nodes can
 * be any object. Destroying it closes the WebRTC channel.
 */
type Link = {
  peerId: string;
  conn: DataConnection;
  /** Set once both sides exchanged identities. */
  key?: CryptoKey;
  /** Frames are handled one after another: a message must not overtake the handshake. */
  queue: Promise<void>;
};

const randomId = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  let id = 'ets-';
  for (const byte of bytes) {
    id += byte.toString(16).padStart(2, '0');
  }

  return id;
};

async function loadIdentity(db: Db): Promise<Identity> {
  const stored = await db.getIdentity();
  if (stored) {
    return stored;
  }
  const keys = await createKeys();
  const identity: Identity = {
    peerId: randomId(),
    name: `Guest ${Math.floor(Math.random() * 900 + 100)}`,
    keys,
    publicKey: await exportPublicKey(keys.publicKey),
  };
  await db.putIdentity(identity);

  return identity;
}

function createChat(db: Db, me: Identity, all: Contact[]) {
  /** Owns every link: destroying it would close all connections at once. */
  const root = {};
  const links = new Map<string, Link>();

  // Shared, observed by several components: these are what createState / createEmitter are for.
  const status = createState<'starting' | 'online' | 'offline'>('starting');
  const contacts = createState(all);
  const presence = createState(new Map<string, Presence>());
  const messageAdded = createEmitter<Message>();
  const messageUpdated = createEmitter<Message>();
  const notices = createEmitter<string>();

  const has = (peerId: string) =>
    all.some((contact) => contact.peerId === peerId);
  const find = (peerId: string) =>
    all.find((contact) => contact.peerId === peerId);
  const contactsChanged = () => {
    all.sort((a, b) => b.lastAt - a.lastAt);
    contacts.notify();
  };
  const setPresence = (peerId: string, value: Presence) => {
    presence.get().set(peerId, value);
    presence.notify();
  };
  const touch = (contact: Contact, message: Message) => {
    contact.lastAt = message.at;
    contact.preview = message.text;
    void db.putContact(contact);
    contactsChanged();
  };

  const transmit = async (link: Link, message: Message) => {
    const sealed = await encrypt(link.key!, message.text);
    void link.conn.send({
      type: 'message',
      id: message.id,
      at: message.at,
      ...sealed,
    } satisfies Frame);
    message.status = 'sent';
    await db.putMessage(message);
    messageUpdated.emit(message);
  };

  const handshake = async (
    link: Link,
    frame: Extract<Frame, { type: 'hello' }>,
  ) => {
    let contact = find(link.peerId);
    if (contact?.publicKey && contact.publicKey !== frame.key) {
      notices.emit(
        `${contact.name}'s key changed. Connection refused: someone may be impersonating them.`,
      );
      destroy(link);

      return;
    }
    if (!contact) {
      contact = {
        peerId: link.peerId,
        name: frame.name,
        verified: false,
        lastAt: Date.now(),
        preview: '',
        unread: 0,
      };
      all.push(contact);
      notices.emit(`${frame.name} started a chat with you`);
    }
    contact.publicKey = frame.key;
    await db.putContact(contact);
    contactsChanged();

    link.key = await deriveSessionKey(me.keys.privateKey, frame.key);
    setPresence(link.peerId, 'online');
    // Deliver what was written while they were offline.
    for (const message of await db.messages(link.peerId)) {
      if (message.outgoing && message.status === 'pending') {
        await transmit(link, message);
      }
    }
  };

  const receive = async (link: Link, frame: Frame) => {
    if (frame.type === 'hello') {
      await handshake(link, frame);

      return;
    }
    if (frame.type === 'ack') {
      const message = await db.getMessage(frame.id);
      if (message) {
        message.status = 'delivered';
        await db.putMessage(message);
        messageUpdated.emit(message);
      }

      return;
    }

    const message: Message = {
      id: frame.id,
      peerId: link.peerId,
      outgoing: false,
      text: await decrypt(link.key!, frame),
      at: frame.at,
      status: 'delivered',
    };
    await db.putMessage(message);
    const contact = find(link.peerId)!;
    contact.unread++;
    touch(contact, message);
    messageAdded.emit(message);
    void link.conn.send({ type: 'ack', id: message.id } satisfies Frame);
  };

  const open = (conn: DataConnection) => {
    destroy(links.get(conn.peer));
    const link: Link = { peerId: conn.peer, conn, queue: Promise.resolve() };
    attach(root, link);
    links.set(link.peerId, link);
    setPresence(link.peerId, 'connecting');

    onDestroy(link, () => {
      conn.close();
      // A newer link may already have replaced this one.
      if (links.get(link.peerId) === link) {
        links.delete(link.peerId);
        setPresence(link.peerId, 'offline');
      }
    });
    conn.on('open', () => {
      void conn.send({
        type: 'hello',
        name: me.name,
        key: me.publicKey,
      } satisfies Frame);
    });
    conn.on('data', (frame) => {
      link.queue = link.queue
        .then(() => receive(link, frame as Frame))
        .catch((error: unknown) => {
          console.error(error);
        });
    });
    conn.on('close', () => {
      destroy(link);
    });
    conn.on('error', () => {
      destroy(link);
    });
  };

  const connect = (peerId: string) => {
    if (!links.has(peerId)) {
      open(peer.connect(peerId, { serialization: 'json', reliable: true }));
    }
  };

  const peer = new Peer(me.peerId, { debug: 0 });
  peer.on('open', () => {
    status.set('online');
    for (const contact of all) {
      connect(contact.peerId);
    }
  });
  peer.on('connection', open);
  peer.on('disconnected', () => {
    status.set('offline');
    setTimeout(() => {
      peer.reconnect();
    }, 3000);
  });
  peer.on('error', (error) => {
    if (error.type === 'peer-unavailable') {
      // "Could not connect to peer <id>": they are offline; messages stay pending.
      destroy(links.get(error.message.split(' ').at(-1)!));
    } else if (error.type === 'unavailable-id') {
      notices.emit('This identity is already open in another tab.');
    } else {
      notices.emit(`Connection problem: ${error.type}`);
    }
  });

  return {
    me,
    status,
    contacts,
    presence,
    messageAdded,
    messageUpdated,
    notices,
    has,
    find,
    connect,
    messages: (peerId: string) => db.messages(peerId),
    presenceOf: (peerId: string) => presence.get().get(peerId) ?? 'offline',

    async send(peerId: string, text: string) {
      const message: Message = {
        id: crypto.randomUUID(),
        peerId,
        outgoing: true,
        text,
        at: Date.now(),
        status: 'pending',
      };
      await db.putMessage(message);
      touch(find(peerId)!, message);
      messageAdded.emit(message);

      const link = links.get(peerId);
      if (link?.key) {
        await transmit(link, message);
      } else {
        connect(peerId);
      }
    },

    addContact(peerId: string, name: string) {
      let contact = find(peerId);
      if (contact) {
        contact.name = name;
      } else {
        contact = {
          peerId,
          name,
          verified: false,
          lastAt: Date.now(),
          preview: '',
          unread: 0,
        };
        all.push(contact);
      }
      void db.putContact(contact);
      contactsChanged();
      connect(peerId);
    },

    markRead(peerId: string) {
      const contact = find(peerId);
      if (contact?.unread) {
        contact.unread = 0;
        void db.putContact(contact);
        contactsChanged();
      }
    },

    verify(peerId: string) {
      const contact = find(peerId)!;
      contact.verified = true;
      void db.putContact(contact);
      contactsChanged();
    },

    safetyNumber(peerId: string) {
      const key = find(peerId)?.publicKey;

      return key ? safetyNumber(me.publicKey, key) : Promise.resolve();
    },

    rename(name: string) {
      me.name = name;
      void db.putIdentity(me);
    },
  };
}

export type Chat = ReturnType<typeof createChat>;

let started: Chat | undefined;

/** Opens the database, loads or creates the identity and connects to the signaling server. */
export async function startChat() {
  const db = await openDb();
  started = createChat(db, await loadIdentity(db), await db.contacts());
}

/** Provided by App; every component reaches the chat through it. */
export const ChatStore = createStore(() => started!);

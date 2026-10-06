export type Identity = {
  peerId: string;
  name: string;
  /** ECDH key pair. The private key is not extractable; IndexedDB stores it as a CryptoKey. */
  keys: CryptoKeyPair;
  /** Raw public key, base64. */
  publicKey: string;
};

export type Contact = {
  peerId: string;
  name: string;
  /** Learned from the first handshake; a different key later is refused. */
  publicKey?: string;
  verified: boolean;
  lastAt: number;
  preview: string;
  unread: number;
};

export type MessageStatus = 'pending' | 'sent' | 'delivered';

export type Message = {
  id: string;
  peerId: string;
  outgoing: boolean;
  text: string;
  at: number;
  status: MessageStatus;
};

function request<T>(req: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => {
      resolve(req.result);
    };
    req.onerror = () => {
      reject(req.error);
    };
  });
}

/** A small promise wrapper over the three object stores the app needs. */
export async function openDb() {
  const opening = indexedDB.open('engine-ts-chat', 1);
  opening.onupgradeneeded = () => {
    const db = opening.result;
    db.createObjectStore('meta');
    db.createObjectStore('contacts', { keyPath: 'peerId' });
    db.createObjectStore('messages', { keyPath: 'id' }).createIndex('byPeer', [
      'peerId',
      'at',
    ]);
  };
  const db = await request(opening);
  const store = (name: string, mode: IDBTransactionMode = 'readonly') =>
    db.transaction(name, mode).objectStore(name);

  return {
    getIdentity: () =>
      request<Identity | undefined>(
        store('meta').get('identity') as IDBRequest<Identity | undefined>,
      ),
    putIdentity: (identity: Identity) =>
      request(store('meta', 'readwrite').put(identity, 'identity')),
    contacts: () =>
      request<Contact[]>(store('contacts').getAll() as IDBRequest<Contact[]>),
    putContact: (contact: Contact) =>
      request(store('contacts', 'readwrite').put(contact)),
    getMessage: (id: string) =>
      request<Message | undefined>(
        store('messages').get(id) as IDBRequest<Message | undefined>,
      ),
    /** A peer's messages, oldest first. */
    messages: (peerId: string) =>
      request<Message[]>(
        store('messages')
          .index('byPeer')
          .getAll(
            IDBKeyRange.bound([peerId, 0], [peerId, Infinity]),
          ) as IDBRequest<Message[]>,
      ),
    putMessage: (message: Message) =>
      request(store('messages', 'readwrite').put(message)),
  };
}

export type Db = Awaited<ReturnType<typeof openDb>>;

import {
  randomDPoPKeyPair,
  getDPoPHandle,
  modifyAssertion,
  type DPoPHandle,
  type Configuration,
} from "openid-client";

// Per-session DPoP key pair store. The key is generated when the user starts
// a login and is keyed by the `state` value. The same key is reused for the
// PAR request and the token exchange, then discarded after the callback
// completes or the session expires. In a multi-process production deployment
// this should be moved to Redis or a similar shared store keyed by `state`.

type StoredKey = {
  keyPair: CryptoKeyPair;
  createdAt: number;
};

const dpopKeyStore = new Map<string, StoredKey>();

// PAR + token exchange should finish well under 5 minutes. Any key older than
// this is cleaned up on the next interaction to avoid an unbounded memory leak.
const DPoP_KEY_TTL_MS = 5 * 60 * 1000;

function cleanupExpiredKeys() {
  const now = Date.now();
  const expiry = now - DPoP_KEY_TTL_MS;
  for (const [state, store] of dpopKeyStore.entries()) {
    if (store.createdAt < expiry) {
      dpopKeyStore.delete(state);
    }
  }
}

export async function generateDPoPKeyForState(state: string): Promise<CryptoKeyPair> {
  cleanupExpiredKeys();
  const keyPair = await randomDPoPKeyPair("ES256");
  dpopKeyStore.set(state, { keyPair, createdAt: Date.now() });
  return keyPair;
}

export function getDPoPKeyForState(state: string): CryptoKeyPair | undefined {
  return dpopKeyStore.get(state)?.keyPair;
}

export function removeDPoPKeyForState(state: string): void {
  dpopKeyStore.delete(state);
}

// Returns a DPoP handle for a previously generated per-session key. Returns
// undefined when there is no key for the given state (e.g., the session has
// expired or the callback was replayed after cleanup).
export function getDPoPHandleForState(
  configuration: Configuration,
  state: string,
): DPoPHandle | undefined {
  const keyPair = getDPoPKeyForState(state);
  if (!keyPair) {
    return undefined;
  }
  return getDPoPHandle(configuration, keyPair, {
    [modifyAssertion]: (_header, payload) => {
      if (typeof payload.iat === "number") payload.exp = payload.iat + 120;
    },
  });
}

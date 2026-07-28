import { singpassConfig } from "./singpassConfig";

// crypto.subtle.importKey() strips 'kid' and 'alg' from the JWK it's given,
// but openid-client needs both (e.g. to pick the right decryption key by
// kid). So we re-attach them ourselves after import - same pattern as
// Singpass's own reference demo.

type NamedKey = { kid: string; alg: string; key: CryptoKey };

interface KeyJwk {
  kty: string;
  crv: string;
  x: string;
  y: string;
  d: string;
  kid: string;
  use: "sig" | "enc";
  alg: string;
}

function parseJwkEnv(name: string, raw: string): KeyJwk {
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `${name} is not valid JSON - check it's a single unbroken line in your .env file`,
    );
  }
}

let keysPromise: Promise<{
  privateSigningKey: NamedKey;
  privateEncryptionKey: NamedKey;
}> | null = null;

async function loadKeys() {
  const sigJwk = parseJwkEnv(
    "SINGPASS_RP_SIGNING_KEY_JWK",
    singpassConfig.rpSigningKeyJwk,
  );
  const encJwk = parseJwkEnv(
    "SINGPASS_RP_ENCRYPTION_KEY_JWK",
    singpassConfig.rpEncryptionKeyJwk,
  );

  const privateSigningKey: NamedKey = {
    kid: sigJwk.kid,
    alg: sigJwk.alg,
    key: await crypto.subtle.importKey(
      "jwk",
      sigJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    ),
  };

  const privateEncryptionKey: NamedKey = {
    kid: encJwk.kid,
    alg: encJwk.alg,
    key: await crypto.subtle.importKey(
      "jwk",
      encJwk,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveKey", "deriveBits"],
    ),
  };

  return { privateSigningKey, privateEncryptionKey };
}

export function getSingpassRpKeys() {
  if (!keysPromise) {
    keysPromise = loadKeys().catch((err) => {
      keysPromise = null;
      throw err;
    });
  }
  return keysPromise;
}

// Public JWKS view of our own signing + encryption keys - this is what
// Singpass fetches from our hosted jwks_uri to verify our client_assertion
// signatures and to encrypt the ID token/userinfo response to us. Strips the
// private `d` component - only the public x/y coordinates ever leave this
// process.
export function getSingpassRpPublicJwks() {
  const sigJwk = parseJwkEnv(
    "SINGPASS_RP_SIGNING_KEY_JWK",
    singpassConfig.rpSigningKeyJwk,
  );
  const encJwk = parseJwkEnv(
    "SINGPASS_RP_ENCRYPTION_KEY_JWK",
    singpassConfig.rpEncryptionKeyJwk,
  );

  const toPublic = ({ d, ...publicJwk }: KeyJwk) => publicJwk;

  return { keys: [toPublic(sigJwk), toPublic(encJwk)] };
}

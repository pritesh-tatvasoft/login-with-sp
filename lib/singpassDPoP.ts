import {
  randomDPoPKeyPair,
  getDPoPHandle,
  modifyAssertion,
  type DPoPHandle,
} from "openid-client";
import { getSingpassConfiguration } from "./singpassIssuer";

// POC DECISION (agreed, not spec-ideal): a single ephemeral DPoP key pair is
// generated once and reused for every login attempt during this POC, rather
// than generating a fresh key per session as the spec intends.
//
// BEFORE PRODUCTION: replace this with a key generated per auth session and
// stored server-side only for the lifetime of that session (e.g. keyed by
// the `state` value in Redis or your session store), then discarded after
// the callback completes. Reusing one key across all sessions like this is
// fine for a POC proving the flow works, but weakens the proof-of-possession
// guarantee DPoP exists to provide.

let dpopKeyPairPromise: ReturnType<typeof randomDPoPKeyPair> | null = null;

function getDPoPKeyPair() {
  if (!dpopKeyPairPromise) {
    dpopKeyPairPromise = randomDPoPKeyPair("ES256");
  }
  return dpopKeyPairPromise;
}

// Returns a handle that openid-client uses internally to sign DPoP proof
// JWTs automatically on PAR and token requests - we don't build those JWTs
// by hand.
//
// Confirmed against Singpass's own reference demo: Singpass expects DPoP
// proofs to be valid for at most 2 minutes, so we cap `exp` to `iat + 120`
// explicitly - the library's default expiry is longer and would be rejected.
export async function getSingpassDPoPHandle(): Promise<DPoPHandle> {
  const configuration = await getSingpassConfiguration();
  const keyPair = await getDPoPKeyPair();
  return getDPoPHandle(configuration, keyPair, {
    [modifyAssertion]: (_header, payload) => {
      if (typeof payload.iat === "number") payload.exp = payload.iat + 120;
    },
  });
}

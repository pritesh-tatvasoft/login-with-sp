import {
  discovery,
  allowInsecureRequests,
  enableDecryptingResponses,
  PrivateKeyJwt,
  type Configuration,
} from "openid-client";
import { singpassConfig } from "./singpassConfig";
import { getSingpassRpKeys } from "./singpassKeys";

// functional one. discovery() fetches .well-known/openid-configuration and
// returns a Configuration object that later steps (PAR, token exchange)
// will reuse - this is the v6 equivalent of what Issuer.discover() used to do.

// Discovery result is cached in-memory for the life of the server process.
let configPromise: Promise<Configuration> | null = null;

export function getSingpassConfiguration(): Promise<Configuration> {
  if (!configPromise) {
    configPromise = (async () => {
      const server = new URL(singpassConfig.issuer);
      const { privateSigningKey, privateEncryptionKey } =
        await getSingpassRpKeys();

      // v6 enforces HTTPS by default (correct for real Singpass/FAPI).
      // MockPass runs on plain http://localhost, so we only allow insecure
      // requests when the issuer itself is http - i.e. never against
      // staging or production, since those are always https.
      const isInsecureLocal = server.protocol === "http:";

      const config = await discovery(
        server,
        singpassConfig.clientId,
        undefined,
        // Client authenticates to Singpass using private_key_jwt, signed
        // with our RP private signing key - not a client secret.
        PrivateKeyJwt(privateSigningKey),
        isInsecureLocal ? { execute: [allowInsecureRequests] } : undefined,
      );

      // ID tokens (and userinfo, if used) come back encrypted (JWE).
      // This registers our private encryption key so openid-client can
      // decrypt them automatically when we read token claims later.
      enableDecryptingResponses(
        config,
        ["A256GCM", "A256CBC-HS512"],
        privateEncryptionKey,
      );

      return config;
    })().catch((err) => {
      // Reset cache on failure so the next request retries discovery
      // instead of being stuck with a permanently rejected promise.
      configPromise = null;
      throw err;
    });
  }
  return configPromise;
}

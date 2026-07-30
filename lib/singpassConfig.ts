// Single source of truth for Singpass config.
// No environment branching here on purpose - local (MockPass) and staging
// (real Singpass) both speak the same FAPI/OIDC contract. Only the values
// differ, and those come entirely from env vars (.env.local vs .env.staging).

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const singpassConfig = {
  issuer: required("SINGPASS_ISSUER"),
  clientId: required("SINGPASS_CLIENT_ID"),
  redirectUri: required("SINGPASS_REDIRECT_URI"),
  rpSigningKeyJwk: required("SINGPASS_RP_SIGNING_KEY_JWK"),
  rpEncryptionKeyJwk: required("SINGPASS_RP_ENCRYPTION_KEY_JWK"),
  scope: required("SINGPASS_SCOPE"),
};

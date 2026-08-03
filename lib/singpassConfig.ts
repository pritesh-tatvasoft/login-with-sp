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
  issuer: required("SINGPASS_LOGIN_ISSUER_URL"),
  clientId: required("SINGPASS_LOGIN_CLIENT_ID"),
  redirectUri: required("SINGPASS_LOGIN_REDIRECT_URI"),
  rpSigningKeyJwk: required("SINGPASS_LOGIN_SIGNING_PRIVATE_KEY"),
  rpEncryptionKeyJwk: required("SINGPASS_LOGIN_ENCRYPTION_PRIVATE_KEY"),
  scope: required("SINGPASS_LOGIN_SCOPE"),
  authContextType: required("SINGPASS_LOGIN_AUTH_CONTEXT_TYPE"),
};

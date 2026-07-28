import { NextResponse } from "next/server";
import { getSingpassConfiguration } from "@/lib/singpassIssuer";

// GET /api/auth/discovery
// Temporary diagnostic route for the POC - lets you confirm your env vars
// point at a working issuer (MockPass locally, real Singpass in staging)
// before building the PAR/login/callback routes on top of it.
export async function GET() {
  try {
    const config = await getSingpassConfiguration();
    const metadata = config.serverMetadata();

    return NextResponse.json({
      issuer: metadata.issuer,
      authorization_endpoint: metadata.authorization_endpoint,
      pushed_authorization_request_endpoint:
        metadata.pushed_authorization_request_endpoint,
      token_endpoint: metadata.token_endpoint,
      jwks_uri: metadata.jwks_uri,
      token_endpoint_auth_signing_alg_values_supported:
        metadata.token_endpoint_auth_signing_alg_values_supported,
      id_token_signing_alg_values_supported:
        metadata.id_token_signing_alg_values_supported,
      id_token_encryption_alg_values_supported:
        metadata.id_token_encryption_alg_values_supported,
      id_token_encryption_enc_values_supported:
        metadata.id_token_encryption_enc_values_supported,
      dpop_signing_alg_values_supported:
        metadata.dpop_signing_alg_values_supported,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Discovery failed", detail: (err as Error).message },
      { status: 500 },
    );
  }
}

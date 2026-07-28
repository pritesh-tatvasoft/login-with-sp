import { NextResponse } from "next/server";
import { getSingpassRpPublicJwks } from "@/lib/singpassKeys";

// GET /api/auth/jwks
// Publicly hosted JWKS for THIS app (the Relying Party) - not to be confused
// with Singpass's own JWKS at https://id.singpass.gov.sg/.well-known/keys.
// Register this route's full URL (e.g.
// https://<host>/api/auth/jwks) as the jwks_uri in your Singpass app config.
// Singpass fetches this to:
//   1. Verify the signature on our client_assertion JWTs (PAR + token exchange)
//   2. Encrypt the ID token / userinfo response so only we can decrypt it
// Must stay public (no auth), fast (<3s per Singpass's requirement), and
// available at all times - if this endpoint is slow or down, users will
// fail to log in via Singpass.
export async function GET() {
  console.log("Getting JWKS");
  const jwks = getSingpassRpPublicJwks();
  return NextResponse.json(jwks);
}

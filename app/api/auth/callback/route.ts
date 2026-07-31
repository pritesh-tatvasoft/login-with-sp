import { NextRequest, NextResponse } from "next/server";
import { authorizationCodeGrant } from "openid-client";
import { getSingpassConfiguration } from "@/lib/singpassIssuer";
import {
  getDPoPHandleForState,
  removeDPoPKeyForState,
} from "@/lib/singpassDPoP";
import { singpassConfig } from "@/lib/singpassConfig";

// GET /api/auth/callback
// flow: Singpass redirects the browser to the frontend `/auth/callback` page
// with ?code=...&state=... (or ?error=...&state=...). That page then calls
// this route (forwarding the same query string) to actually exchange the
// code for tokens. We exchange the code for tokens (signed with the same
// client assertion + DPoP key used in the PAR request), openid-client
// decrypts + verifies the ID token automatically, and we read the identity
// claims from it. This route returns JSON - it never redirects itself -
// the frontend page decides where to send the browser next.
export async function GET(req: NextRequest) {
  // If the user already has a session, this is most likely a re-visit of
  // this URL - e.g. browser back/forward or a refresh after a successful
  // login - replaying a `code` that's already been consumed and cookies
  // that have already been cleaned up. Don't attempt the exchange again;
  // just tell the frontend where to go.
  if (req.cookies.get("app_session")) {
    return NextResponse.json({ ok: true, redirectTo: "/dashboard" });
  }

  const currentUrl = new URL(req.url);

  // openid-client derives the token endpoint's `redirect_uri` from this URL.
  // Because the frontend `/auth/callback` page forwards the query string here,
  // the request URL is `/api/auth/callback`. We must rebuild the URL using the
  // registered redirect URI so the token request matches the PAR/authorize step.
  const redirectUrl = new URL(singpassConfig.redirectUri);
  for (const [key, value] of currentUrl.searchParams.entries()) {
    redirectUrl.searchParams.set(key, value);
  }

  // Defense in depth on top of whatever openid-client validates internally:
  // Singpass includes `iss` on both success and error redirects specifically
  // so clients can confirm the response actually came from the expected
  // issuer before acting on it. `iss` is mandatory - reject the response if it
  // is missing or does not match the expected issuer.
  const returnedIss = currentUrl.searchParams.get("iss");
  const configuration = await getSingpassConfiguration();
  const expectedIss = configuration.serverMetadata().issuer;
  if (returnedIss !== expectedIss) {
    console.error(
      `Singpass callback iss mismatch: expected ${expectedIss}, got ${returnedIss}`,
    );
    return NextResponse.json({ error: "unexpected_issuer" }, { status: 400 });
  }

  // Singpass redirected back with an Authentication Error Response
  // (server_error, temporarily_unavailable, access_denied, etc.) instead of
  // a code. Surface only the error *code* to the frontend - never
  // error_description verbatim, per Singpass's own content-spoofing
  // guidance - the frontend maps this to safe, canned copy.
  const authError = currentUrl.searchParams.get("error");
  if (authError) {
    console.error("Singpass returned an authentication error:", authError);
    return NextResponse.json({ error: authError }, { status: 400 });
  }

  const code_verifier = req.cookies.get("sp_verifier")?.value;
  const state = req.cookies.get("sp_state")?.value;
  const nonce = req.cookies.get("sp_nonce")?.value;

  if (!code_verifier || !state || !nonce) {
    return NextResponse.json(
      { error: "missing_session_cookies" },
      { status: 400 },
    );
  }

  try {
    const dpopHandle = getDPoPHandleForState(configuration, state);
    if (!dpopHandle) {
      throw new Error("missing_dpop_key");
    }

    const tokens = await authorizationCodeGrant(
      configuration,
      redirectUrl,
      {
        pkceCodeVerifier: code_verifier,
        expectedNonce: nonce,
        expectedState: state,
        idTokenExpected: true,
      },
      undefined,
      { DPoP: dpopHandle },
    );

    const claims = tokens.claims();
    if (!claims) {
      throw new Error("ID token claims are undefined");
    }

    // Debug-only: dump everything we got back from the token exchange +
    // decrypted/verified ID token claims. Remove before going to production
    // - claims contain PII (NRIC/FIN, name, etc.) and shouldn't sit in logs.
    console.log("Singpass token response:", {
      access_token: tokens.access_token,
      token_type: tokens.token_type,
      expires_in: tokens.expires_in,
      id_token: tokens.id_token,
    });
    console.log("Singpass ID token claims:", claims);

    // claims.sub is Singpass's stable identifier for this user.
    // claims.sub_attributes.identity_number carries the actual NRIC/FIN
    // (MockPass-specific shape - confirm this against the real staging
    // response shape once you test there, it may differ slightly).
    const res = NextResponse.json({ ok: true, redirectTo: "/dashboard" });

    res.cookies.set(
      "app_session",
      JSON.stringify({ sub: claims.sub, claims }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 8, // 8 hours - adjust to your session policy
      },
    );

    // Clean up the temporary login-flow cookies and per-session DPoP key
    res.cookies.delete("sp_verifier");
    res.cookies.delete("sp_state");
    res.cookies.delete("sp_nonce");
    removeDPoPKeyForState(state);

    return res;
  } catch (err) {
    removeDPoPKeyForState(state);
    console.error("Singpass callback failed:", err);
    return NextResponse.json(
      { error: "token_exchange_failed" },
      { status: 401 },
    );
  }
}

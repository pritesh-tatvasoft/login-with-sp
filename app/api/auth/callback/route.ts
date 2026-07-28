import { NextRequest, NextResponse } from "next/server";
import { authorizationCodeGrant } from "openid-client";
import { getSingpassConfiguration } from "@/lib/singpassIssuer";
import { getSingpassDPoPHandle } from "@/lib/singpassDPoP";

// GET /api/auth/callback
// flow: Singpass redirects here with ?code=...&state=...
// We exchange the code for tokens (signed with the same client assertion +
// DPoP key used in the PAR request), openid-client decrypts + verifies the
// ID token automatically, and we read the identity claims from it.
export async function GET(req: NextRequest) {
  const code_verifier = req.cookies.get("sp_verifier")?.value;
  const state = req.cookies.get("sp_state")?.value;
  const nonce = req.cookies.get("sp_nonce")?.value;

  if (!code_verifier || !state || !nonce) {
    return NextResponse.json(
      {
        error:
          "Missing auth session cookies - login flow may have expired or cookies were blocked",
      },
      { status: 400 },
    );
  }

  try {
    const configuration = await getSingpassConfiguration();
    const dpopHandle = await getSingpassDPoPHandle();

    const currentUrl = new URL(req.url);

    const tokens = await authorizationCodeGrant(
      configuration,
      currentUrl,
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

    // claims.sub is Singpass's stable identifier for this user.
    // claims.sub_attributes.identity_number carries the actual NRIC/FIN
    // (MockPass-specific shape - confirm this against the real staging
    // response shape once you test there, it may differ slightly).
    const res = NextResponse.redirect(new URL("/dashboard", req.url));

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

    // Clean up the temporary login-flow cookies now that they've served their purpose
    res.cookies.delete("sp_verifier");
    res.cookies.delete("sp_state");
    res.cookies.delete("sp_nonce");

    return res;
  } catch (err) {
    console.error("Singpass callback failed:", err);
    return NextResponse.json(
      { error: "Login failed", detail: (err as Error).message },
      { status: 401 },
    );
  }
}

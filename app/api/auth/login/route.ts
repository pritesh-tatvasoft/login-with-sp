import { NextResponse } from "next/server";
import {
  randomPKCECodeVerifier,
  calculatePKCECodeChallenge,
  randomState,
  randomNonce,
  buildAuthorizationUrlWithPAR,
} from "openid-client";
import { getSingpassConfiguration } from "@/lib/singpassIssuer";
import { getSingpassDPoPHandle } from "@/lib/singpassDPoP";
import { singpassConfig } from "@/lib/singpassConfig";

// GET /api/auth/login
// generate PKCE + state + nonce, send the PAR
// request (server-to-server, signed with our client assertion + DPoP proof),
// then return the Singpass /auth URL in JSON so the frontend can redirect
// the browser - no sensitive params exposed in the URL.
export async function GET() {
  const configuration = await getSingpassConfiguration();
  const dpopHandle = await getSingpassDPoPHandle();

  const code_verifier = randomPKCECodeVerifier();
  const code_challenge = await calculatePKCECodeChallenge(code_verifier);
  const state = randomState();
  const nonce = randomNonce();

  const redirectTo = await buildAuthorizationUrlWithPAR(
    configuration,
    {
      redirect_uri: singpassConfig.redirectUri,
      code_challenge_method: "S256",
      code_challenge,
      nonce,
      state,
      scope: "openid", // login-only for now; add MyInfo scopes later if needed
      // Mandatory for Login apps - describes what the user is authenticating
      // for, used by Singpass for anti-fraud purposes. Must be one of the
      // predefined enum values, and that value must be enabled for this app
      // in the Singpass Developer Portal (App config > authentication context
      // types) or you'll get "Requested authentication context type is not
      // registered" even though the value itself is valid.
      authentication_context_type: "APP_AUTHENTICATION_DEFAULT",
    },
    { DPoP: dpopHandle },
  );

  const res = NextResponse.json({ url: redirectTo.href });

  // These need to survive the round trip to Singpass and back, so they go
  // in httpOnly cookies - never exposed to client-side JS. Short maxAge
  // since the whole login flow should complete in well under 5 minutes.
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 300,
  };
  res.cookies.set("sp_verifier", code_verifier, cookieOpts);
  res.cookies.set("sp_state", state, cookieOpts);
  res.cookies.set("sp_nonce", nonce, cookieOpts);

  return res;
}

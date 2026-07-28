import { NextResponse } from "next/server";
import { getSingpassDPoPHandle } from "@/lib/singpassDPoP";

// GET /api/auth/dpop-check
// Temporary diagnostic route for the POC - confirms the DPoP key pair
// generates correctly and openid-client accepts it as a valid handle.
// Doesn't expose the private key - only confirms the handle was created.
export async function GET() {
  try {
    const dpopHandle = await getSingpassDPoPHandle();

    return NextResponse.json({
      ok: true,
      message: "DPoP handle created successfully",
      handleType: typeof dpopHandle,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "DPoP handle creation failed", detail: (err as Error).message },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

// GET /api/auth/logout
export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/dashboard", req.url));
  res.cookies.delete("app_session");
  return res;
}

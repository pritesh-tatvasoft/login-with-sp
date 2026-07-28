import { cookies } from "next/headers";
import Link from "next/link";
import type { CSSProperties } from "react";

// Server component - reads the httpOnly session cookie directly, no client
// JS needed to see the claims. This is purely a POC diagnostic view - in
// the real app you'd read from your own session/user model instead of
// dumping raw claims to the page.
export default async function DashboardPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("app_session");

  if (!sessionCookie) {
    return (
      <main style={{ padding: 40, fontFamily: "sans-serif" }}>
        <h1>Not logged in</h1>
        <p>No active Singpass session was found.</p>
        <Link href="/api/auth/login">Login with Singpass</Link>
      </main>
    );
  }

  let session: { sub: string; claims: Record<string, unknown> };
  try {
    session = JSON.parse(sessionCookie.value);
  } catch {
    return (
      <main style={{ padding: 40, fontFamily: "sans-serif" }}>
        <h1>Session error</h1>
        <p>Could not parse session cookie - try logging in again.</p>
        <Link href="/api/auth/login">Login with Singpass</Link>
      </main>
    );
  }

  const attrs = (session.claims.sub_attributes ?? {}) as Record<
    string,
    unknown
  >;

  return (
    <main style={{ padding: 40, fontFamily: "sans-serif", maxWidth: 640 }}>
      <h1>Logged in via Singpass</h1>

      <section style={{ marginTop: 24 }}>
        <h2>Identity</h2>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <tbody>
            <tr>
              <td style={cellLabel}>Name</td>
              <td style={cellValue}>{String(attrs.name ?? "-")}</td>
            </tr>
            <tr>
              <td style={cellLabel}>NRIC/FIN</td>
              <td style={cellValue}>{String(attrs.identity_number ?? "-")}</td>
            </tr>
            <tr>
              <td style={cellLabel}>Country of issuance</td>
              <td style={cellValue}>{String(attrs.identity_coi ?? "-")}</td>
            </tr>
            <tr>
              <td style={cellLabel}>Sub (stable user id)</td>
              <td style={cellValue}>{session.sub}</td>
            </tr>
            <tr>
              <td style={cellLabel}>Auth level (acr)</td>
              <td style={cellValue}>{String(session.claims.acr ?? "-")}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Raw ID token claims</h2>
        <pre
          style={{
            padding: 16,
            borderRadius: 8,
          }}
        >
          {JSON.stringify(session.claims, null, 2)}
        </pre>
      </section>

      <p style={{ marginTop: 32 }}>
        <Link href="/api/auth/logout">Logout</Link>
      </p>
    </main>
  );
}

const cellLabel: CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid #ddd",
  fontWeight: 600,
  width: "40%",
};
const cellValue: CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid #ddd",
};

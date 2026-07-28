import { cookies } from "next/headers";
import Link from "next/link";

// Server component - reads the httpOnly session cookie directly, no client
// JS needed to see the claims. This is purely a POC diagnostic view - in
// the real app you'd read from your own session/user model instead of
// dumping raw claims to the page.
export default async function DashboardPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("app_session");

  console.log("sessionCookie", sessionCookie);

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
    console.log("session", session);
  } catch {
    return (
      <main style={{ padding: 40, fontFamily: "sans-serif" }}>
        <h1>Session error</h1>
        <p>Could not parse session cookie - try logging in again.</p>
        <Link href="/api/auth/login">Login with Singpass</Link>
      </main>
    );
  }

  const attrs = (session.claims.sub_attributes ?? {}) as Record<string, unknown>;

  const formatUnix = (ts: unknown) => {
    const n = typeof ts === "number" ? ts : Number(ts);
    if (!Number.isFinite(n)) return "-";
    return new Date(n * 1000).toLocaleString();
  };

  const humanize = (key: string) =>
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const identityItems = Object.entries(attrs).map(([key, value]) => ({
    key,
    label: humanize(key),
    value: String(value ?? "-"),
  }));

  const authDetails = [
    { label: "User ID (sub)", value: session.sub },
    { label: "Audience (aud)", value: String(session.claims.aud ?? "-") },
    { label: "Authentication Context (acr)", value: String(session.claims.acr ?? "-") },
    { label: "Subject Type", value: String(session.claims.sub_type ?? "-") },
    {
      label: "Auth Methods (amr)",
      value: Array.isArray(session.claims.amr)
        ? session.claims.amr.join(", ")
        : String(session.claims.amr ?? "-"),
    },
    { label: "Issuer", value: String(session.claims.iss ?? "-") },
    {
      label: "Issued At",
      value: `${String(session.claims.iat ?? "-")} (${formatUnix(session.claims.iat)})`,
    },
    {
      label: "Expires At",
      value: `${String(session.claims.exp ?? "-")} (${formatUnix(session.claims.exp)})`,
    },
    { label: "Nonce", value: String(session.claims.nonce ?? "-") },
  ];

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-6 md:p-10">
        <header className="mb-8 border-b border-slate-200 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Welcome back</h1>
            <p className="text-slate-500 mt-2">Logged in via Singpass</p>
          </div>
          <Link
            href="/api/auth/logout"
            className="inline-flex items-center px-5 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
          >
            Logout
          </Link>
        </header>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Identity</h2>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            {identityItems.map(({ key, label, value }) => (
              <div key={key} className="grid grid-cols-1 md:grid-cols-3 border-b last:border-b-0 border-slate-200">
                <dt className="px-4 py-3 bg-slate-50 text-slate-600 font-medium text-sm">{label}</dt>
                <dd className="px-4 py-3 md:col-span-2 text-slate-900 wrap-break-word">{value}</dd>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Authentication details</h2>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            {authDetails.map(({ label, value }) => (
              <div key={label} className="grid grid-cols-1 md:grid-cols-3 border-b last:border-b-0 border-slate-200">
                <dt className="px-4 py-3 bg-slate-50 text-slate-600 font-medium text-sm">{label}</dt>
                <dd className="px-4 py-3 md:col-span-2 text-slate-900 wrap-break-word">{value}</dd>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Raw ID token claims</h2>
          <pre className="bg-slate-100 p-4 rounded-lg overflow-x-auto text-sm font-mono text-slate-700">
            {JSON.stringify(session.claims, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  );
}

"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

// GET /auth/callback
// Singpass redirects the browser here (not straight into a backend API
// route) so we can show a loading state and a friendly, non-verbatim error
// page. This page's only job is to forward the query string it received to
// the backend `/api/auth/callback` route, which does the actual token
// exchange, then follow whatever it says to do next.
//
// Register THIS page's URL (e.g. https://<host>/auth/callback) as your
// SINGPASS_REDIRECT_URI / redirect_uri with Singpass - not the API route.

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "You cancelled the Singpass login.",
  server_error: "Singpass encountered an error. Please try again.",
  temporarily_unavailable:
    "Singpass is temporarily unavailable. Please try again shortly.",
  unexpected_issuer:
    "This login response could not be verified. Please try again.",
  missing_session_cookies:
    "Your login session expired or cookies were blocked. Please try again.",
  token_exchange_failed: "We couldn't complete your login. Please try again.",
};

function friendlyMessage(code: string | null): string {
  if (!code) return "Something went wrong during login.";
  return ERROR_MESSAGES[code] ?? "Something went wrong during login.";
}

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function completeLogin() {
      try {
        const res = await fetch(
          `/api/auth/callback?${searchParams.toString()}`,
          { signal: controller.signal },
        );
        const body = await res.json();

        if (!res.ok || !body.ok) {
          setError(body.error ?? "unknown_error");
          return;
        }

        router.replace(body.redirectTo ?? "/dashboard");
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("unknown_error");
        }
      }
    }

    completeLogin();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <main style={{ padding: 40, fontFamily: "sans-serif", maxWidth: 480 }}>
        <h1>Login failed</h1>
        <p>{friendlyMessage(error)}</p>
        <p>
          <Link href="/api/auth/login">Try again</Link>
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: 40, fontFamily: "sans-serif", maxWidth: 480 }}>
      <h1>Signing you in...</h1>
      <p>Please wait while we complete your Singpass login.</p>
    </main>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <main style={{ padding: 40, fontFamily: "sans-serif" }}>
          <h1>Signing you in...</h1>
        </main>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}

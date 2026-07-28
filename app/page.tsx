"use client";

import { useState } from "react";

export default function Home() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login");
      if (!res.ok) throw new Error("Failed to start login");
      const data = await res.json();
      window.location.href = data.url;
    } catch (err) {
      console.error("Login start failed:", err);
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-10 shadow-lg text-center">
        <h1 className="text-3xl font-bold text-slate-900">Singpass Login POC</h1>
        <p className="mt-3 text-slate-600">
          Click below to authenticate with Singpass.
        </p>
        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="mt-8 inline-flex w-full items-center justify-center rounded-lg bg-[#FF2D2D] px-6 py-4 text-lg font-semibold text-white shadow-md transition hover:bg-[#e60000] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Redirecting..." : "Log in with singpass"}
        </button>
      </div>
    </main>
  );
}

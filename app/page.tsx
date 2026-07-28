import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-10 shadow-lg text-center">
        <h1 className="text-3xl font-bold text-slate-900">Singpass Login POC</h1>
        <p className="mt-3 text-slate-600">
          Click below to authenticate with Singpass.
        </p>
        <Link
          href="/api/auth/login"
          className="mt-8 inline-flex w-full items-center justify-center rounded-lg bg-[#FF2D2D] px-6 py-4 text-lg font-semibold text-white shadow-md transition hover:bg-[#e60000] cursor-pointer"
        >
          Log in with singpass
        </Link>
      </div>
    </main>
  );
}

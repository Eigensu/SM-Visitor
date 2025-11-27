export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-8 text-white">
      <section className="space-y-4 text-center">
        <h1 className="text-4xl font-bold">Welcome to Orbit</h1>
        <p className="text-lg text-slate-300">
          This Next.js app lives inside a pnpm + Turbo monorepo alongside the Pantry FastAPI
          backend.
        </p>
      </section>
    </main>
  );
}

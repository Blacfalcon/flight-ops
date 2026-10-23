'use client';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-4 p-6">
      <h1>Something Went Wrong</h1>
      <p className="text-ink-muted">The page could not load. If you are offline, try again when you have signal.</p>
      <div className="flex gap-2">
        <button className="btn-primary" onClick={reset}>
          Try again
        </button>
        <a href="/dashboard" className="btn-secondary">
          Dashboard
        </a>
      </div>
    </main>
  );
}

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-4 p-6">
      <h1>Not Found</h1>
      <p className="text-ink-muted">This page does not exist, or your appointment does not give access to it.</p>
      <a href="/dashboard" className="btn-primary self-start">
        Go to my dashboard
      </a>
    </main>
  );
}

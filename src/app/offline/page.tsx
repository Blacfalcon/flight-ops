export const metadata = { title: 'Offline' };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1>You are offline</h1>
      <p className="text-ink-muted">
        This page has not been saved on this device yet. Pages you opened recently, your missions and the latest weather still work without signal.
      </p>
      <p className="text-ink-muted">Forms you fill in now are kept on this device and sent automatically when the connection returns.</p>
      <a href="/dashboard" className="btn-primary self-start">
        Go to my dashboard
      </a>
    </main>
  );
}

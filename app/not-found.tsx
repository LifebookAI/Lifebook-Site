export default function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center p-8 text-center">
      <div className="max-w-md">
        <h1 className="text-3xl font-semibold">Page not found</h1>
        <p className="mt-2 text-gray-500">
          The page you’re looking for doesn’t exist. Try the homepage instead.
        </p>
        <a
          href="/"
          className="inline-block mt-5 rounded-lg px-4 py-2 border border-white/15 bg-white/5 hover:bg-white/10 transition"
        >
          Go home
        </a>
      </div>
    </main>
  );
}

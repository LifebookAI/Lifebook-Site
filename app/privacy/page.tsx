export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto p-8 space-y-6 text-white">
      <h1 className="text-3xl font-semibold">Privacy Policy</h1>
      <p>Last updated: {new Date().toLocaleDateString()}</p>
      <p>We collect the email you submit to our waitlist to notify you about access and product updates. We don’t sell your data.</p>
      <h2 className="text-xl font-medium">Data</h2>
      <ul className="list-disc ml-6 space-y-2 text-white/80">
        <li>Waitlist email (required)</li>
        <li>Basic site analytics and server logs</li>
      </ul>
      <h2 className="text-xl font-medium">Contact</h2>
      <p><a className="underline" href="mailto:support@uselifebook.ai">support@uselifebook.ai</a></p>
      <p className="text-sm text-white/50">Informational only; not legal advice.</p>
    </main>
  );
}

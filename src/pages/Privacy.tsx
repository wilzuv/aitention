export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <a href="/auth" className="text-sm text-primary hover:underline mb-6 inline-block">Back to sign in</a>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mb-8">Data information</h1>
        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <p>This installation is operated independently. It stores account information and application records in the Supabase project configured by its operator.</p>
          <p>Optional Google Calendar and Oura integrations access provider data when connected. External MCP clients can receive application records through authorized tool calls. Connecting an external client may allow it to read and change your records.</p>
          <p>Before accepting real users, the deployment operator must provide an appropriate privacy notice, contact information, and data retention and deletion procedures.</p>
        </div>
      </div>
    </div>
  );
}

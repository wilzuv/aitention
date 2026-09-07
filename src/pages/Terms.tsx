export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <a href="/auth" className="text-sm text-primary hover:underline mb-6 inline-block">Back to sign in</a>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mb-8">Usage information</h1>
        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <p>Aitention is a self-hosted planning application. Your account and records belong to this installation.</p>
          <p>The application includes experimental functionality. Contact this deployment's operator about support and access.</p>
          <p>Before operating a public service, the deployment operator must supply applicable terms and support details.</p>
        </div>
      </div>
    </div>
  );
}

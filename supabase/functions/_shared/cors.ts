/** Exact browser-origin allowlist. Requests without Origin still require normal authentication. */
export function corsHeaders(req: Request, configuredOrigins: string): Record<string, string> {
  const origin = req.headers.get('origin');
  const allowed = configuredOrigins.split(',').map(value => value.trim()).filter(Boolean);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

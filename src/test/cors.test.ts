import { describe, expect, it } from 'vitest';
import { corsHeaders } from '../../supabase/functions/_shared/cors';

describe('deployment origin configuration', () => {
  it('allows an exact configured custom domain and varies cached responses', () => {
    const result = corsHeaders(new Request('https://api.example.com', { headers: { origin: 'https://app.example.com' } }), 'http://localhost:8080, https://app.example.com');
    expect(result['Access-Control-Allow-Origin']).toBe('https://app.example.com');
    expect(result.Vary).toBe('Origin');
  });
  it('does not grant browser access to arbitrary Vercel deployments or lookalike domains', () => {
    for (const origin of ['https://other.vercel.app', 'https://app.example.com.attacker.test']) {
      expect(corsHeaders(new Request('https://api.example.com', { headers: { origin } }), 'https://app.example.com')['Access-Control-Allow-Origin']).toBeUndefined();
    }
  });
  it('does not require a browser Origin from server clients', () => {
    expect(corsHeaders(new Request('https://api.example.com'), '')['Access-Control-Allow-Origin']).toBeUndefined();
  });
});

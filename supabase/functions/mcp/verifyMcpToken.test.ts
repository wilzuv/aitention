import { generateKeyPair, SignJWT } from "https://esm.sh/jose@5";
import { verifyMcpToken } from "./verifyMcpToken.ts";

const { privateKey, publicKey } = await generateKeyPair("RS256");
const other = await generateKeyPair("RS256");
const issuer = "https://issuer.example";
const audience = "https://app.example/functions/v1/mcp";
const userId = "11111111-1111-4111-8111-111111111111";
const now = Math.floor(Date.now() / 1000);
const base = { iss: issuer, aud: audience, sub: "user-example", client_id: "client-example", iat: now, exp: now + 300, external_user_id: userId };

async function verify(overrides: Record<string, unknown> = {}, wrongKey = false) {
  const claims: Record<string, unknown> = { ...base, ...overrides };
  for (const key of Object.keys(claims)) if (claims[key] === undefined) delete claims[key];
  const token = await new SignJWT(claims).setProtectedHeader({ alg: "RS256" }).sign(wrongKey ? other.privateKey : privateKey);
  return verifyMcpToken(token, async () => publicKey, issuer, audience);
}

Deno.test("accepts resource audience and verified linked identity", async () => {
  const result = await verify();
  if (result.userId !== userId) throw new Error("Wrong identity");
});
Deno.test("accepts resource within audience array", async () => {
  await verify({ aud: ["client-example", audience] });
});
Deno.test("accepts alternate linked identity claim", async () => {
  await verify({ external_user_id: undefined, supabase_uid: userId });
});
for (const [name, claims] of Object.entries({
  "wrong audience": { aud: "https://other.example" },
  "missing audience": { aud: undefined },
  "wrong issuer": { iss: "https://other.example" },
  "expired": { exp: now - 60 },
  "missing expiry": { exp: undefined },
  "not yet valid": { nbf: now + 300 },
  "missing subject": { sub: undefined },
  "missing client": { client_id: undefined },
  "missing identity": { external_user_id: undefined },
  "malformed identity": { external_user_id: { id: userId } },
  "conflicting identities": { supabase_uid: "22222222-2222-4222-8222-222222222222" },
})) {
  Deno.test(`rejects ${name}`, async () => {
    try { await verify(claims); } catch { return; }
    throw new Error("Invalid token accepted");
  });
}
Deno.test("rejects wrong signature", async () => {
  try { await verify({}, true); } catch { return; }
  throw new Error("Invalid signature accepted");
});

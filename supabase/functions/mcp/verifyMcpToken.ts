import { jwtVerify, type JWTVerifyGetKey } from "https://esm.sh/jose@5";

/** Accept only signed, expiring access tokens intended for this MCP resource. */
export async function verifyMcpToken(
  token: string,
  key: JWTVerifyGetKey,
  issuer: string,
  audience: string,
): Promise<{ userId: string; subject: string }> {
  const { payload } = await jwtVerify(token, key, {
    issuer,
    audience,
    algorithms: ["RS256"],
    requiredClaims: ["exp", "iat", "sub", "client_id"],
  });
  if (typeof payload.sub !== "string" || !payload.sub.trim() ||
      typeof payload.client_id !== "string" || !payload.client_id.trim()) {
    throw new Error("Missing OAuth identity");
  }
  const first = payload.external_user_id;
  const second = payload.supabase_uid;
  if (first !== undefined && second !== undefined && first !== second) {
    throw new Error("Conflicting linked identities");
  }
  const userId = first ?? second;
  if (typeof userId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error("Invalid linked Supabase identity");
  }
  return { userId, subject: payload.sub };
}

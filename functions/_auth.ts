export interface Env {
  DB: D1Database;
  CLERK_PUBLISHABLE_KEY?: string;
  CLERK_JWT_KEY?: string;
  CLERK_SECRET_KEY?: string;
  HF_TOKEN?: string;
}

interface ClerkClaims {
  sub?: string;
  exp?: number;
  nbf?: number;
  iss?: string;
  azp?: string;
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
}

function decodeJSON<T>(value: string): T | null {
  try { return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T; } catch { return null; }
}

function pemToBytes(pem: string): Uint8Array {
  const body = pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, "");
  return Uint8Array.from(atob(body), (character) => character.charCodeAt(0));
}

export async function getAuthUser(request: Request, env: Env): Promise<string | null> {
  const authorization = request.headers.get("Authorization");
  const cookie = request.headers.get("Cookie")?.match(/(?:^|;\s*)__session=([^;]+)/)?.[1];
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : cookie;
  if (!token || !env.CLERK_JWT_KEY) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJSON<{ alg?: string }>(encodedHeader);
  const claims = decodeJSON<ClerkClaims>(encodedPayload);
  if (header?.alg !== "RS256" || !claims?.sub || !claims.exp) return null;

  const now = Math.floor(Date.now() / 1000);
  if (claims.exp < now - 5 || (claims.nbf && claims.nbf > now + 5)) return null;
  if (claims.iss && !claims.iss.startsWith("https://")) return null;
  const origin = new URL(request.url).origin;
  if (claims.azp && claims.azp !== origin) return null;

  try {
    const key = await crypto.subtle.importKey(
      "spki",
      pemToBytes(env.CLERK_JWT_KEY) as unknown as BufferSource,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      decodeBase64Url(encodedSignature) as unknown as BufferSource,
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`) as unknown as BufferSource
    );
    return valid ? claims.sub : null;
  } catch {
    return null;
  }
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": status === 200 ? "public, max-age=60, s-maxage=300" : "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

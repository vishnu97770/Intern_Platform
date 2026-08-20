import jwt, { type SignOptions } from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";

export interface AccessTokenPayload {
  sub: string; // user id
}

export function signAccessToken(userId: string): string {
  // `jti` guarantees each issued token is a distinct string even when two
  // tokens for the same user are signed within the same second (jsonwebtoken
  // truncates `iat` to whole seconds, so without a nonce the payload —
  // and therefore the signature — would otherwise collide).
  return jwt.sign({ sub: userId, jti: randomUUID() } satisfies AccessTokenPayload & { jti: string }, env.JWT_ACCESS_SECRET, {
    // env.JWT_ACCESS_EXPIRES_IN is validated at startup (config/env.ts) to be
    // a non-empty string; jsonwebtoken's types just want a narrower literal
    // shape than plain `string` here.
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
  });
}

/** Throws if the token is missing, malformed, expired, or has a bad signature. */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof decoded === "string" || typeof decoded.sub !== "string") {
    throw new jwt.JsonWebTokenError("Malformed access token payload");
  }
  return { sub: decoded.sub };
}

/** Approximate seconds represented by JWT_ACCESS_EXPIRES_IN, for client refresh scheduling. */
export function accessTokenExpiresInSeconds(): number {
  const match = /^(\d+)([smhd])$/.exec(env.JWT_ACCESS_EXPIRES_IN);
  if (!match) return 900; // fallback: 15 minutes
  const value = Number(match[1]);
  const unit = match[2];
  const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[unit as "s" | "m" | "h" | "d"];
  return value * multiplier;
}

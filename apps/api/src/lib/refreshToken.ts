import { randomBytes, createHash } from "node:crypto";

/**
 * Refresh tokens are opaque random strings, not JWTs: the server is the
 * only party that needs to interpret them, and an opaque token can be
 * revoked by deleting/marking its DB row without needing a signature
 * scheme or a blocklist. Only the sha256 hash is ever persisted.
 */
export function generateRefreshToken(): string {
  return randomBytes(48).toString("hex");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function refreshTokenExpiryDate(expiresIn: string): Date {
  const match = /^(\d+)([smhd])$/.exec(expiresIn);
  const value = match ? Number(match[1]) : 7;
  const unit = match ? match[2] : "d";
  const multiplierMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit as "s" | "m" | "h" | "d"];
  return new Date(Date.now() + value * multiplierMs);
}

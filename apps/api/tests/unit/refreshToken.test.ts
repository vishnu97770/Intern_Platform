import { describe, expect, it } from "vitest";
import { generateRefreshToken, hashRefreshToken, refreshTokenExpiryDate } from "../../src/lib/refreshToken.js";

describe("refresh tokens", () => {
  it("generates unique, high-entropy opaque tokens", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(64);
  });

  it("hashes deterministically so a stored hash can be matched later", () => {
    const token = generateRefreshToken();
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
  });

  it("produces different hashes for different tokens", () => {
    expect(hashRefreshToken(generateRefreshToken())).not.toBe(hashRefreshToken(generateRefreshToken()));
  });

  it("computes a future expiry date from a duration string", () => {
    const expiry = refreshTokenExpiryDate("7d");
    expect(expiry.getTime()).toBeGreaterThan(Date.now());
    expect(expiry.getTime()).toBeLessThanOrEqual(Date.now() + 8 * 24 * 60 * 60 * 1000);
  });
});

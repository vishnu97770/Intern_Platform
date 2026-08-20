import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { signAccessToken, verifyAccessToken, accessTokenExpiresInSeconds } from "../../src/lib/jwt.js";

describe("access tokens", () => {
  it("round-trips a user id through sign/verify", () => {
    const token = signAccessToken("user-123");
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe("user-123");
  });

  it("rejects a token signed with a different secret", () => {
    const badToken = jwt.sign({ sub: "user-123" }, "a-completely-different-secret-value-32chars");
    expect(() => verifyAccessToken(badToken)).toThrow();
  });

  it("rejects a malformed token", () => {
    expect(() => verifyAccessToken("not-a-jwt")).toThrow();
  });

  it("computes a positive expiry window in seconds", () => {
    expect(accessTokenExpiresInSeconds()).toBeGreaterThan(0);
  });
});

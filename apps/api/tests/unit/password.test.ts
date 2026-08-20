import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../src/lib/password.js";

describe("password hashing", () => {
  it("hashes a password to a bcrypt hash distinct from the plaintext", async () => {
    const hash = await hashPassword("Str0ngPassword!");
    expect(hash).not.toBe("Str0ngPassword!");
    expect(hash.startsWith("$2")).toBe(true);
  });

  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("Str0ngPassword!");
    await expect(verifyPassword("Str0ngPassword!", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("Str0ngPassword!");
    await expect(verifyPassword("WrongPassword!", hash)).resolves.toBe(false);
  });

  it("produces different hashes for the same password (random salt)", async () => {
    const [a, b] = await Promise.all([hashPassword("SamePassword1"), hashPassword("SamePassword1")]);
    expect(a).not.toBe(b);
  });
});

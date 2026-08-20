import type { AuthUserDTO } from "@intern-platform/shared";
import { prisma } from "../../lib/prisma.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { signAccessToken, accessTokenExpiresInSeconds } from "../../lib/jwt.js";
import { generateRefreshToken, hashRefreshToken, refreshTokenExpiryDate } from "../../lib/refreshToken.js";
import { env } from "../../config/env.js";
import { ConflictError, UnauthorizedError } from "../../lib/errors.js";
import type { RegisterBody, LoginBody } from "./auth.validators.js";
import type { User } from "@prisma/client";

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

function toAuthUserDTO(user: User): AuthUserDTO {
  return { id: user.id, email: user.email, createdAt: user.createdAt.toISOString() };
}

async function issueTokens(userId: string): Promise<IssuedTokens> {
  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshTokenExpiryDate(env.JWT_REFRESH_EXPIRES_IN),
    },
  });

  return {
    accessToken: signAccessToken(userId),
    refreshToken,
    expiresIn: accessTokenExpiresInSeconds(),
  };
}

export async function register(input: RegisterBody): Promise<{ user: AuthUserDTO; tokens: IssuedTokens }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ConflictError("An account with this email already exists");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      profile: {
        create: {
          fullName: input.fullName,
        },
      },
    },
  });

  const tokens = await issueTokens(user.id);
  return { user: toAuthUserDTO(user), tokens };
}

export async function login(input: LoginBody): Promise<{ user: AuthUserDTO; tokens: IssuedTokens }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Deliberately identical error/timing-shape whether the email doesn't
  // exist or the password is wrong, so login can't be used to enumerate
  // registered accounts.
  const passwordMatches = user ? await verifyPassword(input.password, user.passwordHash) : await verifyPassword(input.password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
  if (!user || !passwordMatches) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const tokens = await issueTokens(user.id);
  return { user: toAuthUserDTO(user), tokens };
}

export async function refresh(rawRefreshToken: string): Promise<{ user: AuthUserDTO; tokens: IssuedTokens }> {
  const tokenHash = hashRefreshToken(rawRefreshToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }

  // Rotate: revoke the used token and issue a fresh pair. This limits the
  // blast radius of a stolen refresh token to a single use.
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const tokens = await issueTokens(stored.userId);
  return { user: toAuthUserDTO(stored.user), tokens };
}

export async function logout(rawRefreshToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(rawRefreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

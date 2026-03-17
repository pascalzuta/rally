import { randomUUID } from "node:crypto";
import type { AccessTokenClaims, AuthUser } from "../types/auth.js";
import { signToken, verifyToken } from "../security/hmacToken.js";

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60 * 12;

export function issueAccessToken(user: AuthUser, secret: string): string {
  const now = Math.floor(Date.now() / 1000);
  return signToken<AccessTokenClaims>(
    {
      sub: user.id,
      email: user.email,
      iat: now,
      exp: now + ACCESS_TOKEN_TTL_SECONDS
    },
    secret
  );
}

export function verifyAccessToken(token: string, secret: string): AccessTokenClaims | null {
  return verifyToken<AccessTokenClaims>(token, secret);
}

export function newUser(email: string): AuthUser {
  return {
    id: randomUUID(),
    email: email.toLowerCase(),
    createdAt: new Date().toISOString()
  };
}

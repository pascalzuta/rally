import type { NextFunction, Request, Response } from "express";
import type { AppConfig } from "../config.js";
import { verifyToken } from "../security/hmacToken.js";

/**
 * Supabase JWT claims structure.
 * Supabase signs JWTs with HS256 using the project's JWT secret.
 */
interface SupabaseJwtClaims {
  sub: string;        // Supabase auth user UUID
  aud: string;        // "authenticated" or "anon"
  role: string;       // "authenticated", "anon", "service_role"
  email?: string;
  iss: string;        // Supabase project URL
  iat: number;
  exp: number;
}

/**
 * Authenticated user context attached to the request.
 * This bridges Supabase auth with the frontend's player_id system.
 */
export interface AuthenticatedUser {
  authId: string;      // Supabase auth.users UUID
  playerId?: string;   // Frontend localStorage-generated player ID (from request body)
  role: string;        // "authenticated" or "anon"
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

/**
 * Middleware that verifies Supabase access tokens (HS256 JWTs).
 * Uses the same HMAC verification as the custom token system since
 * Supabase also uses HS256.
 */
export function supabaseAuthMiddleware(config: AppConfig) {
  return function requireSupabaseAuth(req: Request, res: Response, next: NextFunction): void {
    const secret = config.SUPABASE_JWT_SECRET;
    if (!secret) {
      res.status(500).json({ error: "supabase_jwt_not_configured" });
      return;
    }

    const authHeader = req.header("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "missing_bearer_token" });
      return;
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const claims = verifyToken<SupabaseJwtClaims>(token, secret);
    if (!claims) {
      res.status(401).json({ error: "invalid_token" });
      return;
    }

    if (claims.role !== "authenticated") {
      res.status(401).json({ error: "anonymous_not_allowed" });
      return;
    }

    req.authUser = {
      authId: claims.sub,
      role: claims.role,
    };

    next();
  };
}

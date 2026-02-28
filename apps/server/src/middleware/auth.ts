import type { NextFunction, Request, Response } from "express";
import type { AppConfig } from "../config.js";
import { verifyAccessToken } from "../auth/tokens.js";
import type { UserRepo } from "../repo/interfaces.js";

export function authMiddleware(config: AppConfig, users: UserRepo) {
  return async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.header("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "missing_bearer_token" });
      return;
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const claims = verifyAccessToken(token, config.AUTH_TOKEN_SECRET);
    if (!claims) {
      res.status(401).json({ error: "invalid_token" });
      return;
    }

    const user = await users.findById(claims.sub);
    if (!user) {
      res.status(401).json({ error: "unknown_user" });
      return;
    }

    req.user = user;
    next();
  };
}

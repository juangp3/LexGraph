import type { NextFunction, Request, Response } from "express";
import type { AuthOrchestrator } from "./auth.orchestrator.js";
import type { AuthenticatedUser } from "./types.js";

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

function parseBearerToken(headerValue: string | undefined): string | null {
  if (!headerValue) {
    return null;
  }

  const [scheme, token] = headerValue.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }

  return token.trim();
}

export function requireAuth(auth: AuthOrchestrator) {
  return async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    // Try cookie first
    let token: string | null = null;
    const cookieHeader = req.header("cookie");
    if (cookieHeader) {
      const match = cookieHeader.split(";").map(s => s.trim()).find(s => s.startsWith((process.env.SESSION_COOKIE_NAME ?? "lexgraph_auth") + "="));
      if (match) {
        token = match.split("=").slice(1).join("=");
      }
    }

    if (!token) {
      token = parseBearerToken(req.header("authorization"));
    }
    if (!token) {
      return res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Authentication required." },
      });
    }

    const user = await auth.authenticate(token);
    if (!user) {
      return res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Session is invalid or expired." },
      });
    }

    req.authUser = user;
    next();
  };
}

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { AuthError, AuthOrchestrator } from "../auth/auth.orchestrator.js";
import { requireAuth } from "../auth/auth.middleware.js";

function getClientIp(req: { ip?: string; headers: Record<string, unknown> }): string | null {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return req.ip ?? null;
}

export function buildAuthRouter(auth: AuthOrchestrator): Router {
  const router = Router();

  const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: "RATE_LIMITED", message: "Too many auth attempts. Please try again later." } },
  });

  router.post("/register", authLimiter, async (req, res) => {
    try {
      const result = await auth.register(
        {
          email: String(req.body?.email ?? ""),
          password: String(req.body?.password ?? ""),
          displayName: typeof req.body?.displayName === "string" ? req.body.displayName : undefined,
        },
        {
          userAgent: req.header("user-agent") ?? null,
          ipAddress: getClientIp(req),
        },
      );

      return res.status(201).json(result);
    } catch (error) {
      if (error instanceof AuthError) {
        return res.status(error.status).json({ error: { code: error.code, message: error.message } });
      }

      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to register." } });
    }
  });

  router.post("/login", authLimiter, async (req, res) => {
    try {
      const result = await auth.login(
        {
          email: String(req.body?.email ?? ""),
          password: String(req.body?.password ?? ""),
        },
        {
          userAgent: req.header("user-agent") ?? null,
          ipAddress: getClientIp(req),
        },
      );

      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof AuthError) {
        return res.status(error.status).json({ error: { code: error.code, message: error.message } });
      }

      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to login." } });
    }
  });

  router.post("/logout", requireAuth(auth), async (req, res) => {
    if (!req.authUser) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
    }

    await auth.logout(req.authUser.sessionId);
    return res.status(204).send();
  });

  return router;
}

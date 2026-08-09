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

      // Set HttpOnly session cookie
      const cookieName = process.env.SESSION_COOKIE_NAME ?? "lexgraph_auth";
      const cookieOpts: Record<string, any> = {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      };
      if (process.env.NODE_ENV === "production") {
        cookieOpts.secure = true;
      }
      if (result.session?.expiresAt) {
        cookieOpts.expires = new Date(result.session.expiresAt);
      }

      res.cookie(cookieName, result.session.accessToken, cookieOpts);

      return res.status(201).json({ user: result.user });
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

      const cookieName = process.env.SESSION_COOKIE_NAME ?? "lexgraph_auth";
      const cookieOpts: Record<string, any> = {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      };
      if (process.env.NODE_ENV === "production") {
        cookieOpts.secure = true;
      }
      if (result.session?.expiresAt) {
        cookieOpts.expires = new Date(result.session.expiresAt);
      }

      res.cookie(cookieName, result.session.accessToken, cookieOpts);

      return res.status(200).json({ user: result.user });
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
    const cookieName = process.env.SESSION_COOKIE_NAME ?? "lexgraph_auth";
    res.cookie(cookieName, "", { httpOnly: true, path: "/", expires: new Date(0) });
    return res.status(204).send();
  });

  // GitHub OAuth start
  router.get("/oauth/github", async (req, res) => {
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
    const redirectUri = `${process.env.API_BASE_URL ?? "http://localhost:3001"}/v1/auth/oauth/github/callback`;
    const next = typeof req.query?.next === "string" ? req.query.next : "/workspace";

    if (!clientId) {
      return res.status(500).json({ error: { code: "OAUTH_CONFIG", message: "GitHub OAuth not configured." } });
    }

    const nonce = crypto.randomUUID();
    const encodedNext = Buffer.from(next).toString("base64");
    // store state in cookie: nonce:encodedNext
    const stateCookieVal = `${nonce}:${encodedNext}`;
    const cookieOpts: Record<string, any> = { httpOnly: true, path: "/", sameSite: "lax" };
    if (process.env.NODE_ENV === "production") cookieOpts.secure = true;
    res.cookie(process.env.OAUTH_STATE_COOKIE_NAME ?? "oauth_state", stateCookieVal, cookieOpts);

    const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, scope: "user:email", state: nonce });
    return res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
  });

  router.get("/oauth/github/callback", async (req, res) => {
    try {
      const code = String(req.query?.code ?? "");
      const state = String(req.query?.state ?? "");

      // Validate state against cookie
      const stateCookie = String(req.headers.cookie ?? "").split(";").map(s => s.trim()).find(s => s.startsWith((process.env.OAUTH_STATE_COOKIE_NAME ?? "oauth_state") + "="));
      let nextPath = "/workspace";
      if (!stateCookie) {
        return res.status(400).json({ error: { code: "OAUTH_STATE_MISSING", message: "Missing oauth state cookie." } });
      }
      const cookieVal = stateCookie.split("=").slice(1).join("=");
      const [nonce, encodedNext] = cookieVal.split(":");
      if (!nonce || nonce !== state) {
        return res.status(400).json({ error: { code: "OAUTH_STATE_MISMATCH", message: "Invalid oauth state." } });
      }
      try {
        nextPath = encodedNext ? Buffer.from(encodedNext, "base64").toString("utf-8") : "/workspace";
      } catch {
        nextPath = "/workspace";
      }

      const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
      const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
      const apiBase = process.env.API_BASE_URL ?? "http://localhost:3001";
      const frontendBase = process.env.FRONTEND_BASE_URL ?? "http://localhost:3000";

      if (!clientId || !clientSecret) {
        return res.status(500).json({ error: { code: "OAUTH_CONFIG", message: "GitHub OAuth not configured." } });
      }

      // Exchange code for access token
      let profile: any = null;
      let userJson: any = null;
      if (process.env.OAUTH_MOCK === "true" && code === "TEST_OAUTH_CODE") {
        // Test-mode: return mocked GitHub profile without external network calls
        userJson = { id: "mock-github-id", login: "mockuser", name: "Mock User", avatar_url: null };
        const emails = [{ email: "mock@example.com", primary: true, verified: true }];
        profile = { email: emails[0].email, displayName: userJson.name, avatarUrl: userJson.avatar_url };
      } else {
        // Exchange code for access token
        const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
        });

        const tokenJson = await tokenResp.json();
        const accessToken = tokenJson.access_token;
        if (!accessToken) {
          return res.status(400).json({ error: { code: "OAUTH_FAILED", message: "Failed to obtain access token." } });
        }

        // Fetch user profile
        const userResp = await fetch("https://api.github.com/user", {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        });
        userJson = await userResp.json();

        // Try to get primary email
        let email = null;
        try {
          const emailsResp = await fetch("https://api.github.com/user/emails", {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
          });
          const emails = await emailsResp.json();
          if (Array.isArray(emails)) {
            const primary = emails.find((e: any) => e.primary && e.verified) || emails.find((e: any) => e.verified) || emails[0];
            email = primary?.email ?? null;
          }
        } catch {
          // ignore
        }

        profile = {
          email,
          displayName: userJson?.name ?? userJson?.login ?? null,
          avatarUrl: userJson?.avatar_url ?? null,
        };
      }

      const result = await auth.oauthSignIn("github", String(userJson?.id ?? "github"), profile, {
        userAgent: req.header("user-agent") ?? null,
        ipAddress: getClientIp(req),
      });
      const cookieName = process.env.SESSION_COOKIE_NAME ?? "lexgraph_auth";
      const cookieOpts: Record<string, any> = {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      };
      if (process.env.NODE_ENV === "production") cookieOpts.secure = true;
      if (result.session?.expiresAt) cookieOpts.expires = new Date(result.session.expiresAt);

      res.cookie(cookieName, result.session.accessToken, cookieOpts);

      // clear oauth state cookie
      res.cookie(process.env.OAUTH_STATE_COOKIE_NAME ?? "oauth_state", "", { httpOnly: true, path: "/", expires: new Date(0) });
      return res.redirect(`${frontendBase}/auth/oauth-callback?next=${encodeURIComponent(nextPath)}`);
    } catch (error) {
      return res.status(500).json({ error: { code: "OAUTH_ERROR", message: "OAuth callback failed." } });
    }
  });

  // Google OAuth start
  router.get("/oauth/google", async (req, res) => {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const redirectUri = `${process.env.API_BASE_URL ?? "http://localhost:3001"}/v1/auth/oauth/google/callback`;
    const next = typeof req.query?.next === "string" ? req.query.next : "/workspace";

    if (!clientId) {
      return res.status(500).json({ error: { code: "OAUTH_CONFIG", message: "Google OAuth not configured." } });
    }

    const nonce = crypto.randomUUID();
    const encodedNext = Buffer.from(next).toString("base64");
    const stateCookieVal = `${nonce}:${encodedNext}`;
    const cookieOpts: Record<string, any> = { httpOnly: true, path: "/", sameSite: "lax" };
    if (process.env.NODE_ENV === "production") cookieOpts.secure = true;
    res.cookie(process.env.OAUTH_STATE_COOKIE_NAME ?? "oauth_state", stateCookieVal, cookieOpts);

    const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: "openid email profile", state: nonce });
    return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  router.get("/oauth/google/callback", async (req, res) => {
    try {
      const code = String(req.query?.code ?? "");
      const state = String(req.query?.state ?? "");

      const stateCookie = String(req.headers.cookie ?? "").split(";").map(s => s.trim()).find(s => s.startsWith((process.env.OAUTH_STATE_COOKIE_NAME ?? "oauth_state") + "="));
      if (!stateCookie) {
        return res.status(400).json({ error: { code: "OAUTH_STATE_MISSING", message: "Missing oauth state cookie." } });
      }
      const cookieVal = stateCookie.split("=").slice(1).join("=");
      const [nonce, encodedNext] = cookieVal.split(":");
      if (!nonce || nonce !== state) {
        return res.status(400).json({ error: { code: "OAUTH_STATE_MISMATCH", message: "Invalid oauth state." } });
      }
      let nextPath = "/workspace";
      try { nextPath = encodedNext ? Buffer.from(encodedNext, "base64").toString("utf-8") : "/workspace"; } catch {}

      const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
      const apiBase = process.env.API_BASE_URL ?? "http://localhost:3001";
      const frontendBase = process.env.FRONTEND_BASE_URL ?? "http://localhost:3000";

      if (!clientId || !clientSecret) {
        return res.status(500).json({ error: { code: "OAUTH_CONFIG", message: "Google OAuth not configured." } });
      }

      const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: `${apiBase}/v1/auth/oauth/google/callback`,
          grant_type: "authorization_code",
        }).toString(),
      });

      const tokenJson = await tokenResp.json();
      const accessToken = tokenJson.access_token;
      if (!accessToken) {
        return res.status(400).json({ error: { code: "OAUTH_FAILED", message: "Failed to obtain access token." } });
      }
      let userJson: any = null;
      let profile: any = null;
      if (process.env.OAUTH_MOCK === "true" && code === "TEST_OAUTH_CODE") {
        userJson = { sub: "mock-google-id", email: "mock@example.com", name: "Mock User", picture: null };
        profile = { email: userJson.email, displayName: userJson.name, avatarUrl: userJson.picture };
      } else {
        const userResp = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        });
        userJson = await userResp.json();

        profile = {
          email: userJson?.email ?? null,
          displayName: userJson?.name ?? userJson?.email ?? null,
          avatarUrl: userJson?.picture ?? null,
        };
      }

      const providerUserId = String(userJson?.sub ?? "google");

      const result = await auth.oauthSignIn("google", providerUserId, profile, {
        userAgent: req.header("user-agent") ?? null,
        ipAddress: getClientIp(req),
      });
      const cookieName = process.env.SESSION_COOKIE_NAME ?? "lexgraph_auth";
      const cookieOpts: Record<string, any> = {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      };
      if (process.env.NODE_ENV === "production") cookieOpts.secure = true;
      if (result.session?.expiresAt) cookieOpts.expires = new Date(result.session.expiresAt);

      res.cookie(cookieName, result.session.accessToken, cookieOpts);

      // clear oauth state cookie
      res.cookie(process.env.OAUTH_STATE_COOKIE_NAME ?? "oauth_state", "", { httpOnly: true, path: "/", expires: new Date(0) });
      return res.redirect(`${frontendBase}/auth/oauth-callback?next=${encodeURIComponent(nextPath)}`);
    } catch (error) {
      return res.status(500).json({ error: { code: "OAUTH_ERROR", message: "OAuth callback failed." } });
    }
  });

  return router;
}

import { randomBytes } from "node:crypto";
import { hashPassword, hashToken, verifyPassword } from "./password.js";
import type {
  AuthStore,
  AuthenticatedUser,
  LoginInput,
  LoginResult,
  RegisterInput,
  RegisterResult,
} from "./types.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 10;
const MAX_DISPLAY_NAME_LENGTH = 100;
const SESSION_TTL_MS = Number(process.env.AUTH_SESSION_TTL_MS ?? 1000 * 60 * 60 * 24 * 30);

export class AuthError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message);
    this.name = "AuthError";
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function sanitizeDisplayName(displayName: string | undefined): string | null {
  if (!displayName) {
    return null;
  }

  const value = displayName.trim();
  return value.length > 0 ? value.slice(0, MAX_DISPLAY_NAME_LENGTH) : null;
}

function ensureValidRegisterInput(input: RegisterInput): void {
  const email = normalizeEmail(input.email);
  if (!EMAIL_REGEX.test(email)) {
    throw new AuthError("INVALID_EMAIL", "Email is invalid.");
  }

  if ((input.password ?? "").length < MIN_PASSWORD_LENGTH) {
    throw new AuthError("INVALID_PASSWORD", `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  if (input.displayName && input.displayName.trim().length > MAX_DISPLAY_NAME_LENGTH) {
    throw new AuthError("INVALID_DISPLAY_NAME", `Display name must be <= ${MAX_DISPLAY_NAME_LENGTH} characters.`);
  }
}

function ensureValidLoginInput(input: LoginInput): void {
  const email = normalizeEmail(input.email);
  if (!EMAIL_REGEX.test(email)) {
    throw new AuthError("INVALID_CREDENTIALS", "Invalid credentials.", 401);
  }

  if (!input.password) {
    throw new AuthError("INVALID_CREDENTIALS", "Invalid credentials.", 401);
  }
}

export class AuthOrchestrator {
  constructor(private readonly store: AuthStore) {}

  async register(input: RegisterInput, metadata: { userAgent: string | null; ipAddress: string | null }): Promise<RegisterResult> {
    ensureValidRegisterInput(input);
    const email = normalizeEmail(input.email);

    const existing = await this.store.findUserByEmail(email);
    if (existing) {
      throw new AuthError("EMAIL_ALREADY_EXISTS", "An account with this email already exists.", 409);
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.store.createUser({
      email,
      passwordHash,
      displayName: sanitizeDisplayName(input.displayName),
    });

    const session = await this.createSessionForUser(user.id, metadata);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
      },
      session,
    };
  }

  async login(input: LoginInput, metadata: { userAgent: string | null; ipAddress: string | null }): Promise<LoginResult> {
    ensureValidLoginInput(input);
    const email = normalizeEmail(input.email);

    const user = await this.store.findUserByEmail(email);
    if (!user) {
      throw new AuthError("INVALID_CREDENTIALS", "Invalid credentials.", 401);
    }

    if (user.status !== "ACTIVE") {
      throw new AuthError("ACCOUNT_INACTIVE", "Account is not active.", 403);
    }

    const isValid = await verifyPassword(input.password, user.passwordHash);
    if (!isValid) {
      throw new AuthError("INVALID_CREDENTIALS", "Invalid credentials.", 401);
    }

    await this.store.updateLastLogin(user.id, new Date());
    const refreshed = await this.store.findUserById(user.id);
    if (!refreshed) {
      throw new AuthError("ACCOUNT_NOT_FOUND", "Account not found.", 404);
    }

    const session = await this.createSessionForUser(refreshed.id, metadata);

    return {
      user: {
        id: refreshed.id,
        email: refreshed.email,
        displayName: refreshed.displayName,
        avatarUrl: refreshed.avatarUrl,
        status: refreshed.status,
        createdAt: refreshed.createdAt,
        updatedAt: refreshed.updatedAt,
        lastLoginAt: refreshed.lastLoginAt,
      },
      session,
    };
  }

  async oauthSignIn(provider: string, providerUserId: string, profile: { email?: string | null; displayName?: string | null; avatarUrl?: string | null }, metadata: { userAgent: string | null; ipAddress: string | null }): Promise<LoginResult> {
    // Try to match by email first when available
    const email = profile.email ? normalizeEmail(profile.email) : null;

    // First, attempt to find by provider link
    let userId = await this.store.findUserIdByProvider(provider, providerUserId);
    let user = null;

    if (userId) {
      user = await this.store.findUserById(userId);
    }

    if (!user) {
      // Next, try to find by email
      if (email) {
        user = await this.store.findUserByEmail(email);
      }
    }

    if (!user) {
      // Create a new user with a random password hash and optional avatar
      const randomPassword = randomBytes(24).toString("hex");
      const passwordHash = await hashPassword(randomPassword);

      const created = await this.store.createUser({
        email: email ?? `${providerUserId}@${provider}.local`,
        passwordHash,
        displayName: sanitizeDisplayName(profile.displayName ?? undefined),
        avatarUrl: profile.avatarUrl ?? null,
      });

      user = created as any;
      userId = user.id;

      // create provider link
      await this.store.createProviderLink(provider, providerUserId, userId as string);
    } else {
      userId = user.id;
      // ensure provider link exists
      await this.store.createProviderLink(provider, providerUserId, userId as string);
    }

    await this.store.updateLastLogin(user.id, new Date());
    const refreshed = await this.store.findUserById(user.id);
    if (!refreshed) {
      throw new AuthError("ACCOUNT_NOT_FOUND", "Account not found.", 404);
    }

    const session = await this.createSessionForUser(refreshed.id, metadata);

    return {
      user: {
        id: refreshed.id,
        email: refreshed.email,
        displayName: refreshed.displayName,
        avatarUrl: refreshed.avatarUrl,
        status: refreshed.status,
        createdAt: refreshed.createdAt,
        updatedAt: refreshed.updatedAt,
        lastLoginAt: refreshed.lastLoginAt,
      },
      session,
    };
  }

  async authenticate(token: string): Promise<AuthenticatedUser | null> {
    if (!token) {
      return null;
    }

    const tokenHash = hashToken(token);
    const record = await this.store.findSessionWithUserByTokenHash(tokenHash);
    if (!record) {
      return null;
    }

    const expiresAt = new Date(record.session.expiresAt);
    if (expiresAt.getTime() <= Date.now()) {
      await this.store.deleteSession(record.session.id);
      return null;
    }

    if (record.user.status !== "ACTIVE") {
      return null;
    }

    return {
      id: record.user.id,
      email: record.user.email,
      displayName: record.user.displayName,
      avatarUrl: record.user.avatarUrl,
      status: record.user.status,
      createdAt: record.user.createdAt,
      updatedAt: record.user.updatedAt,
      lastLoginAt: record.user.lastLoginAt,
      sessionId: record.session.id,
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.store.deleteSession(sessionId);
  }

  async deleteAccount(userId: string, password: string): Promise<void> {
    const normalizedPassword = password?.trim() ?? "";
    if (!normalizedPassword) {
      throw new AuthError("INVALID_CREDENTIALS", "Password is required.", 401);
    }

    const user = await this.store.findUserById(userId);
    if (!user) {
      throw new AuthError("ACCOUNT_NOT_FOUND", "Account not found.", 404);
    }

    if (user.status !== "ACTIVE") {
      throw new AuthError("ACCOUNT_INACTIVE", "Account is not active.", 403);
    }

    const valid = await verifyPassword(normalizedPassword, user.passwordHash);
    if (!valid) {
      throw new AuthError("INVALID_CREDENTIALS", "Invalid credentials.", 401);
    }

    await this.store.deleteUser(userId);
  }

  private async createSessionForUser(userId: string, metadata: { userAgent: string | null; ipAddress: string | null }) {
    const accessToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(accessToken);
    const expiresAtDate = new Date(Date.now() + SESSION_TTL_MS);

    const session = await this.store.createSession({
      userId,
      tokenHash,
      userAgent: metadata.userAgent,
      ipAddress: metadata.ipAddress,
      expiresAt: expiresAtDate,
    });

    return {
      accessToken,
      expiresAt: session.expiresAt,
    };
  }
}

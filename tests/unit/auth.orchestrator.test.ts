import { describe, expect, it } from "vitest";
import { AuthOrchestrator } from "../../src/auth/auth.orchestrator.js";
import { hashToken } from "../../src/auth/password.js";
import type { AuthSessionRecord, AuthStore, AuthStoreUser } from "../../src/auth/types.js";

class InMemoryAuthStore implements AuthStore {
  users = new Map<string, AuthStoreUser>();
  byEmail = new Map<string, string>();
  sessions = new Map<string, AuthSessionRecord>();
  seq = 1;

  private id() {
    const base = String(this.seq++).padStart(12, "0");
    return `00000000-0000-4000-8000-${base}`;
  }

  async createUser(input: { email: string; passwordHash: string; displayName: string | null }): Promise<AuthStoreUser> {
    const id = this.id();
    const now = new Date().toISOString();
    const user: AuthStoreUser = {
      id,
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      avatarUrl: null,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    };
    this.users.set(id, user);
    this.byEmail.set(user.email, id);
    return user;
  }

  async findUserByEmail(email: string): Promise<AuthStoreUser | null> {
    const id = this.byEmail.get(email);
    if (!id) {
      return null;
    }
    return this.users.get(id) ?? null;
  }

  async findUserById(userId: string): Promise<AuthStoreUser | null> {
    return this.users.get(userId) ?? null;
  }

  async createSession(input: {
    userId: string;
    tokenHash: string;
    userAgent: string | null;
    ipAddress: string | null;
    expiresAt: Date;
  }): Promise<AuthSessionRecord> {
    const id = this.id();
    const now = new Date().toISOString();
    const session: AuthSessionRecord = {
      id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: input.expiresAt.toISOString(),
    };
    this.sessions.set(id, session);
    return session;
  }

  async findSessionWithUserByTokenHash(tokenHash: string): Promise<{ session: AuthSessionRecord; user: AuthStoreUser } | null> {
    const session = [...this.sessions.values()].find((candidate) => candidate.tokenHash === tokenHash);
    if (!session) {
      return null;
    }

    const user = this.users.get(session.userId);
    if (!user) {
      return null;
    }

    return { session, user };
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async deleteUser(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      return;
    }

    this.users.set(userId, {
      ...user,
      status: "DELETED",
      email: `deleted+${userId}@deleted.local`,
      displayName: null,
      avatarUrl: null,
      passwordHash: "deleted",
      updatedAt: new Date().toISOString(),
    });

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(sessionId);
      }
    }
  }

  async updateLastLogin(userId: string, at: Date): Promise<void> {
    const current = this.users.get(userId);
    if (!current) {
      return;
    }

    this.users.set(userId, {
      ...current,
      lastLoginAt: at.toISOString(),
      updatedAt: at.toISOString(),
    });
  }
}

describe("AuthOrchestrator", () => {
  it("registers a user and returns a session token", async () => {
    const store = new InMemoryAuthStore();
    const auth = new AuthOrchestrator(store);

    const result = await auth.register(
      { email: "Test@Example.com", password: "very-secret-password", displayName: "Test User" },
      { userAgent: "vitest", ipAddress: "127.0.0.1" },
    );

    expect(result.user.email).toBe("test@example.com");
    expect(result.user.displayName).toBe("Test User");
    expect(result.session.accessToken.length).toBeGreaterThan(10);
    expect(result.session.expiresAt).toBeTruthy();
  });

  it("authenticates using bearer token hash lookup", async () => {
    const store = new InMemoryAuthStore();
    const auth = new AuthOrchestrator(store);

    const registered = await auth.register(
      { email: "auth@example.com", password: "very-secret-password", displayName: "Auth" },
      { userAgent: null, ipAddress: null },
    );

    const identity = await auth.authenticate(registered.session.accessToken);
    expect(identity?.email).toBe("auth@example.com");

    const unknown = await auth.authenticate("unknown-token");
    expect(unknown).toBeNull();
  });

  it("logs in and creates a fresh session", async () => {
    const store = new InMemoryAuthStore();
    const auth = new AuthOrchestrator(store);

    await auth.register(
      { email: "login@example.com", password: "very-secret-password", displayName: "Login" },
      { userAgent: "vitest", ipAddress: "127.0.0.1" },
    );

    const login = await auth.login(
      { email: "login@example.com", password: "very-secret-password" },
      { userAgent: "vitest", ipAddress: "127.0.0.2" },
    );

    const hashed = hashToken(login.session.accessToken);
    const hasSession = [...store.sessions.values()].some((session) => session.tokenHash === hashed);
    expect(hasSession).toBe(true);
  });

  it("deletes account only when password is valid", async () => {
    const store = new InMemoryAuthStore();
    const auth = new AuthOrchestrator(store);

    const registration = await auth.register(
      { email: "delete@example.com", password: "very-secret-password", displayName: "Delete" },
      { userAgent: "vitest", ipAddress: "127.0.0.1" },
    );

    await expect(auth.deleteAccount(registration.user.id, "wrong-password")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });

    await auth.deleteAccount(registration.user.id, "very-secret-password");
    const deletedUser = await store.findUserById(registration.user.id);
    expect(deletedUser?.status).toBe("DELETED");
    expect([...store.sessions.values()].filter((session) => session.userId === registration.user.id)).toHaveLength(0);
  });
});

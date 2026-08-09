export type UserStatus = "ACTIVE" | "SUSPENDED" | "DELETED";

export interface UserRecord {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface AuthenticatedUser extends UserRecord {
  sessionId: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  expiresAt: string;
}

export interface RegisterResult {
  user: UserRecord;
  session: AuthTokens;
}

export interface LoginResult {
  user: UserRecord;
  session: AuthTokens;
}

export interface AuthStoreUser extends UserRecord {
  passwordHash: string;
}

export interface AuthSessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

export interface AuthStore {
  createUser(input: { email: string; passwordHash: string; displayName: string | null; avatarUrl?: string | null }): Promise<AuthStoreUser>;
  findUserByEmail(email: string): Promise<AuthStoreUser | null>;
  findUserById(userId: string): Promise<AuthStoreUser | null>;
  createSession(input: {
    userId: string;
    tokenHash: string;
    userAgent: string | null;
    ipAddress: string | null;
    expiresAt: Date;
  }): Promise<AuthSessionRecord>;
  findSessionWithUserByTokenHash(tokenHash: string): Promise<{ session: AuthSessionRecord; user: AuthStoreUser } | null>;
  deleteSession(sessionId: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  updateLastLogin(userId: string, at: Date): Promise<void>;
  // Provider link support
  findUserIdByProvider(provider: string, providerUserId: string): Promise<string | null>;
  createProviderLink(provider: string, providerUserId: string, userId: string): Promise<void>;
}

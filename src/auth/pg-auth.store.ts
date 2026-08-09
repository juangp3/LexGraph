import { dbPool } from "../db/client.js";
import type { AuthSessionRecord, AuthStore, AuthStoreUser } from "./types.js";

function mapUser(row: Record<string, unknown>): AuthStoreUser {
  return {
    id: String(row.id),
    email: String(row.email),
    displayName: row.display_name ? String(row.display_name) : null,
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    status: (row.status as "ACTIVE" | "SUSPENDED" | "DELETED") ?? "ACTIVE",
    passwordHash: String(row.password_hash),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null,
  };
}

function mapSession(row: Record<string, unknown>): AuthSessionRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    tokenHash: String(row.token_hash),
    userAgent: row.user_agent ? String(row.user_agent) : null,
    ipAddress: row.ip_address ? String(row.ip_address) : null,
    createdAt: String(row.created_at),
    lastSeenAt: String(row.last_seen_at),
    expiresAt: String(row.expires_at),
  };
}

export class PgAuthStore implements AuthStore {
  async createUser(input: { email: string; passwordHash: string; displayName: string | null }): Promise<AuthStoreUser> {
    const result = await dbPool.query(
      `
      INSERT INTO users (email, password_hash, display_name, status)
      VALUES ($1, $2, $3, 'ACTIVE')
      RETURNING id, email, display_name, avatar_url, status, password_hash, created_at, updated_at, last_login_at
      `,
      [input.email, input.passwordHash, input.displayName],
    );

    return mapUser(result.rows[0] as Record<string, unknown>);
  }

  async findUserByEmail(email: string): Promise<AuthStoreUser | null> {
    const result = await dbPool.query(
      `
      SELECT id, email, display_name, avatar_url, status, password_hash, created_at, updated_at, last_login_at
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [email],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapUser(result.rows[0] as Record<string, unknown>);
  }

  async findUserById(userId: string): Promise<AuthStoreUser | null> {
    const result = await dbPool.query(
      `
      SELECT id, email, display_name, avatar_url, status, password_hash, created_at, updated_at, last_login_at
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapUser(result.rows[0] as Record<string, unknown>);
  }

  async createSession(input: {
    userId: string;
    tokenHash: string;
    userAgent: string | null;
    ipAddress: string | null;
    expiresAt: Date;
  }): Promise<AuthSessionRecord> {
    const result = await dbPool.query(
      `
      INSERT INTO user_sessions (user_id, token_hash, user_agent, ip_address, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id, token_hash, user_agent, ip_address, created_at, last_seen_at, expires_at
      `,
      [input.userId, input.tokenHash, input.userAgent, input.ipAddress, input.expiresAt.toISOString()],
    );

    return mapSession(result.rows[0] as Record<string, unknown>);
  }

  async findSessionWithUserByTokenHash(tokenHash: string): Promise<{ session: AuthSessionRecord; user: AuthStoreUser } | null> {
    const result = await dbPool.query(
      `
      SELECT
        s.id AS session_id,
        s.user_id,
        s.token_hash,
        s.user_agent,
        s.ip_address,
        s.created_at AS session_created_at,
        s.last_seen_at,
        s.expires_at,
        u.id,
        u.email,
        u.display_name,
        u.avatar_url,
        u.status,
        u.password_hash,
        u.created_at,
        u.updated_at,
        u.last_login_at
      FROM user_sessions s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
      LIMIT 1
      `,
      [tokenHash],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as Record<string, unknown>;
    return {
      session: {
        id: String(row.session_id),
        userId: String(row.user_id),
        tokenHash: String(row.token_hash),
        userAgent: row.user_agent ? String(row.user_agent) : null,
        ipAddress: row.ip_address ? String(row.ip_address) : null,
        createdAt: String(row.session_created_at),
        lastSeenAt: String(row.last_seen_at),
        expiresAt: String(row.expires_at),
      },
      user: mapUser(row),
    };
  }

  async deleteSession(sessionId: string): Promise<void> {
    await dbPool.query(`DELETE FROM user_sessions WHERE id = $1`, [sessionId]);
  }

  async deleteUser(userId: string): Promise<void> {
    await dbPool.query(
      `
      UPDATE users
      SET
        status = 'DELETED',
        email = CONCAT('deleted+', id::text, '@deleted.lexgraph.local'),
        display_name = NULL,
        avatar_url = NULL,
        password_hash = 'deleted',
        deleted_at = now(),
        updated_at = now()
      WHERE id = $1
      `,
      [userId],
    );

    await dbPool.query(`DELETE FROM user_sessions WHERE user_id = $1`, [userId]);
  }

  async updateLastLogin(userId: string, at: Date): Promise<void> {
    await dbPool.query(
      `UPDATE users SET last_login_at = $2, updated_at = now() WHERE id = $1`,
      [userId, at.toISOString()],
    );
  }
}

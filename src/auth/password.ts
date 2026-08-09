import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const SALT_LENGTH_BYTES = 16;
const DERIVED_KEY_LENGTH_BYTES = 64;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH_BYTES).toString("hex");
  const derivedKey = (await scrypt(password, salt, DERIVED_KEY_LENGTH_BYTES)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const [salt, keyHex] = passwordHash.split(":");
  if (!salt || !keyHex) {
    return false;
  }

  const derivedKey = (await scrypt(password, salt, DERIVED_KEY_LENGTH_BYTES)) as Buffer;
  const storedKey = Buffer.from(keyHex, "hex");

  if (storedKey.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(storedKey, derivedKey);
}

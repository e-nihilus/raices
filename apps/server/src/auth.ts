import {
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import type { Sql } from "./db.ts";

const scrypt = promisify(scryptCallback);
const SESSION_DAYS = 30;
export const usernameKey = (username: string) =>
  username.trim().normalize("NFKC").toLowerCase();
export const publicUser = (user: Record<string, unknown>) => ({
  id: String(user.id),
  username: String(user.username),
});
const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, expectedHex] = stored.split(":");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  if (expected.length !== 64) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  return timingSafeEqual(actual, expected);
}

export async function createAccount(
  db: Sql,
  username: string,
  password: string,
) {
  const id = randomUUID();
  const familyId = randomUUID();
  const passwordHash = await hashPassword(password);
  const createdAt = new Date().toISOString();
  return db.transaction(async (tx) => {
    const inserted = await tx.all(
      "INSERT INTO app_users(id,username,username_key,password_hash,created_at) VALUES(?,?,?,?,?) ON CONFLICT(username_key) DO NOTHING RETURNING id",
      [id, username.trim(), usernameKey(username), passwordHash, createdAt],
    );
    if (!inserted.length) return null;
    await tx.all("INSERT INTO families(id,name,created_at) VALUES(?,?,?)", [
      familyId,
      "Mi familia",
      createdAt,
    ]);
    await tx.all(
      "INSERT INTO app_family_members(family_id,user_id) VALUES(?,?)",
      [familyId, id],
    );
    return { id, username: username.trim() };
  });
}

export async function createSession(db: Sql, userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 86400_000,
  ).toISOString();
  await db.all(
    "INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",
    [hashToken(token), userId, expiresAt],
  );
  return token;
}

export async function sessionUser(db: Sql, token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const [user] = await db.all(
    "SELECT u.id,u.username FROM app_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",
    [hashToken(token), new Date().toISOString()],
  );
  return user ? publicUser(user) : null;
}

export async function revokeSession(db: Sql, token: string) {
  if (/^[A-Za-z0-9_-]{43}$/.test(token))
    await db.all("DELETE FROM app_sessions WHERE token_hash=?", [
      hashToken(token),
    ]);
}

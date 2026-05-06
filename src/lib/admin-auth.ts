import crypto from "crypto";
import fs from "fs";
import path from "path";

const COOKIE_NAME = "portfolio_admin_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is required for admin sessions.");
  }
  return secret;
}

function sign(value: string) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

const passwordStorePath = path.join(process.cwd(), ".portfolio-admin.json");
const HASH_ITERATIONS = 310000;
const HASH_KEY_LENGTH = 32;
const HASH_DIGEST = "sha256";

type PasswordStore = {
  salt: string;
  hash: string;
  iterations: number;
  keyLength: number;
  digest: string;
  updatedAt: string;
};

function timingSafeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && crypto.timingSafeEqual(aBuffer, bBuffer);
}

function hashPassword(password: string, salt: string, iterations = HASH_ITERATIONS) {
  return crypto.pbkdf2Sync(password, salt, iterations, HASH_KEY_LENGTH, HASH_DIGEST).toString("hex");
}

function readPasswordStore(): PasswordStore | null {
  if (!fs.existsSync(passwordStorePath)) return null;
  return JSON.parse(fs.readFileSync(passwordStorePath, "utf-8")) as PasswordStore;
}

export function verifyAdminPassword(password: string) {
  const store = readPasswordStore();

  if (store) {
    const hash = hashPassword(password, store.salt, store.iterations);
    return timingSafeEqual(hash, store.hash);
  }

  const envPassword = process.env.ADMIN_PASSWORD;
  if (!envPassword) return false;
  return timingSafeEqual(password, envPassword);
}

export function changeAdminPassword(currentPassword: string, nextPassword: string) {
  if (!verifyAdminPassword(currentPassword)) {
    return { ok: false, error: "Current password is incorrect." };
  }

  if (nextPassword.length < 12) {
    return { ok: false, error: "New password must be at least 12 characters." };
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const store: PasswordStore = {
    salt,
    hash: hashPassword(nextPassword, salt),
    iterations: HASH_ITERATIONS,
    keyLength: HASH_KEY_LENGTH,
    digest: HASH_DIGEST,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(passwordStorePath, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  return { ok: true };
}

export function createAdminSession() {
  const issuedAt = Date.now().toString();
  return `${issuedAt}.${sign(issuedAt)}`;
}

export function isValidAdminSession(session?: string) {
  if (!session) return false;
  const [issuedAt, signature] = session.split(".");
  if (!issuedAt || !signature) return false;
  if (sign(issuedAt) !== signature) return false;

  const ageSeconds = (Date.now() - Number(issuedAt)) / 1000;
  return Number.isFinite(ageSeconds) && ageSeconds <= MAX_AGE_SECONDS;
}

export { COOKIE_NAME, MAX_AGE_SECONDS };

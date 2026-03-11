import { createHash, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "blink_admin_session";

function getRequiredEnv(name: "ADMIN_EMAIL" | "ADMIN_PASSWORD" | "ADMIN_SESSION_SECRET") {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getAdminCredentials() {
  return {
    email: getRequiredEnv("ADMIN_EMAIL"),
    password: getRequiredEnv("ADMIN_PASSWORD"),
  };
}

export function createSessionToken() {
  const { email, password } = getAdminCredentials();
  const secret = getRequiredEnv("ADMIN_SESSION_SECRET");

  return createHash("sha256")
    .update(`${email}:${password}:${secret}`)
    .digest("hex");
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function isValidLogin(email: string, password: string) {
  const admin = getAdminCredentials();
  return safeCompare(email, admin.email) && safeCompare(password, admin.password);
}

export async function isAuthenticated() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return false;
  }

  return safeCompare(sessionCookie, createSessionToken());
}

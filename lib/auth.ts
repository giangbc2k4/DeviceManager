import { createHash, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "blink_admin_session";
export const SESSION_EMAIL_COOKIE_NAME = "blink_admin_email";

function getRequiredEnv(name: "ADMIN_SESSION_SECRET") {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getAdminAccounts(): Array<{email: string, password: string}> {
  // Format mới hỗ trợ nhiều tài khoản
  const multiStr = process.env.ADMIN_ACCOUNTS;
  if (multiStr) {
    return multiStr.split(",").map(item => {
      const [email, password] = item.split(":");
      return { email: email?.trim() || "", password: password?.trim() || "" };
    }).filter(a => a.email && a.password);
  }

  // Backup cho format cũ
  return [{
    email: process.env.ADMIN_EMAIL?.trim() || "",
    password: process.env.ADMIN_PASSWORD?.trim() || "",
  }];
}

export function createSessionToken(email: string) {
  const accounts = getAdminAccounts();
  const account = accounts.find(a => a.email === email);
  if (!account) return "";
  const secret = getRequiredEnv("ADMIN_SESSION_SECRET");

  return createHash("sha256")
    .update(`${account.email}:${account.password}:${secret}`)
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
  const accounts = getAdminAccounts();
  const account = accounts.find(a => safeCompare(email, a.email));
  if (!account) return false;
  
  return safeCompare(password, account.password);
}

export async function isAuthenticated() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const cookieEmail = cookieStore.get(SESSION_EMAIL_COOKIE_NAME)?.value?.trim();

  if (!sessionCookie || !cookieEmail) {
    return false;
  }

  const expectedToken = createSessionToken(cookieEmail);
  if (!expectedToken) return false;
  
  return safeCompare(sessionCookie, expectedToken);
}

export async function getAuthenticatedAdminEmail() {
  const authenticated = await isAuthenticated();
  if (!authenticated) return null;

  const cookieStore = await cookies();
  const cookieEmail = cookieStore.get(SESSION_EMAIL_COOKIE_NAME)?.value?.trim();
  if (cookieEmail) return cookieEmail;

  return null;
}

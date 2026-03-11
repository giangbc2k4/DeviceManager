import { NextResponse } from "next/server";

import { createSessionToken, isValidLogin, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };

  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";

  if (!isValidLogin(email, password)) {
    return NextResponse.json(
      { message: "Sai email hoặc mật khẩu." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: createSessionToken(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return response;
}

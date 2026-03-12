import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import { updateExpireDate } from "@/lib/google-sheets";

export async function POST(request: Request) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { mac?: string; expireDate?: string };
  const mac = body.mac?.trim() || "";
  const expireDate = body.expireDate?.trim() || "";

  if (!mac || !expireDate) {
    return NextResponse.json({ message: "Missing MAC or expire date" }, { status: 400 });
  }

  try {
    const result = await updateExpireDate(mac, expireDate);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update expire date";
    return NextResponse.json({ message }, { status: 400 });
  }
}

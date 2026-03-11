import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import { toggleDeviceLock } from "@/lib/google-sheets";

export async function POST(request: Request) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { mac?: string };
  const mac = body.mac?.trim() || "";

  if (!mac) {
    return NextResponse.json({ message: "Missing MAC" }, { status: 400 });
  }

  try {
    const result = await toggleDeviceLock(mac);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update device";
    return NextResponse.json({ message }, { status: 400 });
  }
}

import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import { updateDeviceLicense } from "@/lib/google-sheets";

export async function POST(request: Request) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { mac?: string; license?: string };
  const mac = body.mac?.trim() || "";
  const license = body.license?.trim() || "";

  if (!mac || !license) {
    return NextResponse.json({ message: "Missing MAC or license" }, { status: 400 });
  }

  try {
    const result = await updateDeviceLicense(mac, license);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update license";
    return NextResponse.json({ message }, { status: 400 });
  }
}

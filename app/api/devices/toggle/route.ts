import { NextResponse } from "next/server";

import { isAuthenticated, getAuthenticatedAdminEmail } from "@/lib/auth";
import { toggleDeviceLock, logAdminAction } from "@/lib/google-sheets";

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
    const user = await getAuthenticatedAdminEmail() || "Unknown";
    await logAdminAction(mac, user, "Toggle Lock", `Phòng ${result.room || "Không rõ"}: Thay đổi trạng thái thành ${result.status}`);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update device";
    return NextResponse.json({ message }, { status: 400 });
  }
}

import { NextResponse } from "next/server";

import { isAuthenticated, getAuthenticatedAdminEmail } from "@/lib/auth";
import { updateDeviceLicense, logAdminAction } from "@/lib/google-sheets";

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
    const user = await getAuthenticatedAdminEmail() || "Unknown";
    await logAdminAction(mac, user, "Change License", `Phòng ${result.room || "Không rõ"}: Đổi gói bản quyền thành ${license.toUpperCase()}`);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update license";
    return NextResponse.json({ message }, { status: 400 });
  }
}

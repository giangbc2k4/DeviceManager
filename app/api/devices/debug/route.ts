import { NextRequest, NextResponse } from "next/server";
import { updateDeviceDebug, logAdminAction } from "@/lib/google-sheets";
import { getAuthenticatedAdminEmail } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { mac, debug } = await req.json();
    if (!mac || typeof debug !== "boolean") {
      return NextResponse.json({ message: "Thiếu thông tin MAC hoặc debug" }, { status: 400 });
    }
    const result = await updateDeviceDebug(mac, debug);
    const user = await getAuthenticatedAdminEmail() || "Unknown";
    await logAdminAction(mac, user, "Toggle Debug", `Phòng ${result.room || "Không rõ"}: Đã ${debug ? "Bật" : "Tắt"} tải Log (Debug)`);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ message: err.message || "Lỗi không xác định" }, { status: 500 });
  }
}

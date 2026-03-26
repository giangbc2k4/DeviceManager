import { NextRequest, NextResponse } from "next/server";
import { updateDeviceDebug } from "@/lib/google-sheets";

export async function POST(req: NextRequest) {
  try {
    const { mac, debug } = await req.json();
    if (!mac || typeof debug !== "boolean") {
      return NextResponse.json({ message: "Thiếu thông tin MAC hoặc debug" }, { status: 400 });
    }
    const result = await updateDeviceDebug(mac, debug);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ message: err.message || "Lỗi không xác định" }, { status: 500 });
  }
}

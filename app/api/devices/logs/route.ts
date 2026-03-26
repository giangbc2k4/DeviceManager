import { NextRequest, NextResponse } from "next/server";
import { listDeviceLogs } from "@/lib/google-sheets";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mac = searchParams.get("mac") || undefined;
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const logs = await listDeviceLogs(mac, limit);
    return NextResponse.json({ logs });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || "Lỗi không xác định" }, { status: 500 });
  }
}

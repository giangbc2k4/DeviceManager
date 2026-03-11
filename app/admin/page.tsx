import Link from "next/link";
import { redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";
import { listDevices } from "@/lib/google-sheets";
import { DeviceTable } from "./device-table";

export default async function AdminPage() {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    redirect("/");
  }

  let devices = [] as Awaited<ReturnType<typeof listDevices>>;
  let sheetError = "";

  try {
    devices = await listDevices();
  } catch (error) {
    sheetError = error instanceof Error ? error.message : "Failed to load devices";
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#f7e8c8,_#efe8dc_35%,_#d8d0c1_100%)] px-6 py-10 text-stone-900">
      <div className="mx-auto max-w-5xl rounded-[32px] border border-stone-900/10 bg-white/80 p-8 shadow-[0_20px_80px_rgba(60,40,10,0.12)] backdrop-blur">
        <div className="flex flex-col gap-4 border-b border-stone-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-amber-700">Device Manager</p>
            <h1 className="mt-2 text-3xl font-semibold">Đăng nhập thành công</h1>
            <p className="mt-2 max-w-2xl text-sm text-stone-600">
              Quản lý thiết bị, trạng thái hoạt động và giấy phép của từng máy trong hệ thống.
            </p>
          </div>

          <form action="/api/logout" method="post">
            <button className="rounded-full border border-stone-300 px-5 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-950 hover:text-stone-950" type="submit">
              Đăng xuất
            </button>
          </form>
        </div>

        <div className="mt-6">
          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700"
              href="/admin/chart"
            >
              Mở trang test biểu đồ theo chat id
            </Link>
            <Link
              className="inline-flex rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:border-stone-900 hover:text-stone-900"
              href="/admin/sheet1"
            >
              Xem toàn bộ phiên theo ngày
            </Link>
          </div>
        </div>

        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Danh sách thiết bị</h2>
            <p className="text-sm text-stone-600">Tổng: {devices.length}</p>
          </div>

          {sheetError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Không thể tải dữ liệu từ Google Sheets API: {sheetError}
            </div>
          ) : null}

          {!sheetError && devices.length === 0 ? (
            <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-6 text-sm text-stone-600">
              Chưa có thiết bị nào trong sheet.
            </div>
          ) : null}

          {!sheetError && devices.length > 0 ? (
            <DeviceTable devices={devices} />
          ) : null}
        </section>
      </div>
    </main>
  );
}

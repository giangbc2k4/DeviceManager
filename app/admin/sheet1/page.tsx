import Link from "next/link";
import { redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";
import { getSheet1SessionsByDay } from "@/lib/google-sheets";
import type { Sheet1SessionRow } from "@/lib/google-sheets";
import { AutoRefresh } from "./auto-refresh";

function formatHours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}p`;
}

function groupRowsByRoom(rows: Sheet1SessionRow[]) {
  const grouped: Record<string, Sheet1SessionRow[]> = {};

  rows.forEach((row) => {
    if (!grouped[row.room]) {
      grouped[row.room] = [];
    }

    grouped[row.room].push(row);
  });

  return Object.keys(grouped)
    .sort((a, b) => {
      const aRows = grouped[a];
      const bRows = grouped[b];

      const aActive = aRows.some((row) => (row.status || "").toUpperCase() === "OPEN" || !row.end);
      const bActive = bRows.some((row) => (row.status || "").toUpperCase() === "OPEN" || !row.end);

      if (aActive !== bActive) return aActive ? -1 : 1;
      return a.localeCompare(b, "vi");
    })
    .map((room) => {
      const roomRows = grouped[room];
      const totalMinutes = roomRows.reduce((sum, item) => sum + item.minutes, 0);
      const isActive = roomRows.some((row) => (row.status || "").toUpperCase() === "OPEN" || !row.end);
      return {
        room,
        totalMinutes,
        isActive,
        rows: roomRows,
      };
    });
}

function groupRowsByChatId(rows: Sheet1SessionRow[]) {
  const grouped: Record<string, Sheet1SessionRow[]> = {};

  rows.forEach((row) => {
    const chatKey = row.chatId || "(trống)";
    if (!grouped[chatKey]) {
      grouped[chatKey] = [];
    }

    grouped[chatKey].push(row);
  });

  return Object.keys(grouped)
    .sort((a, b) => a.localeCompare(b, "vi"))
    .map((chatId) => {
      const chatRows = grouped[chatId];
      const totalMinutes = chatRows.reduce((sum, item) => sum + item.minutes, 0);
      return {
        chatId,
        totalMinutes,
        rooms: groupRowsByRoom(chatRows),
      };
    });
}

export default async function AdminSheet1Page() {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    redirect("/");
  }

  let dayGroups = [] as Awaited<ReturnType<typeof getSheet1SessionsByDay>>;
  let sheetError = "";

  try {
    dayGroups = await getSheet1SessionsByDay();
  } catch (error) {
    sheetError = error instanceof Error ? error.message : "Failed to load activity data";
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#f7e8c8,_#efe8dc_35%,_#d8d0c1_100%)] px-6 py-10 text-stone-900">
      <AutoRefresh intervalMs={5000} />
      <div className="mx-auto max-w-6xl rounded-[32px] border border-stone-900/10 bg-white/80 p-8 shadow-[0_20px_80px_rgba(60,40,10,0.12)] backdrop-blur">
        <div className="flex flex-col gap-3 border-b border-stone-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-amber-700">Device Manager</p>
            <h1 className="mt-2 text-3xl font-semibold">Toàn bộ phiên từ Sheet1</h1>
            <p className="mt-2 text-sm text-stone-600">Dữ liệu được nhóm theo ngày để admin dễ kiểm tra lịch sử hoạt động. Trang tự làm mới mỗi 5 giây.</p>
          </div>

          <Link
            className="inline-flex rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:border-stone-900 hover:text-stone-900"
            href="/admin"
          >
            Quay lại trang admin
          </Link>
        </div>

        {sheetError ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Không thể tải dữ liệu từ Sheet1: {sheetError}
          </div>
        ) : null}

        {!sheetError && dayGroups.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-6 text-sm text-stone-600">
            Chưa có dữ liệu phiên nào trong Sheet1.
          </div>
        ) : null}

        {!sheetError ? (
          <div className="mt-6 space-y-6">
            {dayGroups.map((group) => {
              const rooms = groupRowsByRoom(group.rows);

              return (
                <section className="rounded-2xl border border-stone-200 bg-white" key={group.dateKey}>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
                    <h2 className="text-lg font-semibold text-stone-900">Ngày {group.dateLabel}</h2>
                    <div className="flex items-center gap-3 text-sm text-stone-600">
                      <span>{group.totalSessions} phiên</span>
                      <span>{rooms.length} phòng</span>
                      <span className="rounded-full bg-orange-100 px-3 py-1 font-semibold text-orange-700">
                        {formatHours(group.totalMinutes)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4 p-4">
                    {groupRowsByChatId(group.rows).map((chatGroup) => (
                      <section className="rounded-xl border border-stone-200" key={`${group.dateKey}-${chatGroup.chatId}`}>
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 bg-stone-50 px-4 py-3">
                          <h3 className="text-base font-semibold text-stone-900">Chat ID: {chatGroup.chatId === "(trống)" ? "-" : chatGroup.chatId}</h3>
                          <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.08em] text-stone-600">
                            <span>{chatGroup.rooms.length} phòng</span>
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">
                              {formatHours(chatGroup.totalMinutes)}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-3 p-3">
                          {chatGroup.rooms.map((roomGroup) => (
                            <section className={`rounded-lg border ${roomGroup.isActive ? "border-emerald-300 bg-emerald-50/40" : "border-stone-200"}`} key={`${group.dateKey}-${chatGroup.chatId}-${roomGroup.room}`}>
                              <div className={`flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-2 ${roomGroup.isActive ? "bg-emerald-50" : "bg-white"}`}>
                                <p className="text-sm font-semibold text-stone-800">Phòng {roomGroup.room}</p>
                                <div className="flex items-center gap-2 text-xs text-stone-600">
                                  {roomGroup.isActive ? (
                                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 font-semibold text-white">Đang hoạt động</span>
                                  ) : null}
                                  <span className="rounded-full bg-orange-100 px-2 py-0.5 font-semibold text-orange-700">
                                    {formatHours(roomGroup.totalMinutes)}
                                  </span>
                                </div>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-stone-200 text-sm">
                                  <thead className="bg-white text-left text-xs uppercase tracking-[0.12em] text-stone-500">
                                    <tr>
                                      <th className="px-4 py-3">Bắt đầu</th>
                                      <th className="px-4 py-3">Kết thúc</th>
                                      <th className="px-4 py-3">Phút</th>
                                      <th className="px-4 py-3">Duration</th>
                                      <th className="px-4 py-3">Trạng thái</th>
                                      <th className="px-4 py-3">Last seen</th>
                                      <th className="px-4 py-3">WiFi</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-stone-100">
                                    {roomGroup.rows.map((row) => (
                                      <tr key={String(row.rowNumber)}>
                                        <td className="px-4 py-3">{row.start}</td>
                                        <td className="px-4 py-3">{row.end || "-"}</td>
                                        <td className="px-4 py-3">{row.minutes}</td>
                                        <td className="px-4 py-3">{row.duration || "-"}</td>
                                        <td className="px-4 py-3">{row.status || "-"}</td>
                                        <td className="px-4 py-3">{row.lastSeen || "-"}</td>
                                        <td className="px-4 py-3">{row.wifiSignal || "-"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </section>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : null}
      </div>
    </main>
  );
}

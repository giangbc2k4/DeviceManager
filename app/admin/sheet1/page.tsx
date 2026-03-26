import { getSheet1SessionsByDay, listDevices } from "@/lib/google-sheets";
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
      return { room, totalMinutes, isActive, rows: roomRows };
    });
}

function groupRowsByChatId(rows: Sheet1SessionRow[]) {
  const grouped: Record<string, Sheet1SessionRow[]> = {};

  rows.forEach((row) => {
    let chatKey = row.chatId || "(trống)";
    if (chatKey === "-5021046267" || chatKey === "-1003686987675") {
      chatKey = "-1003686987675 (bao gồm -5021046267)";
    }
    
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
      return { chatId, totalMinutes, rooms: groupRowsByRoom(chatRows) };
    });
}

export default async function AdminSheet1Page() {
  let dayGroups = [] as Awaited<ReturnType<typeof getSheet1SessionsByDay>>;
  let devices = [] as Awaited<ReturnType<typeof listDevices>>;
  let sheetError = "";

  try {
    [dayGroups, devices] = await Promise.all([
      getSheet1SessionsByDay(),
      listDevices(),
    ]);
  } catch (error) {
    sheetError = error instanceof Error ? error.message : "Failed to load activity data";
  }

  return (
    <>
      <AutoRefresh intervalMs={5000} />

      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end">
        <div>
          <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900">Phiên hoạt động</h2>
          <p className="mt-1 text-sm text-slate-500">
            Dữ liệu được nhóm theo ngày để admin dễ kiểm tra lịch sử. Tự làm mới mỗi 5 giây.
          </p>
        </div>
      </div>

      {sheetError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Không thể tải dữ liệu từ Sheet1: {sheetError}
        </div>
      ) : null}

      {!sheetError && dayGroups.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center">
          <span className="material-symbols-outlined text-slate-300 text-[48px] mb-3 block">event_busy</span>
          <p className="text-sm text-slate-500">Chưa có dữ liệu phiên nào trong Sheet1.</p>
        </div>
      ) : null}

      {!sheetError ? (
        <div className="space-y-6">
          {dayGroups.map((group) => {
            const rooms = groupRowsByRoom(group.rows);
            const roomVersionMap = new Map(devices.map((d) => [d.room, d.version || "N/A"]));

            return (
              <section className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden" key={group.dateKey}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 lg:px-8 py-5 lg:py-6">
                  <h3 className="text-lg font-bold text-slate-900">Ngày {group.dateLabel}</h3>
                  <div className="flex items-center gap-3 text-sm text-slate-500">
                    <span>{group.totalSessions} phiên</span>
                    <span>{rooms.length} phòng</span>
                    <span className="rounded-full bg-orange-100 px-3 py-1 font-semibold text-orange-700 text-[10px] uppercase tracking-wider">
                      {formatHours(group.totalMinutes)}
                    </span>
                  </div>
                </div>

                <div className="space-y-4 p-4 lg:p-6">
                  {groupRowsByChatId(group.rows).map((chatGroup) => (
                    <section
                      className="rounded-xl border border-slate-100 overflow-hidden"
                      key={`${group.dateKey}-${chatGroup.chatId}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-4">
                        <h4 className="text-sm font-semibold text-slate-800">
                          Chat ID: {chatGroup.chatId === "(trống)" ? "Không có" : chatGroup.chatId}
                        </h4>
                        <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-widest text-slate-500">
                          <span>{chatGroup.rooms.length} phòng</span>
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800 font-bold">
                            {formatHours(chatGroup.totalMinutes)}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-4 p-4 lg:p-5">
                        {chatGroup.rooms.map((roomGroup) => (
                          <section
                            className={`rounded-lg border overflow-hidden ${
                              roomGroup.isActive
                                ? "border-emerald-300 ring-2 ring-emerald-100"
                                : "border-slate-100"
                            }`}
                            key={`${group.dateKey}-${chatGroup.chatId}-${roomGroup.room}`}
                          >
                            <div
                              className={`flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 ${
                                roomGroup.isActive ? "bg-emerald-50/80" : "bg-slate-50/50"
                              }`}
                            >
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-slate-800">
                                    Phòng {roomGroup.room}
                                  </p>
                                  {roomVersionMap.get(roomGroup.room) && roomVersionMap.get(roomGroup.room) !== "N/A" && (
                                    <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                                      v{roomVersionMap.get(roomGroup.room)}
                                    </span>
                                  )}
                                </div>
                              <div className="flex items-center gap-2 text-xs text-slate-600">
                                {roomGroup.isActive ? (
                                  <span className="rounded-full bg-emerald-600 px-2 py-0.5 font-semibold text-white text-[10px]">
                                    Đang hoạt động
                                  </span>
                                ) : null}
                                <span className="rounded-full bg-orange-100 px-2 py-0.5 font-semibold text-orange-700 text-[10px]">
                                  {formatHours(roomGroup.totalMinutes)}
                                </span>
                              </div>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-slate-100 text-left">
                                <thead>
                                  <tr className="bg-slate-50/30">
                                    <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Bắt đầu</th>
                                    <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Kết thúc</th>
                                    <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Phút</th>
                                    <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Duration</th>
                                    <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Trạng thái</th>
                                    <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Last seen</th>
                                    <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest">WiFi</th>
                                    <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-center">Phiên bản</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                  {roomGroup.rows.map((row) => (
                                    <tr key={String(row.rowNumber)} className="hover:bg-slate-50/60 transition-colors">
                                      <td className="px-5 py-3.5 text-xs text-slate-600 font-medium">{row.start}</td>
                                      <td className="px-5 py-3.5 text-xs text-slate-600">{row.end || "-"}</td>
                                      <td className="px-5 py-3.5 text-xs text-slate-900 font-semibold">{row.minutes}</td>
                                      <td className="px-5 py-3.5 text-xs text-slate-600">{row.duration || "-"}</td>
                                      <td className="px-5 py-3.5">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                          (row.status || "").toUpperCase() === "ON" || (row.status || "").toUpperCase() === "OPEN"
                                            ? "bg-emerald-100 text-emerald-700" 
                                            : "bg-slate-100 text-slate-600"
                                        }`}>
                                          {row.status || "-"}
                                        </span>
                                      </td>
                                      <td className="px-5 py-3.5 text-xs text-slate-600">{row.lastSeen || "-"}</td>
                                      <td className="px-5 py-3.5 text-xs font-mono text-slate-500">{row.wifiSignal || "-"}</td>
                                      <td className="px-5 py-3.5 text-xs font-mono text-slate-500 text-center">
                                        {row.fwVersion ? (
                                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-slate-600">
                                            v{row.fwVersion}
                                          </span>
                                        ) : "-"}
                                      </td>
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
    </>
  );
}

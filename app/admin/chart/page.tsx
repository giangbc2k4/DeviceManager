import Link from "next/link";

import { getDailyDebugByChatId } from "@/lib/google-sheets";
import TimelineScroll from "@/app/report/timeline-scroll";

type ChartPageProps = {
  searchParams?: Promise<{
    chatId?: string;
  }>;
};

function formatHours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}p`;
}

function formatTimeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export default async function AdminChartPage({ searchParams }: ChartPageProps) {
  const resolved = searchParams ? await searchParams : undefined;
  const chatId = (resolved?.chatId || "").trim();
  const hasChatId = chatId.length > 0;

  const debug = await getDailyDebugByChatId(chatId);
  const windowStartMs = new Date(debug.windowStartIso).getTime();
  const windowEndMs = new Date(debug.windowEndIso).getTime();
  const windowDurationMs = Math.max(windowEndMs - windowStartMs, 1);

  const timelineTicks = Array.from({ length: 13 }, (_, i) => {
    const hourOffset = i * 2;
    const hour = (6 + hourOffset) % 24;
    const label = `${String(hour).padStart(2, "0")}:00`;
    return { label, hourOffset };
  });

  const hasRoomData = hasChatId && debug.rooms.length > 0;
  const hasRawData = hasChatId && debug.rawRows.length > 0;

  return (
    <>
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end">
        <div>
          <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900">Biểu đồ theo Chat ID</h2>
          <p className="mt-1 text-sm text-slate-500">
            Giao diện đồng bộ với trang Báo cáo hoạt động để test dữ liệu nhanh trong khu admin.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors"
            href="/admin/chart?chatId=-1003402337213"
          >
            Test với ID mẫu
          </Link>
        </div>
      </div>

      {/* Search form */}
      <form
        action="/admin/chart"
        className="mb-8 grid gap-3 rounded-xl border border-slate-100 bg-white shadow-sm p-4 md:grid-cols-[1fr_auto]"
      >
        <input
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          defaultValue={chatId}
          name="chatId"
          placeholder="Nhập chat id, ví dụ: -1003402337213"
          type="text"
        />
        <button
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
          type="submit"
        >
          Vẽ biểu đồ
        </button>
      </form>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 mb-8 lg:mb-10">
        <div className="rounded-xl shadow-sm border border-slate-900 bg-slate-900 p-5 lg:p-6 text-white transition-transform hover:-translate-y-1 duration-200">
          <p className="text-[10px] uppercase tracking-widest text-amber-300 font-bold mb-1">Chat ID</p>
          <p className="break-all text-xl lg:text-2xl font-bold mt-1">{hasChatId ? chatId : "Chưa nhập"}</p>
        </div>
        <div className="bg-white p-5 lg:p-6 rounded-xl shadow-sm border border-slate-100 transition-transform hover:-translate-y-1 duration-200">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Tổng thời lượng</p>
          <p className="text-2xl lg:text-3xl font-extrabold tracking-tighter text-blue-600 mt-1">{formatHours(debug.totalMinutes)}</p>
        </div>
        <div className="bg-white p-5 lg:p-6 rounded-xl shadow-sm border border-slate-100 transition-transform hover:-translate-y-1 duration-200">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Khung thời gian</p>
          <p className="text-sm lg:text-base font-semibold text-slate-900 mt-2">{debug.windowStart} → {debug.windowEnd}</p>
        </div>
      </div>

      {/* Timeline section */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden p-5 lg:p-8">
        <h3 className="text-lg font-bold text-slate-900">Biểu đồ timeline trong ngày</h3>
        <p className="mt-1 text-sm text-slate-500">Mỗi hàng là một phòng, mỗi đoạn màu là một phiên hoạt động.</p>

        {hasChatId ? (
          <p className="mt-2 text-sm text-slate-700">
            Ngày báo cáo: <span className="font-semibold">{debug.dateLabel}</span>
          </p>
        ) : null}

        {!hasChatId ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Nhập chatId để xem báo cáo hoạt động của đoạn chat tương ứng.
          </div>
        ) : null}

        {hasChatId && debug.rooms.length === 0 ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Không có dữ liệu cho chat id này trong khung ngày hôm qua.
          </div>
        ) : null}

        {hasRoomData ? (
          <TimelineScroll className="mt-5 overflow-x-auto rounded-lg border border-slate-200 p-4">
            <div className="min-w-[820px]">
              <div
                className="ml-[130px] mb-2 grid text-[11px] font-semibold text-slate-500"
                style={{ gridTemplateColumns: `repeat(${timelineTicks.length}, minmax(0, 1fr))` }}
              >
                {timelineTicks.map((tick) => (
                  <div className="text-center" key={tick.label + String(tick.hourOffset)}>
                    {tick.label}
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                {debug.rooms.map((room) => (
                  <div className="grid grid-cols-[120px_1fr] items-center gap-3" key={`timeline-${room.room}`}>
                    <div>
                      <p className="truncate text-sm font-semibold text-slate-900">{room.room}</p>
                      <p className="text-xs text-slate-500">{room.count} lượt • {room.totalMinutes} phút</p>
                    </div>

                    <div className="relative h-10 overflow-hidden rounded-lg bg-slate-100">
                      {timelineTicks.slice(1, -1).map((tick) => {
                        const left = ((tick.hourOffset * 60 * 60 * 1000) / windowDurationMs) * 100;
                        const strong = tick.hourOffset % 6 === 0;
                        return (
                          <div
                            className={`absolute top-0 h-full w-px ${strong ? "bg-slate-400" : "bg-slate-300/70"}`}
                            key={`grid-${room.room}-${tick.hourOffset}`}
                            style={{ left: `${left}%` }}
                          />
                        );
                      })}

                      {room.mergedSessions.map((session, idx) => {
                        const startMs = new Date(session.startIso).getTime();
                        const endMs = new Date(session.endIso).getTime();
                        const leftPct = ((startMs - windowStartMs) / windowDurationMs) * 100;
                        const widthPct = Math.max(((endMs - startMs) / windowDurationMs) * 100, 0.8);

                        return (
                          <div
                            className="absolute top-1/2 h-5 -translate-y-1/2 rounded-md bg-[linear-gradient(90deg,#f59e0b,#dc2626)]"
                            key={`${room.room}-${idx}`}
                            style={{ left: `${Math.max(leftPct, 0)}%`, width: `${Math.min(widthPct, 100)}%` }}
                            title={`${formatTimeLabel(session.startIso)} - ${formatTimeLabel(session.endIso)} (${session.minutes} phút)`}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TimelineScroll>
        ) : null}

        {hasRoomData ? (
          <div className="mt-8 overflow-x-auto rounded-xl border border-slate-100 shadow-sm">
            <table className="min-w-full divide-y divide-slate-100 text-left">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Phòng</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Số lượt (merge)</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Tổng phút</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {debug.rooms.map((item) => (
                  <tr key={item.room} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">Phòng {item.room}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{item.count}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-semibold">{item.totalMinutes} phút</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {hasRawData ? (
          <>
            <h3 className="mt-8 text-base font-semibold text-slate-900">Dữ liệu thô đã lọc theo chat id</h3>
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Phòng</th>
                    <th className="px-4 py-3">Bắt đầu</th>
                    <th className="px-4 py-3">Kết thúc</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Last seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {debug.rawRows.map((row, index) => (
                    <tr key={`${row.room}-${row.start}-${index}`}>
                      <td className="px-4 py-3 font-medium text-slate-900">Phòng {row.room}</td>
                      <td className="px-4 py-3">{row.start}</td>
                      <td className="px-4 py-3">{row.end}</td>
                      <td className="px-4 py-3">{row.status || "-"}</td>
                      <td className="px-4 py-3">{row.duration || "-"}</td>
                      <td className="px-4 py-3">{row.lastSeen || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        {hasRoomData ? (
          <>
            <h3 className="mt-8 text-base font-semibold text-slate-900">Chi tiết phiên</h3>
            <div className="mt-3 space-y-4">
              {debug.rooms.map((room) => (
                <div className="rounded-lg border border-slate-200 p-4" key={`merged-${room.room}`}>
                  <p className="text-sm font-semibold text-slate-900">Phòng {room.room}</p>
                  <div className="mt-2 overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-widest text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Bắt đầu</th>
                          <th className="px-3 py-2">Kết thúc</th>
                          <th className="px-3 py-2">Phút</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {room.mergedSessions.map((session, idx) => (
                          <tr key={`${room.room}-${idx}`}>
                            <td className="px-3 py-2">{session.start}</td>
                            <td className="px-3 py-2">{session.end}</td>
                            <td className="px-3 py-2">{session.minutes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </>
  );
}

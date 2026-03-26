import { getDailyDebugByChatId } from "@/lib/google-sheets";
import TimelineScroll from "./timeline-scroll";

type ReportViewProps = {
  chatId: string;
  reportDate: string;
};

function formatHours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}p`;
}

function formatTimeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export default async function ReportView({ chatId, reportDate }: ReportViewProps) {
  const normalizedChatId = chatId.trim();
  const hasChatId = normalizedChatId.length > 0;
  const debug = await getDailyDebugByChatId(normalizedChatId, reportDate);
  const windowStartMs = new Date(debug.windowStartIso).getTime();
  const windowEndMs = new Date(debug.windowEndIso).getTime();
  const windowDurationMs = Math.max(windowEndMs - windowStartMs, 1);
  const hasRoomData = hasChatId && debug.rooms.length > 0;

  const timelineTicks = Array.from({ length: 13 }, (_, i) => {
    const hourOffset = i * 2;
    const hour = (6 + hourOffset) % 24;
    const label = `${String(hour).padStart(2, "0")}:00`;
    return { label, hourOffset };
  });

  return (
    <main className="min-h-screen px-4 py-8 md:px-8 md:py-12 bg-slate-50/50">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-blue-600 font-bold mb-2">Device Manager</p>
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900">Báo cáo hoạt động</h1>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 mb-8 lg:mb-10">
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
          <h2 className="text-lg font-bold text-slate-900">Biểu đồ timeline trong ngày</h2>
          <p className="mt-1 text-sm text-slate-500">Mỗi hàng là một phòng, mỗi đoạn màu là một phiên hoạt động.</p>

          {hasChatId ? (
            <p className="mt-2 text-sm text-slate-700">Ngày báo cáo: <span className="font-semibold">{debug.dateLabel}</span></p>
          ) : null}

          {!hasChatId ? (
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Nhập `chatId` để xem báo cáo hoạt động của đoạn chat tương ứng.
            </div>
          ) : null}

          {hasChatId && debug.rooms.length === 0 ? (
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Không có dữ liệu cho chat id này trong khung ngày hôm qua.
            </div>
          ) : null}

          {hasRoomData ? (
            <TimelineScroll className="mt-6 overflow-x-auto rounded-xl border border-slate-100 shadow-sm p-4">
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

          {hasRoomData ? (
            <>
              <h3 className="mt-8 text-base font-semibold text-slate-900">Chi tiết phiên</h3>
              <div className="mt-3 space-y-4">
                {debug.rooms.map((room) => (
                  <div className="rounded-xl border border-slate-100 p-4" key={`merged-${room.room}`}>
                    <p className="text-sm font-semibold text-slate-900">Phòng {room.room}</p>
                    <div className="mt-3 overflow-x-auto rounded-lg border border-slate-100">
                      <table className="min-w-full divide-y divide-slate-100 text-left">
                        <thead>
                          <tr className="bg-slate-50/80">
                            <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Bắt đầu</th>
                            <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Kết thúc</th>
                            <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Phút</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 bg-white">
                          {room.mergedSessions.map((session, idx) => (
                            <tr key={`${room.room}-${idx}`} className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-4 py-3 text-xs text-slate-600 font-medium">{session.start}</td>
                              <td className="px-4 py-3 text-xs text-slate-600">{session.end}</td>
                              <td className="px-4 py-3 text-xs text-slate-900 font-semibold">{session.minutes}</td>
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
      </div>
    </main>
  );
}
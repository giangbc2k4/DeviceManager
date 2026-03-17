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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#f7e8c8,_#efe8dc_35%,_#d8d0c1_100%)] px-2 py-4 md:px-6 md:py-10 text-stone-900">
      <div className="mx-auto max-w-5xl rounded-[32px] border border-stone-900/10 bg-white/80 p-4 md:p-8 shadow-[0_20px_80px_rgba(60,40,10,0.12)] backdrop-blur">
        <div className="flex flex-col gap-3 border-b border-stone-200 pb-6">
          <p className="text-xs uppercase tracking-[0.35em] text-amber-700">Device Manager</p>
          <h1 className="text-3xl font-semibold">Báo cáo hoạt động</h1>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-stone-500">Tổng thời lượng</p>
            <p className="mt-2 text-2xl font-extrabold text-orange-600">{formatHours(debug.totalMinutes)}</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-stone-500">Khung thời gian</p>
            <p className="mt-2 text-sm font-semibold text-stone-900">{debug.windowStart} → {debug.windowEnd}</p>
          </div>
        </div>

        <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-stone-900">Biểu đồ timeline trong ngày</h2>
          <p className="mt-1 text-sm text-stone-600">Mỗi hàng là một phòng, mỗi đoạn màu là một phiên hoạt động.</p>

          {hasChatId ? (
            <p className="mt-2 text-sm text-stone-700">Ngày báo cáo: <span className="font-semibold">{debug.dateLabel}</span></p>
          ) : null}

          {!hasChatId ? (
            <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
              Nhập `chatId` để xem báo cáo hoạt động của đoạn chat tương ứng.
            </div>
          ) : null}

          {hasChatId && debug.rooms.length === 0 ? (
            <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
              Không có dữ liệu cho chat id này trong khung ngày hôm qua.
            </div>
          ) : null}

          {hasRoomData ? (
            <TimelineScroll className="mt-5 overflow-x-auto rounded-xl border border-stone-200 p-4">
              <div className="min-w-[820px]">
                <div
                  className="ml-[130px] mb-2 grid text-[11px] font-semibold text-stone-500"
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
                        <p className="truncate text-sm font-semibold text-stone-900">{room.room}</p>
                        <p className="text-xs text-stone-500">{room.count} lượt • {room.totalMinutes} phút</p>
                      </div>

                      <div className="relative h-10 overflow-hidden rounded-lg bg-stone-100">
                        {timelineTicks.slice(1, -1).map((tick) => {
                          const left = ((tick.hourOffset * 60 * 60 * 1000) / windowDurationMs) * 100;
                          const strong = tick.hourOffset % 6 === 0;
                          return (
                            <div
                              className={`absolute top-0 h-full w-px ${strong ? "bg-stone-400" : "bg-stone-300/70"}`}
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
            <div className="mt-6 overflow-x-auto rounded-xl border border-stone-200">
              <table className="min-w-full divide-y divide-stone-200 text-sm">
                <thead className="bg-stone-50 text-left text-xs uppercase tracking-[0.12em] text-stone-500">
                  <tr>
                    <th className="px-4 py-3">Phòng</th>
                    <th className="px-4 py-3">Số lượt (merge)</th>
                    <th className="px-4 py-3">Tổng phút</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {debug.rooms.map((item) => (
                    <tr key={item.room}>
                      <td className="px-4 py-3 font-medium text-stone-900">Phòng {item.room}</td>
                      <td className="px-4 py-3">{item.count}</td>
                      <td className="px-4 py-3">{item.totalMinutes} phút</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {hasRoomData ? (
            <>
              <h3 className="mt-8 text-base font-semibold text-stone-900">Chi tiết phiên</h3>
              <div className="mt-3 space-y-4">
                {debug.rooms.map((room) => (
                  <div className="rounded-xl border border-stone-200 p-4" key={`merged-${room.room}`}>
                    <p className="text-sm font-semibold text-stone-900">Phòng {room.room}</p>
                    <div className="mt-2 overflow-x-auto">
                      <table className="min-w-full divide-y divide-stone-200 text-sm">
                        <thead className="bg-stone-50 text-left text-xs uppercase tracking-[0.12em] text-stone-500">
                          <tr>
                            <th className="px-3 py-2">Bắt đầu</th>
                            <th className="px-3 py-2">Kết thúc</th>
                            <th className="px-3 py-2">Phút</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
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
      </div>
    </main>
  );
}
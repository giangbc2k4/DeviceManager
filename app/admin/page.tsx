import { listDevices, getOpenRooms } from "@/lib/google-sheets";
import { DeviceTable } from "./device-table";

export default async function AdminPage() {
  let devices = [] as Awaited<ReturnType<typeof listDevices>>;
  let sheetError = "";

  let openRooms = new Set<string>();

  try {
    [devices, openRooms] = await Promise.all([
      listDevices(),
      getOpenRooms(),
    ]);
  } catch (error) {
    sheetError = error instanceof Error ? error.message : "Failed to load devices";
  }

  // Compute stats
  const totalDevices = devices.length;
  const openRoomNames = Array.from(openRooms);
  const activeDevices = devices.filter(
    (d) => openRoomNames.includes(d.room)
  ).length;
  const lockedDevices = devices.filter(
    (d) => d.status.toUpperCase() === "LOCKED"
  ).length;
  const lifetimeDevices = devices.filter(
    (d) => (d.license || "").toUpperCase() === "LIFETIME"
  ).length;

  const now = new Date();
  const dateStr = now.toLocaleDateString("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const STATS = [
    {
      label: "Tổng thiết bị",
      value: totalDevices,
      icon: "devices",
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
      valueColor: "text-slate-900",
      badge: "Real-time",
      badgeColor: "text-slate-400",
    },
    {
      label: "Đang hoạt động",
      value: String(activeDevices).padStart(2, "0"),
      icon: "sensors",
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      valueColor: "text-emerald-600",
      badge: "Online",
      badgeColor: "text-emerald-500",
      pulse: true,
    },
    {
      label: "Đang khóa",
      value: String(lockedDevices).padStart(2, "0"),
      icon: "lock",
      iconBg: "bg-rose-50",
      iconColor: "text-rose-600",
      valueColor: "text-rose-600",
      badge: "Restricted",
      badgeColor: "text-rose-400",
    },
    {
      label: "LIFETIME",
      value: String(lifetimeDevices).padStart(2, "0"),
      icon: "verified",
      iconBg: "bg-purple-50",
      iconColor: "text-purple-600",
      valueColor: "text-purple-600",
      badge: "Enterprise",
      badgeColor: "text-purple-400",
    },
  ];

  return (
    <>
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end">
        <div>
          <p className="text-slate-500 font-medium mb-1 text-sm">Chào mừng trở lại,</p>
          <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 capitalize">
            {dateStr}
          </h2>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8 lg:mb-10">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="stat-card bg-white p-5 lg:p-6 rounded-xl shadow-sm border border-slate-100"
          >
            <div className="flex justify-between items-start mb-3 lg:mb-4">
              <div className={`p-2.5 lg:p-3 ${stat.iconBg} ${stat.iconColor} rounded-lg`}>
                <span className="material-symbols-outlined">{stat.icon}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {stat.pulse && (
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                )}
                <span className={`text-[10px] font-bold ${stat.badgeColor} tracking-widest uppercase`}>
                  {stat.badge}
                </span>
              </div>
            </div>
            <p className="text-slate-500 text-xs lg:text-sm font-semibold">{stat.label}</p>
            <h3 className={`text-2xl lg:text-3xl font-bold tracking-tighter mt-1 ${stat.valueColor}`}>
              {stat.value}
            </h3>
          </div>
        ))}
      </div>

      {/* Device Table Section */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-4 lg:px-8 py-5 lg:py-6 border-b border-slate-100 flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">Danh sách thiết bị</h3>
          <p className="text-sm text-slate-500">Tổng: {totalDevices} thiết bị</p>
        </div>

        {sheetError ? (
          <div className="px-6 py-8">
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Không thể tải dữ liệu từ Google Sheets API: {sheetError}
            </div>
          </div>
        ) : null}

        {!sheetError && devices.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <span className="material-symbols-outlined text-slate-300 text-[48px] mb-3 block">
              devices_off
            </span>
            <p className="text-sm text-slate-500">Chưa có thiết bị nào trong hệ thống.</p>
          </div>
        ) : null}

        {!sheetError && devices.length > 0 ? (
          <DeviceTable devices={devices} openRooms={openRoomNames} />
        ) : null}
      </section>
    </>
  );
}

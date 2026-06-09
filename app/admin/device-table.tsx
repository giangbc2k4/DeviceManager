"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

import type { DeviceRow } from "@/lib/google-sheets";

type DeviceTableProps = {
  devices: DeviceRow[];
  openRooms: string[];
};

const INITIAL_SHOW_COUNT = 5;

export function DeviceTable({ devices, openRooms }: DeviceTableProps) {
  const router = useRouter();
  const [busyMac, setBusyMac] = useState<string>("");
  const [editingExpire, setEditingExpire] = useState<string>("");
  const [logModalMac, setLogModalMac] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [roomIdFilter, setRoomIdFilter] = useState<string>("");
  const [showRoomIdFilter, setShowRoomIdFilter] = useState(false);

  type ToastType = { message: string; type: "success" | "error" | "info" } | null;
  const [toast, setToast] = useState<ToastType>(null);
  const [toastVisible, setToastVisible] = useState(false);

  function showToast(message: string, type: "success" | "error" | "info") {
    setToast({ message, type });
    setToastVisible(true);
    if (type !== "info") {
      setTimeout(() => setToastVisible(false), 5000);
    }
  }

  function dismissToast() {
    setToastVisible(false);
  }

  // Unique RoomIDs for filter dropdown
  const uniqueRoomIds = [...new Set(devices.map(d => d.chatId).filter(Boolean))];

  // Filter by RoomID, then sort
  const filteredDevices = roomIdFilter
    ? devices.filter(d => d.chatId === roomIdFilter)
    : devices;

  const sortedDevices = [...filteredDevices].sort((a, b) => {
    const aOpen = openRooms.includes(a.room) ? 0 : 1;
    const bOpen = openRooms.includes(b.room) ? 0 : 1;
    if (aOpen !== bOpen) return aOpen - bOpen;
    const aLocked = a.status === "LOCKED" ? 1 : 0;
    const bLocked = b.status === "LOCKED" ? 1 : 0;
    return aLocked - bLocked;
  });

  const visibleDevices = showAll
    ? sortedDevices
    : sortedDevices.slice(0, INITIAL_SHOW_COUNT);
  const hasMore = sortedDevices.length > INITIAL_SHOW_COUNT;

  function formatSheetDate(date: Date) {
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  }

  function addDaysFromNow(days: number) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return formatSheetDate(date);
  }

  // yyyy-MM-dd → dd/MM/yyyy
  function toSheetDate(isoDate: string) {
    const parts = isoDate.split("-");
    if (parts.length !== 3) return "";
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }

  // Close filter dropdown on outside click
  useEffect(() => {
    if (!showRoomIdFilter) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-roomid-filter]")) {
        setShowRoomIdFilter(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showRoomIdFilter]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden && !busyMac) {
        router.refresh();
      }
    }, 8000);

    return () => window.clearInterval(timer);
  }, [router, busyMac]);

  async function handleToggle(mac: string) {
    setBusyMac(mac);
    showToast(`Đang cập nhật thiết bị ${mac}... Không thoát hoặc F5 trang.`, "info");
    try {
      const response = await fetch("/api/devices/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mac }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        showToast(payload.message || "Không thể cập nhật thiết bị", "error");
        return;
      }
      showToast(`Đã thiết lập trạng thái cho thiết bị ${mac}`, "success");
      router.refresh();
    } catch {
      showToast("Không thể kết nối tới máy chủ", "error");
    } finally {
      if (toast?.type === "info") dismissToast();
      setBusyMac("");
    }
  }

  async function handleChangeLicense(mac: string, nextLicense: string) {
    const normalized = nextLicense.toUpperCase();
    setBusyMac(mac);
    showToast(`Đang cập nhật License thiết bị ${mac}... Không thoát hoặc F5 trang.`, "info");
    try {
      const response = await fetch("/api/devices/license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mac, license: normalized }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        showToast(payload.message || "Không thể cập nhật license", "error");
        return;
      }
      showToast(`Cập nhật gói bản quyền cấp cho ${mac} thành công`, "success");
      router.refresh();
    } catch {
      showToast("Không thể kết nối tới máy chủ", "error");
    } finally {
      if (toast?.type === "info") dismissToast();
      setBusyMac("");
    }
  }

  async function handleChangeExpireDate(mac: string, newExpireDate: string) {
    if (!newExpireDate) return;
    setBusyMac(mac);
    showToast(`Đang cập nhật ngày hết hạn ${mac}... Không thoát hoặc F5 trang.`, "info");
    try {
      const response = await fetch("/api/devices/expire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mac, expireDate: newExpireDate }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        showToast(payload.message || "Không thể cập nhật ngày hết hạn", "error");
        return;
      }
      showToast(`Đã gia hạn thành công thiết bị ${mac} tới ngày ${newExpireDate}`, "success");
      router.refresh();
    } catch {
      showToast("Không thể kết nối tới máy chủ", "error");
    } finally {
      if (toast?.type === "info") dismissToast();
      setBusyMac("");
      setEditingExpire("");
    }
  }

  async function handleDelete(mac: string) {
    const accepted = window.confirm(`Xóa thiết bị ${mac} khỏi hệ thống?`);
    if (!accepted) return;
    setBusyMac(mac);
    showToast(`Đang xoá thiết bị ${mac}... Không thoát hoặc F5 trang.`, "info");
    try {
      const response = await fetch("/api/devices/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mac }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        showToast(payload.message || "Không thể xóa thiết bị", "error");
        return;
      }
      showToast(`Thiết bị ${mac} đã bị xoá vĩnh viễn`, "success");
      router.refresh();
    } catch {
      showToast("Không thể kết nối tới máy chủ", "error");
    } finally {
      if (toast?.type === "info") dismissToast();
      setBusyMac("");
    }
  }

  async function handleToggleDebug(mac: string, currentDebug: boolean) {
    setBusyMac(mac);
    showToast(`Đang thiết lập Debug cho ${mac}... Không thoát hoặc F5 trang.`, "info");
    try {
      const response = await fetch("/api/devices/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mac, debug: !currentDebug }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        showToast(payload.message || "Không thể cập nhật debug", "error");
        return;
      }
      showToast(`Cập nhật trạng thái tải Log thành công`, "success");
      router.refresh();
    } catch {
      showToast("Không thể kết nối tới máy chủ", "error");
    } finally {
      if (toast?.type === "info") dismissToast();
      setBusyMac("");
    }
  }

  return (
    <>
      {/* Toast Banner */}
      <div
        className={`fixed inset-x-0 bottom-4 z-50 flex justify-center transition-transform duration-300 ${
          toastVisible ? "translate-y-0" : "translate-y-[150%]"
        }`}
      >
        {toast && (
          <div
            className={`pointer-events-auto flex items-center gap-3 rounded-2xl px-5 py-3.5 text-sm font-medium shadow-xl ${
              toast.type === "success"
                ? "bg-emerald-600 text-white"
                : toast.type === "error"
                ? "bg-red-600 text-white"
                : "bg-blue-600 text-white"
            }`}
          >
            {toast.type === "info" && (
              <svg className="h-5 w-5 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" />
              </svg>
            )}
            <span>{toast.message}</span>
            {toast.type !== "info" && (
              <button
                className="ml-2 rounded-full border border-white/40 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/15"
                onClick={dismissToast}
                type="button"
              >
                Đóng
              </button>
            )}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-separate border-spacing-0">
          <thead>
            <tr className="bg-slate-50/80">
              <th className="px-4 lg:px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                Thiết bị
              </th>
              <th className="px-4 lg:px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                Vị trí (Phòng)
              </th>
              <th className="px-4 lg:px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                <div className="flex items-center gap-1.5 relative" data-roomid-filter>
                  <span>RoomID</span>
                  <button
                    type="button"
                    onClick={() => setShowRoomIdFilter(!showRoomIdFilter)}
                    className={`p-0.5 rounded hover:bg-slate-200 transition-colors ${roomIdFilter ? "text-blue-600" : "text-slate-400"}`}
                    title="Lọc theo RoomID"
                  >
                    <span className="material-symbols-outlined text-[16px]">filter_list</span>
                  </button>
                  {roomIdFilter && (
                    <button
                      type="button"
                      onClick={() => { setRoomIdFilter(""); setShowRoomIdFilter(false); }}
                      className="p-0.5 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors"
                      title="Xóa bộ lọc"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  )}
                  {showRoomIdFilter && (
                    <div className="absolute top-full left-0 mt-1 z-20 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[200px] max-h-[240px] overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => { setRoomIdFilter(""); setShowRoomIdFilter(false); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${!roomIdFilter ? "text-blue-600 font-bold bg-blue-50/50" : "text-slate-600"}`}
                      >
                        Tất cả ({devices.length})
                      </button>
                      {uniqueRoomIds.map(id => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => { setRoomIdFilter(id); setShowRoomIdFilter(false); }}
                          className={`w-full text-left px-3 py-2 text-xs font-mono hover:bg-slate-50 transition-colors ${roomIdFilter === id ? "text-blue-600 font-bold bg-blue-50/50" : "text-slate-600"}`}
                        >
                          {id} ({devices.filter(d => d.chatId === id).length})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </th>
              <th className="px-4 lg:px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                Bản quyền / Hết hạn
              </th>
              <th className="px-4 lg:px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-center">
                Debug
              </th>
              <th className="px-4 lg:px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleDevices.map((device) => {
              const isLocked = device.status === "LOCKED";
              const isRoomOpen = openRooms.includes(device.room);
              const isBusy = busyMac === device.mac;
              const isLifetime = (device.license || "").toUpperCase() === "LIFETIME";
              const currentLicense = (device.license || "TRIAL").toUpperCase();
              const isTrial = currentLicense === "TRIAL";
              const isDebugOn = device.debug;

              return (
                <tr
                  key={device.mac}
                  className={`device-row transition-all duration-200 group relative ${
                    isRoomOpen
                      ? "bg-emerald-100/40 hover:bg-emerald-100/70 border-l-[4px] border-l-emerald-500 shadow-[inset_0_1px_0_0_rgba(16,185,129,0.2),inset_0_-1px_0_0_rgba(16,185,129,0.2)]"
                      : "hover:bg-slate-50/60 border-l-[4px] border-l-transparent"
                  }`}
                >
                  {/* Thiết bị: MAC + Status + Version */}
                  <td className="px-4 lg:px-6 py-4 lg:py-5">
                    <div className="flex flex-col gap-1.5">
                      <span className="font-mono text-xs text-slate-600 font-semibold">{device.mac}</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            isLocked ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          <span className={`w-1 h-1 rounded-full ${isLocked ? "bg-rose-500" : "bg-emerald-500"}`} />
                          {device.status || "UNKNOWN"}
                        </span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-[9px] font-mono font-bold text-slate-500">
                          {device.version ? `v${device.version}` : "N/A"}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Vị trí (Phòng) */}
                  <td className="px-4 lg:px-6 py-4 lg:py-5">
                    <div className="flex flex-col gap-1.5 items-start">
                      <span className={`text-sm font-medium ${isRoomOpen ? "text-emerald-900" : "text-slate-900"}`}>
                        {device.room || "-"}
                      </span>
                      {isRoomOpen && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-200/50 text-emerald-700 text-[10px] font-bold uppercase ring-1 ring-emerald-300">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                          Phòng đang mở
                        </span>
                      )}
                    </div>
                  </td>

                  {/* RoomID (ChatID) */}
                  <td className="px-4 lg:px-6 py-4 lg:py-5">
                    <span className="font-mono text-xs text-slate-500">{device.chatId || "-"}</span>
                  </td>

                  {/* Bản quyền / Hết hạn */}
                  <td className="px-4 lg:px-6 py-4 lg:py-5">
                    <div className="flex flex-col items-start gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            isLifetime
                              ? "bg-purple-100 text-purple-700"
                              : isTrial
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {currentLicense}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            className={`rounded-full px-2 py-0.5 text-[9px] font-semibold transition-colors ${
                              isTrial
                                ? "bg-amber-600 text-white"
                                : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
                            } disabled:cursor-not-allowed disabled:opacity-50`}
                            disabled={isBusy || isTrial}
                            onClick={() => handleChangeLicense(device.mac, "TRIAL")}
                            type="button"
                          >
                            TRIAL
                          </button>
                          <button
                            className={`rounded-full px-2 py-0.5 text-[9px] font-semibold transition-colors ${
                              isLifetime
                                ? "bg-purple-600 text-white"
                                : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
                            } disabled:cursor-not-allowed disabled:opacity-50`}
                            disabled={isBusy || isLifetime}
                            onClick={() => handleChangeLicense(device.mac, "LIFETIME")}
                            type="button"
                          >
                            LIFETIME
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-slate-600">{device.expireDate || "-"}</span>
                        {editingExpire === device.mac ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {[
                              { label: "+7d", days: 7 },
                              { label: "+30d", days: 30 },
                              { label: "+90d", days: 90 },
                              { label: "+1y", days: 365 },
                            ].map((preset) => (
                              <button
                                key={preset.days}
                                type="button"
                                className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700 hover:bg-sky-200 disabled:opacity-50"
                                disabled={isBusy}
                                onClick={() =>
                                  handleChangeExpireDate(device.mac, addDaysFromNow(preset.days))
                                }
                              >
                                {preset.label}
                              </button>
                            ))}
                            <input
                              type="date"
                              className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px]"
                              disabled={isBusy}
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleChangeExpireDate(device.mac, toSheetDate(e.target.value));
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-300"
                              onClick={() => setEditingExpire("")}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 hover:bg-slate-200"
                            onClick={() => setEditingExpire(device.mac)}
                          >
                            Sửa ngày
                          </button>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Debug Toggle */}
                  <td className="px-4 lg:px-6 py-4 lg:py-5 text-center">
                    <button
                      type="button"
                      title={isDebugOn ? "Tắt debug" : "Bật debug"}
                      disabled={isBusy}
                      onClick={() => handleToggleDebug(device.mac, isDebugOn)}
                      className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                        isDebugOn ? "bg-blue-600" : "bg-slate-200"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isDebugOn ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-4 lg:px-6 py-4 lg:py-5 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-50"
                        disabled={isBusy}
                        onClick={() => setLogModalMac(device.mac)}
                        type="button"
                        title="Xem Log"
                      >
                        <span className="material-symbols-outlined text-[18px]">terminal</span>
                      </button>
                      <button
                        className={`p-1.5 rounded-lg transition-all disabled:opacity-50 ${
                          isLocked
                            ? "text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50"
                            : "text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                        }`}
                        disabled={isBusy}
                        onClick={() => handleToggle(device.mac)}
                        type="button"
                        title={isLocked ? "Mở khóa" : "Khóa"}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {isLocked ? "lock_open" : "lock"}
                        </span>
                      </button>
                      <button
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                        disabled={isBusy}
                        onClick={() => handleDelete(device.mac)}
                        type="button"
                        title="Xóa"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="px-4 lg:px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
        <p className="text-xs text-slate-500 font-medium">
          Hiển thị {visibleDevices.length} / {sortedDevices.length} thiết bị{roomIdFilter ? ` (lọc từ ${devices.length})` : ""}
        </p>
        {hasMore && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">
              {showAll ? "expand_less" : "expand_more"}
            </span>
            {showAll
              ? "Thu gọn"
              : `Hiển thị thêm ${sortedDevices.length - INITIAL_SHOW_COUNT} thiết bị`}
          </button>
        )}
      </div>

      {logModalMac && (
        <LogViewerModal mac={logModalMac} onClose={() => setLogModalMac(null)} />
      )}
    </>
  );
}

// ---- Terminal Modal Component ----
type LogEntry = {
  id: string;
  timestamp: string;
  level: string;
  msg: string;
};

type AnalysisIssue = {
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  count: number;
};

type AnalysisResult = {
  healthScore: number;
  healthLabel: string;
  errorCount: number;
  warnCount: number;
  infoCount: number;
  issues: AnalysisIssue[];
  deviceInfo: {
    fwVersion: string;
    lastHeap: string;
    uptime: string;
    restartCount: number | null;
    lastOffline: string;
    wifi1Ssid: string;
    wifi1Pass: string;
    wifi2Ssid: string;
    wifi2Pass: string;
  };
};

function analyzeDeviceLogs(logs: LogEntry[]): AnalysisResult {
  let errorCount = 0;
  let warnCount = 0;
  let infoCount = 0;

  // Pattern counters
  let brownoutCount = 0;
  let panicWdtCount = 0;
  let apiErrCount = 0;
  let lowHeapCount = 0;
  let wifiLostCount = 0;
  let otaFailCount = 0;
  let supervisorRestartCount = 0;
  let deviceExpiredCount = 0;
  let httpErrCount = 0;
  let offlineSessionCount = 0;
  let offlineTotalMin = 0;

  // Device info extraction
  let fwVersion = "";
  let lastHeap = "";
  let uptime = "";
  let restartCount: number | null = null;
  let lastOffline = "";
  let wifi1Ssid = "";
  let wifi1Pass = "";
  let wifi2Ssid = "";
  let wifi2Pass = "";

  for (const log of logs) {
    const lvl = (log.level || "").toUpperCase();
    const msg = log.msg || "";

    if (lvl === "ERROR" || lvl === "CRIT") errorCount++;
    else if (lvl === "WARN") warnCount++;
    else infoCount++;

    // --- Pattern matching ---
    if (/brownout/i.test(msg)) brownoutCount++;
    if (/panic|task.?watchdog|int.?watchdog/i.test(msg)) panicWdtCount++;
    if (/API_ERR_RESTART/i.test(msg)) apiErrCount++;
    if (/low.?heap/i.test(msg)) lowHeapCount++;
    if (/wifi.*(lost|disconnect|connection lost)/i.test(msg)) wifiLostCount++;
    if (/ota.*fail/i.test(msg)) otaFailCount++;
    if (/supervisor|no.*ok.*heartbeat|no.*hb/i.test(msg) && lvl === "CRIT") supervisorRestartCount++;
    if (/device.?expired/i.test(msg)) deviceExpiredCount++;
    if (/hb.*http.*err|http.*error/i.test(msg)) httpErrCount++;

    // Offline session detection
    if (/OFFLINE_SESSION/i.test(msg)) {
      offlineSessionCount++;
      const durMatch = msg.match(/Duration:\s*(\d+)\s*min/);
      if (durMatch) {
        const mins = parseInt(durMatch[1]);
        offlineTotalMin += mins;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        lastOffline = h > 0 ? `${h}h ${m}m` : `${m} phút`;
      }
    }

    // --- Extract device info ---
    const fwMatch = msg.match(/FW:\s*([0-9][0-9.]+)/);
    if (fwMatch) fwVersion = fwMatch[1];

    const heapMatch = msg.match(/Heap:\s*(\d+)\s*B/);
    if (heapMatch) lastHeap = heapMatch[1];

    const uptimeMatch = msg.match(/Uptime:\s*(\d+)\s*s/);
    if (uptimeMatch) {
      const sec = parseInt(uptimeMatch[1]);
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      uptime = h > 0 ? `${h}h ${m}m` : `${m}m`;
    }

    const restartMatch = msg.match(/Count=(\d+)/);
    if (restartMatch) restartCount = parseInt(restartMatch[1]);

    // WiFi credentials from diagnostics
    const wifi1Match = msg.match(/WiFi 1:\s*SSID=(.+?)\s*\|\s*Pass=(.*)/);
    if (wifi1Match) { wifi1Ssid = wifi1Match[1].trim(); wifi1Pass = wifi1Match[2].trim(); }
    const wifi2Match = msg.match(/WiFi 2:\s*SSID=(.+?)\s*\|\s*Pass=(.*)/);
    if (wifi2Match) { wifi2Ssid = wifi2Match[1].trim(); wifi2Pass = wifi2Match[2].trim(); }
  }

  // --- Build issues list ---
  const issues: AnalysisIssue[] = [];

  if (brownoutCount > 0) {
    issues.push({
      severity: "critical",
      title: "Sụt áp nguồn (Brownout)",
      description: "Nguồn điện nuôi mạch yếu hoặc không ổn định. Kiểm tra cáp USB, adapter sạc, hoặc thay nguồn 5V/2A chất lượng.",
      count: brownoutCount,
    });
  }

  if (panicWdtCount > 0) {
    issues.push({
      severity: "critical",
      title: "CPU Panic / Watchdog Timeout",
      description: "Chương trình bị treo hoặc quá tải CPU. Watchdog đã tự restart để phục hồi. Nếu lặp lại nhiều, cần kiểm tra firmware.",
      count: panicWdtCount,
    });
  }

  if (apiErrCount > 0) {
    issues.push({
      severity: "critical",
      title: "Lỗi API liên tục → Tự restart",
      description: "Google Script không phản hồi liên tiếp " + apiErrCount + " lần. Có thể do mạng yếu hoặc server quá tải.",
      count: apiErrCount,
    });
  }

  if (supervisorRestartCount > 0) {
    issues.push({
      severity: "critical",
      title: "Supervisor buộc restart",
      description: "Không có heartbeat thành công quá 90 giây. Supervisor đã can thiệp restart để khôi phục kết nối.",
      count: supervisorRestartCount,
    });
  }

  if (otaFailCount > 0) {
    issues.push({
      severity: "critical",
      title: "Cập nhật firmware OTA thất bại",
      description: "Quá trình tải firmware mới bị lỗi. Kiểm tra kết nối internet và dung lượng firmware trên GitHub.",
      count: otaFailCount,
    });
  }

  if (deviceExpiredCount > 0) {
    issues.push({
      severity: "warning",
      title: "Thiết bị hết hạn dùng thử",
      description: "License TRIAL đã hết hạn. Thiết bị sẽ bị từ chối heartbeat. Cần gia hạn hoặc nâng cấp LIFETIME.",
      count: deviceExpiredCount,
    });
  }

  if (lowHeapCount > 0) {
    issues.push({
      severity: "warning",
      title: "RAM đang cạn kiệt",
      description: "Bộ nhớ heap dưới 40KB. Nếu tiếp tục giảm sẽ gây crash. Cân nhắc restart định kỳ hoặc giảm queue size.",
      count: lowHeapCount,
    });
  }

  if (wifiLostCount > 0) {
    issues.push({
      severity: "warning",
      title: "Mất kết nối WiFi",
      description: "WiFi bị ngắt " + wifiLostCount + " lần. Kiểm tra khoảng cách router, nhiễu sóng, hoặc giảm số thiết bị trên cùng mạng.",
      count: wifiLostCount,
    });
  }

  if (httpErrCount > 0) {
    issues.push({
      severity: "warning",
      title: "Lỗi HTTP khi gọi server",
      description: "Server trả về mã lỗi HTTP. Google Apps Script có thể bị rate-limit hoặc timeout.",
      count: httpErrCount,
    });
  }

  if (offlineSessionCount > 0) {
    const totalH = Math.floor(offlineTotalMin / 60);
    const totalM = offlineTotalMin % 60;
    const totalText = totalH > 0 ? `${totalH}h ${totalM}m` : `${totalM} phút`;
    issues.push({
      severity: "info",
      title: "Phiên offline (mất WiFi khi phòng đang mở)",
      description: `Phát hiện ${offlineSessionCount} lần mất WiFi kéo dài ≥ 10 phút (tổng ~${totalText}). Phòng vẫn được tính thời gian mở trong khi mất kết nối. Kiểm tra router và khoảng cách WiFi.`,
      count: offlineSessionCount,
    });
  }

  if (restartCount !== null && restartCount > 5) {
    issues.push({
      severity: "info",
      title: "Thiết bị restart nhiều lần",
      description: `Đã restart ${restartCount} lần kể từ lần cấp điện đầu tiên. Nên theo dõi thêm để xác định nguyên nhân.`,
      count: 1,
    });
  }

  // --- Health score ---
  let score = 100;
  score -= brownoutCount * 15;
  score -= panicWdtCount * 12;
  score -= apiErrCount * 10;
  score -= supervisorRestartCount * 10;
  score -= otaFailCount * 8;
  score -= lowHeapCount * 5;
  score -= wifiLostCount * 3;
  score -= httpErrCount * 3;
  score -= deviceExpiredCount * 5;
  score -= offlineSessionCount * 4;
  score = Math.max(0, Math.min(100, score));

  let healthLabel = "";
  if (logs.length === 0) {
    healthLabel = "Chưa có dữ liệu";
    score = 0;
  } else if (score >= 90) {
    healthLabel = "Tuyệt vời — Thiết bị hoạt động cực kỳ ổn định";
  } else if (score >= 70) {
    healthLabel = "Tốt — Có một số cảnh báo nhỏ, không đáng lo";
  } else if (score >= 50) {
    healthLabel = "Trung bình — Cần chú ý theo dõi các lỗi";
  } else if (score >= 30) {
    healthLabel = "Yếu — Nhiều lỗi nghiêm trọng, cần can thiệp";
  } else {
    healthLabel = "Nguy hiểm — Thiết bị không ổn định, cần xử lý ngay";
  }

  return {
    healthScore: score,
    healthLabel,
    errorCount,
    warnCount,
    infoCount,
    issues: issues.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    }),
    deviceInfo: { fwVersion, lastHeap, uptime, restartCount, lastOffline, wifi1Ssid, wifi1Pass, wifi2Ssid, wifi2Pass },
  };
}

function LogViewerModal({ mac, onClose }: { mac: string; onClose: () => void }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"logs" | "analysis">("logs");
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsEndRef.current && activeTab === "logs") {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, activeTab]);

  useEffect(() => {
    if (!mac) return;

    const FIREBASE_URL = "https://log-esp32-5353f-default-rtdb.asia-southeast1.firebasedatabase.app";
    const FIREBASE_AUTH = "piIWJPJRpn7O680RR2djM5bUsi1LNrQX9tDJpaiq";

    const url = `${FIREBASE_URL}/logs/${mac}.json?auth=${FIREBASE_AUTH}&orderBy="$key"&limitToLast=100`;

    const source = new EventSource(url);

    source.addEventListener("put", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.path === "/") {
          if (data.data) {
            const initialLogs: LogEntry[] = [];
            for (const key in data.data) {
              const item = data.data[key];
              initialLogs.push({
                id: key,
                timestamp: new Date(item.timestamp).toLocaleString("vi-VN"),
                level: item.level || "INFO",
                msg: item.msg || "",
              });
            }
            setLogs(initialLogs);
          }
        } else {
          const newItem = data.data;
          const key = data.path.replace("/", "");
          if (newItem && newItem.timestamp) {
            setLogs((prev) =>
              [
                ...prev,
                {
                  id: key,
                  timestamp: new Date(newItem.timestamp).toLocaleString("vi-VN"),
                  level: newItem.level || "INFO",
                  msg: newItem.msg || "",
                },
              ].slice(-200)
            );
          }
        }
      } catch (err) {
        console.error("Error parsing SSE JSON", err);
      }
    });

    return () => {
      source.close();
    };
  }, [mac]);

  const analysis = analyzeDeviceLogs(logs);

  const AnalysisContent = (
    <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-3 lg:space-y-4">
      <div className="rounded-lg bg-slate-800/60 p-3 lg:p-4 border border-slate-700/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tình trạng</span>
          <span className={`text-sm font-black ${analysis.healthScore >= 80 ? "text-emerald-400" : analysis.healthScore >= 50 ? "text-amber-400" : "text-rose-400"}`}>
            {analysis.healthScore}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${analysis.healthScore >= 80 ? "bg-emerald-500" : analysis.healthScore >= 50 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${analysis.healthScore}%` }} />
        </div>
        <p className={`mt-2 text-[10px] lg:text-[11px] font-semibold ${analysis.healthScore >= 80 ? "text-emerald-400" : analysis.healthScore >= 50 ? "text-amber-400" : "text-rose-400"}`}>
          {analysis.healthLabel}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1.5 lg:gap-2">
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2 lg:p-2.5 text-center">
          <p className="text-base lg:text-lg font-black text-rose-400">{analysis.errorCount}</p>
          <p className="text-[8px] lg:text-[9px] font-bold text-rose-400/70 uppercase tracking-wider">Lỗi</p>
        </div>
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 lg:p-2.5 text-center">
          <p className="text-base lg:text-lg font-black text-amber-400">{analysis.warnCount}</p>
          <p className="text-[8px] lg:text-[9px] font-bold text-amber-400/70 uppercase tracking-wider">Cảnh báo</p>
        </div>
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 lg:p-2.5 text-center">
          <p className="text-base lg:text-lg font-black text-emerald-400">{analysis.infoCount}</p>
          <p className="text-[8px] lg:text-[9px] font-bold text-emerald-400/70 uppercase tracking-wider">Bình thường</p>
        </div>
      </div>

      {analysis.issues.length > 0 ? (
        <div className="space-y-2">
          <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Vấn đề phát hiện ({analysis.issues.length})</h5>
          {analysis.issues.map((issue: AnalysisIssue, idx: number) => (
            <div key={idx} className={`rounded-lg p-2.5 lg:p-3 border ${issue.severity === "critical" ? "bg-rose-500/10 border-rose-500/20" : issue.severity === "warning" ? "bg-amber-500/10 border-amber-500/20" : "bg-blue-500/10 border-blue-500/20"}`}>
              <div className="flex items-start gap-2 mb-1">
                <span className={`text-[9px] lg:text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${issue.severity === "critical" ? "bg-rose-500/30 text-rose-300" : issue.severity === "warning" ? "bg-amber-500/30 text-amber-300" : "bg-blue-500/30 text-blue-300"}`}>
                  {issue.severity === "critical" ? "Nguy hiểm" : issue.severity === "warning" ? "Cảnh báo" : "Lưu ý"}
                </span>
                {issue.count > 1 && <span className="text-[10px] font-mono text-slate-500">×{issue.count}</span>}
              </div>
              <p className={`text-[11px] lg:text-[12px] font-bold mb-0.5 ${issue.severity === "critical" ? "text-rose-300" : issue.severity === "warning" ? "text-amber-300" : "text-blue-300"}`}>{issue.title}</p>
              <p className="text-[10px] lg:text-[11px] text-slate-400 leading-relaxed">{issue.description}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 lg:p-4 text-center">
          <span className="text-emerald-400 text-xl lg:text-2xl block mb-1">✓</span>
          <p className="text-[11px] lg:text-[12px] font-bold text-emerald-400">Không phát hiện lỗi</p>
          <p className="text-[10px] lg:text-[11px] text-slate-500 mt-1">Thiết bị đang hoạt động ổn định</p>
        </div>
      )}

      {analysis.deviceInfo.fwVersion && (
        <div className="rounded-lg bg-slate-800/60 p-2.5 lg:p-3 border border-slate-700/50 space-y-1.5">
          <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Thông tin từ Log</h5>
          {analysis.deviceInfo.fwVersion && (
            <div className="flex justify-between text-[10px] lg:text-[11px]"><span className="text-slate-500">Firmware</span><span className="text-slate-300 font-mono font-bold">{analysis.deviceInfo.fwVersion}</span></div>
          )}
          {analysis.deviceInfo.lastHeap && (
            <div className="flex justify-between text-[10px] lg:text-[11px]"><span className="text-slate-500">RAM còn</span><span className={`font-mono font-bold ${parseInt(analysis.deviceInfo.lastHeap) < 40000 ? "text-amber-400" : "text-slate-300"}`}>{analysis.deviceInfo.lastHeap} B</span></div>
          )}
          {analysis.deviceInfo.uptime && (
            <div className="flex justify-between text-[10px] lg:text-[11px]"><span className="text-slate-500">Uptime</span><span className="text-slate-300 font-mono font-bold">{analysis.deviceInfo.uptime}</span></div>
          )}
          {analysis.deviceInfo.restartCount !== null && (
            <div className="flex justify-between text-[10px] lg:text-[11px]"><span className="text-slate-500">Restart</span><span className={`font-mono font-bold ${analysis.deviceInfo.restartCount > 3 ? "text-rose-400" : "text-slate-300"}`}>{analysis.deviceInfo.restartCount}</span></div>
          )}
          {analysis.deviceInfo.lastOffline && (
            <div className="flex justify-between text-[10px] lg:text-[11px]"><span className="text-slate-500 flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">wifi_off</span>Offline</span><span className="text-cyan-400 font-mono font-bold">{analysis.deviceInfo.lastOffline}</span></div>
          )}
        </div>
      )}
      {analysis.deviceInfo.wifi1Ssid && (
        <div className="rounded-lg bg-slate-800/60 p-2.5 lg:p-3 border border-slate-700/50 space-y-1.5">
          <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><span className="material-symbols-outlined text-[12px]">wifi</span>Cấu hình WiFi</h5>
          <div className="flex justify-between text-[10px] lg:text-[11px]"><span className="text-slate-500">WiFi 1 SSID</span><span className="text-emerald-300 font-mono font-bold">{analysis.deviceInfo.wifi1Ssid}</span></div>
          <div className="flex justify-between text-[10px] lg:text-[11px]"><span className="text-slate-500">WiFi 1 Pass</span><span className="text-slate-300 font-mono font-bold">{analysis.deviceInfo.wifi1Pass || "(không có)"}</span></div>
          {analysis.deviceInfo.wifi2Ssid ? (
            <>
              <div className="flex justify-between text-[10px] lg:text-[11px]"><span className="text-slate-500">WiFi 2 SSID</span><span className="text-blue-300 font-mono font-bold">{analysis.deviceInfo.wifi2Ssid}</span></div>
              <div className="flex justify-between text-[10px] lg:text-[11px]"><span className="text-slate-500">WiFi 2 Pass</span><span className="text-slate-300 font-mono font-bold">{analysis.deviceInfo.wifi2Pass || "(không có)"}</span></div>
            </>
          ) : (
            <div className="flex justify-between text-[10px] lg:text-[11px]"><span className="text-slate-500">WiFi 2</span><span className="text-slate-600 font-mono">Không cấu hình</span></div>
          )}
        </div>
      )}
      <div className="pt-2 text-[9px] lg:text-[10px] text-slate-600">* Realtime · {logs.length} bản ghi</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center bg-black/60 lg:p-4 backdrop-blur-sm">
      <div className="flex h-[100dvh] lg:h-[85vh] w-full lg:max-w-6xl flex-col overflow-hidden shadow-2xl lg:ring-1 lg:ring-slate-700 lg:rounded-xl" style={{ backgroundColor: "#0C0C0C" }}>

        {/* Title Bar */}
        <div className="shrink-0 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-3 lg:px-4 py-2.5 lg:py-3">
          <div className="flex items-center gap-2 lg:gap-3 min-w-0">
            <div className="hidden lg:flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-rose-500" />
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
            </div>
            <h3 className="font-mono text-[11px] lg:text-[13px] font-semibold text-slate-300 truncate">
              <span className="lg:hidden">{mac}</span>
              <span className="hidden lg:inline">root@{mac}:~/logs</span>
            </h3>
            <span className={`lg:hidden text-[9px] font-black px-1.5 py-0.5 rounded ${analysis.healthScore >= 80 ? "bg-emerald-500/20 text-emerald-400" : analysis.healthScore >= 50 ? "bg-amber-500/20 text-amber-400" : "bg-rose-500/20 text-rose-400"}`}>
              {analysis.healthScore}%
            </span>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-2 lg:p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z" />
            </svg>
          </button>
        </div>

        {/* Mobile Tab Bar */}
        <div className="lg:hidden flex border-b border-slate-800 bg-slate-900/80">
          <button type="button" onClick={() => setActiveTab("logs")} className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider text-center transition-colors ${activeTab === "logs" ? "text-emerald-400 border-b-2 border-emerald-400 bg-slate-800/50" : "text-slate-500"}`}>
            <span className="flex items-center justify-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">terminal</span>
              Log ({logs.length})
            </span>
          </button>
          <button type="button" onClick={() => setActiveTab("analysis")} className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider text-center transition-colors relative ${activeTab === "analysis" ? "text-blue-400 border-b-2 border-blue-400 bg-slate-800/50" : "text-slate-500"}`}>
            <span className="flex items-center justify-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">monitoring</span>
              Phân tích
              {analysis.issues.length > 0 && (
                <span className="w-4 h-4 flex items-center justify-center rounded-full bg-rose-500 text-white text-[8px] font-black">{analysis.issues.length}</span>
              )}
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* Logs */}
          <div className={`flex-1 overflow-y-auto p-2 lg:p-4 font-mono text-[11px] lg:text-[12px] leading-relaxed ${activeTab === "logs" ? "block" : "hidden lg:block"}`}>
            {logs.length === 0 ? (
              <div className="flex items-center gap-3 text-emerald-600/60 animate-pulse p-2">
                <span className="inline-block w-2.5 h-4 bg-emerald-600/60" />
                Đang kết nối tới Server...
              </div>
            ) : (
              <div className="flex flex-col">
                {logs.map((log) => {
                  const isOfflineSession = /OFFLINE_SESSION/i.test(log.msg);
                  const isPwrHistHeader = /POWER HISTORY|={5,}/i.test(log.msg) && /session/i.test(log.msg);
                  const isPwrHistSeparator = /^-{5,}\s*\d+\s*-{5,}$/.test(log.msg.trim());
                  const isPwrHistStart = /^StartTime\s*=/i.test(log.msg.trim());
                  const isPwrHistLast = /^LastTime\s*=/i.test(log.msg.trim());

                  if (isPwrHistHeader || isPwrHistSeparator || isPwrHistStart || isPwrHistLast) {
                    return null;
                  }

                  let colorClass = "text-slate-300";
                  if (isOfflineSession) colorClass = "text-cyan-400";
                  else if (log.level === "ERROR" || log.level === "CRIT") colorClass = "text-rose-400";
                  else if (log.level === "WARN") colorClass = "text-amber-400";
                  else if (log.level === "INFO") colorClass = "text-emerald-400";

                  // Parse offline session details for rich display
                  const offlineDurMatch = isOfflineSession ? log.msg.match(/Duration:\s*(\d+)\s*min/) : null;
                  const offlineRoomMatch = isOfflineSession ? log.msg.match(/Room:\s*([^|]+)/) : null;
                  const offlineDur = offlineDurMatch ? parseInt(offlineDurMatch[1]) : 0;
                  const offlineRoom = offlineRoomMatch ? offlineRoomMatch[1].trim() : "";

                  if (isOfflineSession) {
                    const durH = Math.floor(offlineDur / 60);
                    const durM = offlineDur % 60;
                    const durText = durH > 0 ? `${durH}h ${durM}m` : `${durM} phút`;
                    return (
                      <div key={log.id} className="mx-1 lg:mx-2 my-1.5 lg:my-2 rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-3 py-2.5 lg:px-4 lg:py-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="material-symbols-outlined text-cyan-400 text-[16px] lg:text-[18px]">wifi_off</span>
                          <span className="text-[11px] lg:text-[13px] font-bold text-cyan-300">Phiên Offline — Phòng vẫn mở khi mất WiFi</span>
                        </div>
                        <div className="flex flex-wrap gap-3 lg:gap-4 text-[10px] lg:text-[12px]">
                          <div><span className="text-slate-500">Phòng: </span><span className="text-cyan-200 font-semibold">{offlineRoom || "N/A"}</span></div>
                          <div><span className="text-slate-500">Thời lượng: </span><span className="text-cyan-200 font-bold">{durText}</span></div>
                          <div><span className="text-slate-500">Ghi nhận: </span><span className="text-slate-400 font-mono">{log.timestamp}</span></div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={log.id} className="hover:bg-white/5 px-1.5 lg:px-2 py-1 lg:py-1.5 rounded transition-colors group">
                      {/* Desktop row */}
                      <div className="hidden lg:flex gap-4 items-start text-[13px]">
                        <span className="text-slate-600 shrink-0 select-none w-[160px] whitespace-nowrap">[{log.timestamp}]</span>
                        <span className={`shrink-0 w-12 font-bold select-none ${colorClass}`}>{log.level}</span>
                        <span className="text-slate-300 break-words group-hover:text-white transition-colors flex-1">{log.msg}</span>
                      </div>
                      {/* Mobile stacked */}
                      <div className="lg:hidden">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[10px] font-black ${colorClass}`}>{log.level}</span>
                          <span className="text-[9px] text-slate-600 font-mono">{log.timestamp}</span>
                        </div>
                        <p className="text-[11px] text-slate-300 break-words leading-snug">{log.msg}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={logsEndRef} className="h-4" />
              </div>
            )}
          </div>

          {/* Analysis Sidebar (desktop) / Tab Content (mobile) */}
          <div className={`lg:w-[380px] bg-slate-900/40 lg:border-l border-slate-800 overflow-y-auto shrink-0 flex flex-col ${activeTab === "analysis" ? "flex flex-1" : "hidden lg:flex"}`}>
            <div className="hidden lg:block px-5 pt-5 pb-3 border-b border-slate-800">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px]">monitoring</span>
                Phân Tích Tổng Hợp
              </h4>
            </div>
            {AnalysisContent}
          </div>
        </div>
      </div>
    </div>
  );
}

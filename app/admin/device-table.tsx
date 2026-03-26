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

  // Sort: Phòng đang mở lên đầu, LOCKED xuống cuối
  const sortedDevices = [...devices].sort((a, b) => {
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
    try {
      const response = await fetch("/api/devices/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mac }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        alert(payload.message || "Không thể cập nhật thiết bị");
        return;
      }
      router.refresh();
    } catch {
      alert("Không thể kết nối tới máy chủ");
    } finally {
      setBusyMac("");
    }
  }

  async function handleChangeLicense(mac: string, nextLicense: string) {
    const normalized = nextLicense.toUpperCase();
    setBusyMac(mac);
    try {
      const response = await fetch("/api/devices/license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mac, license: normalized }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        alert(payload.message || "Không thể cập nhật license");
        return;
      }
      router.refresh();
    } catch {
      alert("Không thể kết nối tới máy chủ");
    } finally {
      setBusyMac("");
    }
  }

  async function handleChangeExpireDate(mac: string, newExpireDate: string) {
    if (!newExpireDate) return;
    setBusyMac(mac);
    try {
      const response = await fetch("/api/devices/expire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mac, expireDate: newExpireDate }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        alert(payload.message || "Không thể cập nhật ngày hết hạn");
        return;
      }
      router.refresh();
    } catch {
      alert("Không thể kết nối tới máy chủ");
    } finally {
      setBusyMac("");
      setEditingExpire("");
    }
  }

  async function handleDelete(mac: string) {
    const accepted = window.confirm(`Xóa thiết bị ${mac} khỏi hệ thống?`);
    if (!accepted) return;
    setBusyMac(mac);
    try {
      const response = await fetch("/api/devices/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mac }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        alert(payload.message || "Không thể xóa thiết bị");
        return;
      }
      router.refresh();
    } catch {
      alert("Không thể kết nối tới máy chủ");
    } finally {
      setBusyMac("");
    }
  }

  async function handleToggleDebug(mac: string, currentDebug: boolean) {
    setBusyMac(mac);
    try {
      const response = await fetch("/api/devices/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mac, debug: !currentDebug }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        alert(payload.message || "Không thể cập nhật debug");
        return;
      }
      router.refresh();
    } catch {
      alert("Không thể kết nối tới máy chủ");
    } finally {
      setBusyMac("");
    }
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-separate border-spacing-0">
          <thead>
            <tr className="bg-slate-50/80">
              <th className="px-4 lg:px-8 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                MAC Address
              </th>
              <th className="px-4 lg:px-8 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                Vị trí (Phòng)
              </th>
              <th className="px-4 lg:px-8 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                Trạng thái
              </th>
              <th className="px-4 lg:px-8 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                Gói bản quyền
              </th>
              <th className="px-4 lg:px-8 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                Hết hạn
              </th>
              <th className="px-4 lg:px-8 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                Debug
              </th>
              <th className="px-4 lg:px-8 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right">
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
                  {/* MAC */}
                  <td className="px-4 lg:px-8 py-4 lg:py-5 font-mono text-xs text-slate-600 font-semibold">
                    {device.mac}
                  </td>

                  {/* Room */}
                  <td className="px-4 lg:px-8 py-4 lg:py-5">
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

                  {/* Status */}
                  <td className="px-4 lg:px-8 py-4 lg:py-5">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        isLocked
                          ? "bg-rose-100 text-rose-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isLocked ? "bg-rose-500" : "bg-emerald-500"
                        }`}
                      />
                      {device.status || "UNKNOWN"}
                    </span>
                  </td>

                  {/* License */}
                  <td className="px-4 lg:px-8 py-4 lg:py-5">
                    <div className="flex flex-col items-start gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                          isLifetime
                            ? "bg-purple-100 text-purple-700"
                            : isTrial
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {currentLicense}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${
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
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${
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
                  </td>

                  {/* Expire */}
                  <td className="px-4 lg:px-8 py-4 lg:py-5">
                    <div className="flex flex-col items-start gap-1.5">
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
                  </td>

                  {/* Debug Toggle */}
                  <td className="px-4 lg:px-8 py-4 lg:py-5">
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
                  <td className="px-4 lg:px-8 py-4 lg:py-5 text-right">
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
      <div className="px-4 lg:px-8 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
        <p className="text-xs text-slate-500 font-medium">
          Hiển thị {visibleDevices.length} / {sortedDevices.length} thiết bị
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

function LogViewerModal({ mac, onClose }: { mac: string; onClose: () => void }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="flex h-[80vh] w-full max-w-4xl flex-col overflow-hidden shadow-2xl ring-1 ring-slate-700"
        style={{ borderRadius: "12px", backgroundColor: "#0C0C0C" }}
      >
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-rose-500" />
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
            </div>
            <h3 className="font-mono text-[13px] font-semibold text-slate-300">
              root@{mac}:~/logs
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 font-mono text-[12px] leading-relaxed">
          {logs.length === 0 ? (
            <div className="flex items-center gap-3 text-emerald-600/60 animate-pulse">
              <span className="inline-block w-2.5 h-4 bg-emerald-600/60" />
              Đang thiết lập kết nối mã hoá bảo mật tới Server...
            </div>
          ) : (
            <div className="flex flex-col">
              {logs.map((log) => {
                let colorClass = "text-slate-300";
                if (log.level === "ERROR" || log.level === "CRIT") colorClass = "text-rose-400";
                else if (log.level === "WARN") colorClass = "text-amber-400";
                else if (log.level === "INFO") colorClass = "text-emerald-400";

                return (
                  <div
                    key={log.id}
                    className="flex gap-3 hover:bg-white/5 px-1 py-0.5 rounded transition-colors group"
                  >
                    <span className="text-slate-600 shrink-0 select-none">[{log.timestamp}]</span>
                    <span className={`shrink-0 w-12 font-bold select-none ${colorClass}`}>
                      {log.level}
                    </span>
                    <span className="text-slate-300 break-words group-hover:text-white transition-colors">
                      {log.msg}
                    </span>
                  </div>
                );
              })}
              <div ref={logsEndRef} className="h-4" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

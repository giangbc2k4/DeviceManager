"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { DeviceRow } from "@/lib/google-sheets";

type DeviceTableProps = {
  devices: DeviceRow[];
};

export function DeviceTable({ devices }: DeviceTableProps) {
  const router = useRouter();
  const [busyMac, setBusyMac] = useState<string>("");
  const [editingExpire, setEditingExpire] = useState<string>("");

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

  return (
    <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
      <table className="min-w-full divide-y divide-stone-200 text-sm">
        <thead className="bg-stone-50 text-left text-xs uppercase tracking-[0.15em] text-stone-500">
          <tr>
            <th className="px-4 py-3">MAC</th>
            <th className="px-4 py-3">Phòng</th>
            <th className="px-4 py-3">Trạng thái</th>
            <th className="px-4 py-3">Giấy phép</th>
            <th className="px-4 py-3">Bắt đầu</th>
            <th className="px-4 py-3">Hết hạn</th>
            <th className="px-4 py-3 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {devices.map((device) => {
            const isLocked = device.status === "LOCKED";
            const isBusy = busyMac === device.mac;
            const isLifetime = (device.license || "").toUpperCase() === "LIFETIME";
            const currentLicense = (device.license || "TRIAL").toUpperCase();
            const isTrial = currentLicense === "TRIAL";

            return (
              <tr key={device.mac}>
                <td className="px-4 py-3 font-medium text-stone-900">{device.mac}</td>
                <td className="px-4 py-3">{device.room || "-"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      isLocked ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {device.status || "UNKNOWN"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        isLifetime
                          ? "bg-indigo-100 text-indigo-700"
                          : isTrial
                            ? "bg-amber-100 text-amber-700"
                            : "bg-stone-100 text-stone-700"
                      }`}
                    >
                      {currentLicense}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          isTrial
                            ? "bg-amber-600 text-white"
                            : "bg-white text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                        disabled={isBusy || isTrial}
                        onClick={() => handleChangeLicense(device.mac, "TRIAL")}
                        type="button"
                      >
                        TRIAL
                      </button>
                      <button
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          isLifetime
                            ? "bg-indigo-600 text-white"
                            : "bg-white text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                        disabled={isBusy || isLifetime}
                        onClick={() => handleChangeLicense(device.mac, "LIFETIME")}
                        type="button"
                      >
                        LIFETIME
                      </button>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">{device.startDate || "-"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1.5">
                    <span className="text-stone-700">{device.expireDate || "-"}</span>
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
                            className="rounded bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700 hover:bg-sky-200 disabled:opacity-50"
                            disabled={isBusy}
                            onClick={() => handleChangeExpireDate(device.mac, addDaysFromNow(preset.days))}
                          >
                            {preset.label}
                          </button>
                        ))}
                        <input
                          type="date"
                          className="rounded border border-stone-300 px-1.5 py-0.5 text-[11px]"
                          disabled={isBusy}
                          onChange={(e) => {
                            if (e.target.value) {
                              handleChangeExpireDate(device.mac, toSheetDate(e.target.value));
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="rounded bg-stone-200 px-1.5 py-0.5 text-[11px] text-stone-600 hover:bg-stone-300"
                          onClick={() => setEditingExpire("")}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="rounded bg-stone-100 px-2 py-0.5 text-[11px] text-stone-500 hover:bg-stone-200"
                        onClick={() => setEditingExpire(device.mac)}
                      >
                        Sửa ngày
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      className={`rounded-full px-4 py-2 text-xs font-semibold text-white ${
                        isLocked ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                      } disabled:cursor-not-allowed disabled:bg-stone-400`}
                      disabled={isBusy}
                      onClick={() => handleToggle(device.mac)}
                      type="button"
                    >
                      {isBusy ? "Đang xử lý..." : isLocked ? "Mở khóa" : "Khóa"}
                    </button>
                    <button
                      className="rounded-full bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-stone-400"
                      disabled={isBusy}
                      onClick={() => handleDelete(device.mac)}
                      type="button"
                    >
                      Xóa
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

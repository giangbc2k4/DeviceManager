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
                <td className="px-4 py-3">{device.expireDate || "-"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {!isLifetime ? (
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
                    ) : null}
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

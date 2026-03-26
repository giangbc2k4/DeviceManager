"use client";
import { useEffect, useState } from "react";

export default function DeviceLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mac, setMac] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/devices/logs?mac=${encodeURIComponent(mac)}&limit=100`)
      .then((res) => res.json())
      .then((data) => setLogs(data.logs || []))
      .finally(() => setLoading(false));
  }, [mac]);

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">Device Logs</h2>
      <div className="mb-4">
        <input
          className="border px-2 py-1 rounded"
          placeholder="Lọc theo MAC..."
          value={mac}
          onChange={(e) => setMac(e.target.value)}
        />
      </div>
      {loading ? (
        <div>Đang tải log...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border">
            <thead>
              <tr>
                <th className="border px-2 py-1">Thời gian</th>
                <th className="border px-2 py-1">MAC</th>
                <th className="border px-2 py-1">Phòng</th>
                <th className="border px-2 py-1">Level</th>
                <th className="border px-2 py-1">Nội dung</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, idx) => (
                <tr key={idx}>
                  <td className="border px-2 py-1 whitespace-nowrap">{log.timestamp}</td>
                  <td className="border px-2 py-1">{log.mac}</td>
                  <td className="border px-2 py-1">{log.room}</td>
                  <td className="border px-2 py-1">{log.level}</td>
                  <td className="border px-2 py-1">{log.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

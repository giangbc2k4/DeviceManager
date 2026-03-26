"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { OtaManifest } from "@/lib/ota-github";

const GH_RAW = "https://raw.githubusercontent.com/giangbc2k4/room-firmware/refs/heads/master";

const UPLOAD_STEPS = [
  "Đang đọc trạng thái từ GitHub...",
  "Đang lưu trữ phiên bản cũ...",
  "Đang ghi firmware mới lên GitHub...",
  "Đang cập nhật version.json...",
] as const;

const ROLLBACK_STEPS = [
  "Đang tải firmware mục tiêu...",
  "Đang ghi lại releases/latest/...",
  "Đang cập nhật version.json và manifest...",
] as const;

const DELETE_STEPS = [
  "Đang kiểm tra phiên bản...",
  "Đang xóa file firmware trên GitHub...",
  "Đang cập nhật manifest...",
] as const;
function firmwareRawUrl(version: string) {
  return `${GH_RAW}/releases/v${version}/firmware.bin`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

export function OtaManager({ manifest: initialManifest }: { manifest: OtaManifest }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [manifest, setManifest] = useState<OtaManifest>(initialManifest);
  const [version, setVersion] = useState("");
  const [note, setNote] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rollbackVersion, setRollbackVersion] = useState<string | null>(null);
  const [rollbackStepIdx, setRollbackStepIdx] = useState(0);
  const [deletingVersion, setDeletingVersion] = useState<string | null>(null);
  const [deleteStepIdx, setDeleteStepIdx] = useState(0);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!uploading || uploadProgress < 100) {
      setStepIdx(0);
      return;
    }
    const id = setInterval(() => setStepIdx((i) => (i + 1) % UPLOAD_STEPS.length), 1800);
    return () => clearInterval(id);
  }, [uploading, uploadProgress]);

  useEffect(() => {
    if (!rollbackVersion) {
      setRollbackStepIdx(0);
      return;
    }
    const id = setInterval(() => {
      setRollbackStepIdx((i) => (i + 1) % ROLLBACK_STEPS.length);
    }, 1500);
    return () => clearInterval(id);
  }, [rollbackVersion]);

  useEffect(() => {
    if (!deletingVersion) {
      setDeleteStepIdx(0);
      return;
    }
    const id = setInterval(() => {
      setDeleteStepIdx((i) => (i + 1) % DELETE_STEPS.length);
    }, 1200);
    return () => clearInterval(id);
  }, [deletingVersion]);

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setToastVisible(true);
  }

  function dismissToast() {
    setToastVisible(false);
    setTimeout(() => setToast(null), 300);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedFile || !version.trim()) {
      showToast("error", "Vui lòng nhập phiên bản và chọn file firmware");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("version", version.trim());
      formData.append("note", note.trim());

      // Use XMLHttpRequest to show upload progress
      let responseMessage = "";
      let responseUploadedBy = "";
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        });

        xhr.upload.addEventListener("loadend", () => setUploadProgress(100));

        xhr.addEventListener("load", () => {
          try {
            const data = JSON.parse(xhr.responseText) as {
              message?: string;
              uploaded_by?: string;
            };
            responseMessage = data.message ?? "";
            responseUploadedBy = data.uploaded_by ?? "";
          } catch { /* ignore */ }
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(responseMessage || "Upload thất bại"));
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Lỗi mạng khi upload")));
        xhr.open("POST", "/api/firmware/upload");
        xhr.send(formData);
      });

      showToast("success", responseMessage || `Release firmware v${version} thành công!`);
      const ver = version.trim();
      setVersion("");
      setNote("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      startTransition(() => {
        router.refresh();
      });

      // Optimistically update manifest
      const newEntry = {
        version: ver,
        uploaded_at: new Date().toISOString(),
        size: selectedFile.size,
        ...(note.trim() && { note: note.trim() }),
        ...(responseUploadedBy && { uploaded_by: responseUploadedBy }),
      };
      setManifest((prev) => ({
        active_version: ver,
        firmwares: [newEntry, ...prev.firmwares.filter((f) => f.version !== ver)],
      }));
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Upload thất bại");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function handleActivate(ver: string) {
    if (!confirm(`Rollback về firmware v${ver}? Thạo tác này sẽ đè lên releases/latest và cập nhật version.json.`)) return;
    setRollbackVersion(ver);
    try {
      const res = await fetch("/api/ota/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: ver }),
      });
      const data = (await res.json()) as {
        message?: string;
        rollback_by?: string;
        rollback_at?: string;
      };
      if (!res.ok) throw new Error(data.message ?? "Thất bại");
      showToast("success", data.message ?? `Đã rollback về v${ver}`);
      setManifest((prev) => ({
        ...prev,
        active_version: ver,
        firmwares: prev.firmwares.map((f) => {
          if (f.version !== ver) return f;
          return {
            ...f,
            ...(data.rollback_by && { rolled_back_by: data.rollback_by }),
            ...(data.rollback_at && { rolled_back_at: data.rollback_at }),
          };
        }),
      }));
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Lỗi rollback");
    } finally {
      setRollbackVersion(null);
    }
  }

  async function handleDelete(ver: string) {
    if (ver === manifest.active_version) {
      showToast("error", "Không thể xóa phiên bản đang được dùng");
      return;
    }

    if (!confirm(`Xóa firmware v${ver}? Hành động này không thể hoàn tác.`)) return;
    setDeletingVersion(ver);

    try {
      const res = await fetch("/api/ota/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: ver }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(data.message ?? "Thất bại");
      showToast("success", "Đã xóa firmware");
      setManifest((prev) => ({
        active_version: prev.active_version === ver ? (prev.firmwares.find((f) => f.version !== ver)?.version ?? "") : prev.active_version,
        firmwares: prev.firmwares.filter((f) => f.version !== ver),
      }));
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Lỗi xóa firmware");
    } finally {
      setDeletingVersion(null);
    }
  }

  const activeEntry = manifest.firmwares.find((f) => f.version === manifest.active_version);

  return (
    <div className="space-y-8">
      {/* Toast Banner */}
      <div
        className={`fixed inset-x-0 top-0 z-50 flex justify-center transition-transform duration-300 ${
          toastVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        {toast && (
          <div
            className={`pointer-events-auto mt-4 flex items-center gap-3 rounded-2xl px-5 py-3.5 text-sm font-medium shadow-xl ${
              toast.type === "success"
                ? "bg-emerald-600 text-white"
                : "bg-red-600 text-white"
            }`}
          >
            {toast.type === "success" ? (
              <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <span>{toast.message}</span>
            <button
              className="ml-2 rounded-full border border-white/40 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/15"
              onClick={dismissToast}
              type="button"
            >
              Huỷ
            </button>
          </div>
        )}
      </div>

      {/* Upload Form */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 lg:p-8">
        <h2 className="mb-1 text-lg font-bold text-slate-900">Upload &amp; Release Firmware</h2>
        <p className="mb-4 text-xs text-slate-500">
          Upload sẽ đồng thời ghi vào <code>releases/latest/</code>, <code>releases/v&#x7B;version&#x7D;/</code> và cập nhật <code>version.json</code> trên GitHub.
        </p>
        <p className="mb-4 text-xs text-amber-700">
          Lưu ý: Không nhấn F5 hoặc reload trang khi đang có thanh tiến trình chạy để tránh thao tác bị gián đoạn.
        </p>

        <form className="space-y-4" onSubmit={handleUpload}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="ota-version">
                Phiên bản <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                disabled={uploading || !!rollbackVersion || !!deletingVersion}
                id="ota-version"
                onChange={(e) => setVersion(e.target.value)}
                pattern="[a-zA-Z0-9._\-]+"
                placeholder="1.0.0"
                required
                title="Chỉ dùng chữ, số, dấu chấm hoặc gạch ngang"
                type="text"
                value={version}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="ota-file">
                File firmware (.bin) <span className="text-red-500">*</span>
              </label>
              <input
                accept=".bin"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-slate-800 file:px-4 file:py-1 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                disabled={uploading || !!rollbackVersion || !!deletingVersion}
                id="ota-file"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                ref={fileInputRef}
                required
                type="file"
              />
              {selectedFile && (
                <p className="mt-1.5 text-xs text-slate-500">
                  {selectedFile.name} — {formatBytes(selectedFile.size)}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="ota-note">
              Ghi chú / Release note
            </label>
            <input
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              disabled={uploading || !!rollbackVersion || !!deletingVersion}
              id="ota-note"
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: Sửa lỗi kết nối MQTT, tối ưu RAM..."
              type="text"
              value={note}
            />
          </div>

          {uploading && uploadProgress < 100 && (
            <div className="space-y-1.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-2 rounded-full bg-amber-600 transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500">Đang gửi file lên server... {uploadProgress}%</p>
              <p className="text-xs text-amber-700">Đang xử lý dữ liệu OTA. Vui lòng không F5/reload cho đến khi tiến trình hoàn tất.</p>
            </div>
          )}

          {uploading && uploadProgress >= 100 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <svg className="h-4 w-4 shrink-0 animate-spin text-amber-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" />
                </svg>
                <span className="text-sm font-medium text-amber-800">{UPLOAD_STEPS[stepIdx]}</span>
              </div>
              <div className="mt-2.5 flex gap-1.5">
                {UPLOAD_STEPS.map((_, i) => (
                  <div
                    className={`h-1 flex-1 rounded-full transition-colors duration-700 ${
                      i === stepIdx ? "bg-amber-600" : i < stepIdx ? "bg-amber-400" : "bg-amber-200"
                    }`}
                    key={i}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-amber-700">Đang xử lý dữ liệu OTA. Vui lòng không F5/reload cho đến khi tiến trình hoàn tất.</p>
            </div>
          )}

          <button
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:opacity-50"
            disabled={uploading || !!rollbackVersion || !!deletingVersion || !selectedFile || !version.trim()}
            type="submit"
          >
            {uploading
              ? uploadProgress < 100
                ? `Đang gửi file... ${uploadProgress}%`
                : "Đang xử lý GitHub..."
              : "Upload & Release"}
          </button>
        </form>
      </section>

      {/* Firmware List */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 lg:p-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Danh sách Firmware</h2>
          <span className="text-xs text-slate-500">
            {manifest.firmwares.length} phiên bản
            {manifest.active_version ? ` · Active: v${manifest.active_version}` : ""}
          </span>
        </div>

        {rollbackVersion && (
          <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <svg className="h-4 w-4 shrink-0 animate-spin text-sky-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" />
              </svg>
              <span className="text-sm font-medium text-sky-900">Rollback v{rollbackVersion}: {ROLLBACK_STEPS[rollbackStepIdx]}</span>
            </div>
            <div className="mt-2.5 flex gap-1.5">
              {ROLLBACK_STEPS.map((_, i) => (
                <div
                  className={`h-1 flex-1 rounded-full transition-colors duration-700 ${
                    i === rollbackStepIdx ? "bg-sky-600" : i < rollbackStepIdx ? "bg-sky-400" : "bg-sky-200"
                  }`}
                  key={i}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-sky-800">Đang xử lý dữ liệu OTA. Vui lòng không F5/reload cho đến khi tiến trình hoàn tất.</p>
          </div>
        )}

        {deletingVersion && (
          <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <svg className="h-4 w-4 shrink-0 animate-spin text-rose-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" />
              </svg>
              <span className="text-sm font-medium text-rose-900">Xóa v{deletingVersion}: {DELETE_STEPS[deleteStepIdx]}</span>
            </div>
            <div className="mt-2.5 flex gap-1.5">
              {DELETE_STEPS.map((_, i) => (
                <div
                  className={`h-1 flex-1 rounded-full transition-colors duration-700 ${
                    i === deleteStepIdx ? "bg-rose-600" : i < deleteStepIdx ? "bg-rose-400" : "bg-rose-200"
                  }`}
                  key={i}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-rose-800">Đang xử lý dữ liệu OTA. Vui lòng không F5/reload cho đến khi tiến trình hoàn tất.</p>
          </div>
        )}

        {manifest.firmwares.length === 0 ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            Chưa có firmware nào được upload.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
            {manifest.firmwares.map((fw) => {
              const isActive = fw.version === manifest.active_version;
              return (
                <div
                  className={`flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${isActive ? "bg-amber-50" : ""}`}
                  key={fw.version}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9l-6-6z" strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="9 3 9 9 15 9" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          className="text-sm font-bold text-slate-900 hover:underline"
                          href={`https://github.com/giangbc2k4/room-firmware/tree/master/releases/v${fw.version}`}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          v{fw.version}
                        </a>
                        {isActive && (
                          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatBytes(fw.size)} · {formatDate(fw.uploaded_at)}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Người upload: {fw.uploaded_by || "Không rõ"}
                      </p>
                      {fw.rolled_back_by && (
                        <p className="mt-0.5 text-xs text-sky-700">
                          Rollback bởi: {fw.rolled_back_by}
                          {fw.rolled_back_at ? ` · ${formatDate(fw.rolled_back_at)}` : ""}
                        </p>
                      )}
                      {fw.note && (
                        <p className="mt-0.5 text-xs text-slate-500 italic">{fw.note}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:shrink-0">
                    <a
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300"
                      download={`firmware-${fw.version}.bin`}
                      href={firmwareRawUrl(fw.version)}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Tải xuống
                    </a>
                    {!isActive && (
                      <button
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-800 hover:text-white hover:border-slate-800"
                        disabled={!!rollbackVersion || !!deletingVersion || uploading}
                        onClick={() => handleActivate(fw.version)}
                        type="button"
                      >
                        {rollbackVersion === fw.version ? "Đang rollback..." : "Rollback"}
                      </button>
                    )}
                    <button
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 hover:border-red-300"
                      disabled={isActive || !!rollbackVersion || !!deletingVersion || uploading}
                      onClick={() => handleDelete(fw.version)}
                      type="button"
                    >
                      {deletingVersion === fw.version ? "Đang xóa..." : isActive ? "Đang dùng" : "Xóa"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* OTA Endpoint Info */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 lg:p-8">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Thông tin OTA cho thiết bị (ESP32)</h2>
        <div className="space-y-3 text-xs text-slate-600">
          <div className="flex flex-col gap-1">
            <span className="font-medium text-slate-500">Kiểm tra phiên bản (version.json):</span>
            <a
              className="break-all rounded-lg bg-slate-200 px-2 py-1 font-mono text-slate-800 hover:underline"
              href="https://raw.githubusercontent.com/giangbc2k4/room-firmware/refs/heads/master/version.json"
              rel="noopener noreferrer"
              target="_blank"
            >
              {GH_RAW}/version.json
            </a>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-medium text-slate-500">ESP32 download URL (releases/latest):</span>
            <a
              className="break-all rounded-lg bg-slate-200 px-2 py-1 font-mono text-slate-800 hover:underline"
              href={`${GH_RAW}/releases/latest/firmware.bin`}
              rel="noopener noreferrer"
              target="_blank"
            >
              {GH_RAW}/releases/latest/firmware.bin
            </a>
          </div>
          {manifest.active_version && (
            <div className="flex flex-col gap-1">
              <span className="font-medium text-slate-500">Active version hiện tại:</span>
              <div className="flex items-center gap-2 flex-wrap">
                <code className="rounded-lg bg-amber-100 px-2 py-1 font-mono text-amber-900">
                  v{manifest.active_version}
                </code>
                <span className="rounded-lg bg-slate-200 px-2 py-1 text-slate-700">
                  Upload bởi: {activeEntry?.uploaded_by || "Không rõ"}
                </span>
                {activeEntry?.rolled_back_by && (
                  <span className="rounded-lg bg-sky-100 px-2 py-1 text-sky-800">
                    Rollback bởi: {activeEntry.rolled_back_by}
                  </span>
                )}
                <a
                  className="break-all rounded-lg bg-slate-200 px-2 py-1 font-mono text-slate-700 hover:underline"
                  href={firmwareRawUrl(manifest.active_version)}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {firmwareRawUrl(manifest.active_version)}
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      {isPending && (
        <p className="text-xs text-slate-400">Đang làm mới dữ liệu...</p>
      )}
    </div>
  );
}


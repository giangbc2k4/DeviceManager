import { readManifest } from "@/lib/ota-github";
import { OtaManager } from "./ota-manager";

export default async function OtaPage() {
  const manifest = await readManifest();

  return (
    <>
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end">
        <div>
          <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900">OTA Firmware</h2>
          <p className="mt-1 text-sm text-slate-500">
            Upload và quản lý các phiên bản firmware OTA cho thiết bị. Thiết bị sẽ tự cập nhật dựa trên phiên bản Active.
          </p>
        </div>
      </div>

      <OtaManager manifest={manifest} />
    </>
  );
}

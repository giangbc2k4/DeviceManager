import Link from "next/link";
import { redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";
import { readManifest } from "@/lib/ota-github";
import { OtaManager } from "./ota-manager";

export default async function OtaPage() {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    redirect("/");
  }

  const manifest = await readManifest();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#f7e8c8,_#efe8dc_35%,_#d8d0c1_100%)] px-2 py-4 md:px-6 md:py-10 text-stone-900">
      <div className="mx-auto max-w-3xl rounded-[32px] border border-stone-900/10 bg-white/80 p-4 md:p-8 shadow-[0_20px_80px_rgba(60,40,10,0.12)] backdrop-blur">
        <div className="flex flex-col gap-4 border-b border-stone-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-amber-700">Device Manager · Admin</p>
            <h1 className="mt-2 text-3xl font-semibold">OTA Firmware</h1>
            <p className="mt-2 max-w-xl text-sm text-stone-600">
              Upload và quản lý các phiên bản firmware OTA cho thiết bị. Thiết bị sẽ tự cập nhật dựa trên phiên bản Active.
            </p>
          </div>

          <Link
            className="inline-flex self-start rounded-full border border-stone-300 px-5 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-950 hover:text-stone-950 md:self-auto"
            href="/admin"
          >
            ← Quay lại
          </Link>
        </div>

        <div className="mt-8">
          <OtaManager manifest={manifest} />
        </div>
      </div>
    </main>
  );
}

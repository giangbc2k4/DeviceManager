import { redirect } from "next/navigation";

import { isAuthenticated, getAuthenticatedAdminEmail } from "@/lib/auth";
import { AdminSidebar } from "./admin-sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    redirect("/");
  }

  const adminEmail = await getAuthenticatedAdminEmail();

  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      <AdminSidebar adminEmail={adminEmail ?? undefined} />

      {/* Top header bar */}
      <header className="sticky top-0 z-40 bg-[#f7f9fb]/80 backdrop-blur-md lg:ml-64">
        <div className="flex items-center justify-between h-16 px-4 lg:px-8">
          <div className="flex items-center gap-6 pl-12 lg:pl-0">
            <span className="text-lg font-bold text-slate-900">MicroBot</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                <span className="material-symbols-outlined text-[20px]">search</span>
              </span>
              <input
                className="bg-slate-100 border-none rounded-full py-2 pl-10 pr-4 w-64 text-sm focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                placeholder="Tìm kiếm thiết bị..."
                type="text"
              />
            </div>
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors" type="button">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-900 leading-none">
                  {adminEmail || "Admin"}
                </p>
                <p className="text-[10px] text-slate-500">System Administrator</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                {(adminEmail || "A")[0].toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="lg:ml-64 p-4 lg:p-8 min-h-[calc(100vh-4rem)]">
        {children}
      </main>
    </div>
  );
}

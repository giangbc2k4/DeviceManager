"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

type AdminSidebarProps = {
  adminEmail?: string;
};

const NAV_ITEMS = [
  { href: "/admin", label: "Tổng quan", icon: "dashboard", exact: true },
  { href: "/admin/chart", label: "Biểu đồ", icon: "bar_chart", exact: false },
  { href: "/admin/sheet1", label: "Phiên hoạt động", icon: "history", exact: false },
  { href: "/admin/activity", label: "Nhật ký Hệ thống", icon: "manage_search", exact: false },
  { href: "/admin/ota", label: "OTA Firmware", icon: "system_update_alt", exact: false },
];

export function AdminSidebar({ adminEmail }: AdminSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  const sidebarContent = (
    <div className="flex h-full flex-col p-4 space-y-2 text-sm font-medium tracking-tight">
      {/* Logo */}
      <div className="flex items-center gap-3 px-2 py-4 mb-4">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-900/20">
          <span className="material-symbols-outlined filled">dynamic_feed</span>
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tighter text-white">MicroBot</h1>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
            Device Manager
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 sidebar-scroll overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-150 ${active
                ? "bg-white/10 text-white scale-[0.98]"
                : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
                }`}
            >
              <span
                className={`material-symbols-outlined ${active ? "text-blue-400" : ""
                  }`}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="pt-4 mt-4 border-t border-slate-800 space-y-1">
        {adminEmail && (
          <div className="px-4 py-2 mb-1">
            <p className="text-[10px] uppercase tracking-widest text-slate-600 font-bold">Admin</p>
            <p className="text-xs text-slate-400 truncate mt-0.5">{adminEmail}</p>
          </div>
        )}
        <form action="/api/logout" method="post">
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined">logout</span>
            <span>Đăng xuất</span>
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-slate-900 text-white shadow-lg lg:hidden"
        aria-label="Mở menu"
      >
        <span className="material-symbols-outlined">menu</span>
      </button>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 bg-slate-900 shadow-2xl shadow-slate-950/50 flex-col z-50">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 sidebar-overlay lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed left-0 top-0 h-full w-64 bg-slate-900 shadow-2xl shadow-slate-950/50 flex flex-col z-50 sidebar-slide lg:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white"
              aria-label="Đóng menu"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}

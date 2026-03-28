import { listAdminActivities } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

export default async function AdminActivityPage() {
  const activities = await listAdminActivities(500);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Nhật ký Hoạt động Quản trị
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Lịch sử thao tác của hệ thống quản trị dựa trên tài khoản admin.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Thời gian</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Tài khoản</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Thiết bị (MAC)</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Hành động</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activities.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-slate-500 bg-slate-50/50">
                    <span className="material-symbols-outlined text-[48px] text-slate-300 mb-2">history_toggle_off</span>
                    <p>Chưa có thao tác nào được ghi nhận</p>
                  </td>
                </tr>
              ) : (
                activities.map((act, index) => (
                  <tr key={index} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 text-xs font-medium text-slate-600 whitespace-nowrap">{act.timestamp}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700 truncate max-w-[150px]">
                        <span className="material-symbols-outlined text-[14px]">person</span>
                        {act.user}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">{act.mac}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                        act.action.includes("Lock") || act.action.includes("Delete")
                          ? "bg-rose-50 text-rose-700 border-rose-100"
                          : act.action.includes("License") || act.action.includes("Expire")
                            ? "bg-purple-50 text-purple-700 border-purple-100"
                            : act.action.includes("Debug")
                              ? "bg-blue-50 text-blue-700 border-blue-100"
                              : "bg-slate-50 text-slate-700 border-slate-200"
                      }`}>
                        {act.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-800">{act.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

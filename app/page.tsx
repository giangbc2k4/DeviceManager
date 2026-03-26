import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login-form";
import { isAuthenticated } from "@/lib/auth";

type HomeProps = {
  searchParams?: Promise<{
    loggedOut?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const authenticated = await isAuthenticated();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const loggedOut = resolvedSearchParams?.loggedOut === "1";

  if (authenticated) {
    redirect("/admin");
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Glow Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-600/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl shadow-indigo-500/10 mb-6">
            <span className="material-symbols-outlined text-indigo-400 text-[32px]">memory</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">Device Manager</h1>
          <p className="text-slate-400 text-sm font-medium tracking-wide uppercase">Hệ thống Điều hành IoT</p>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-6">Đăng nhập hệ thống</h2>
          
          {loggedOut ? (
            <div className="mb-6 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-400 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              Bạn đã đăng xuất an toàn.
            </div>
          ) : null}

          <LoginForm />
        </div>
        
        <p className="mt-8 text-center text-[11px] text-slate-600 font-medium">
          &copy; {new Date().getFullYear()} ESP32 Infrastructure. All rights reserved.
        </p>
      </div>
    </main>
  );
}
